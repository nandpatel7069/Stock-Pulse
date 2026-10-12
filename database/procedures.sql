-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: procedures.sql
-- Description: Stored Procedures for ACID Sales Processing, Inventory Returns,
--              and Supplier Stock Inwarding for PostgreSQL 16
-- ============================================================================

-- ============================================================================
-- 1. PROCEDURE: sp_create_sale
-- Purpose: Executes an atomic end-to-end checkout transaction:
--          1. Validates customer and items payload.
--          2. Creates sales header.
--          3. Iterates JSON items array and inserts sales_detail rows
--             (firing subtotal calculation, inventory stock checks,
--              inventory deduction, and stock alerts).
--          4. Creates synchronized payment record.
--          5. Returns the generated sales_id.
-- ACID Guarantee: The entire batch is executed within one single transaction.
--                 If any product has insufficient stock or is invalid, the
--                 transaction aborts and rolls back completely.
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_create_sale(
    IN    p_customer_id  INT,
    IN    p_items        JSONB,
    IN    p_payment_mode VARCHAR,
    IN    p_reference_no VARCHAR DEFAULT NULL,
    INOUT p_sales_id     INT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_customer_exists BOOLEAN;
    v_item            JSONB;
    v_product_id      INT;
    v_quantity        INT;
    v_unit_price      NUMERIC(10, 2);
    v_discount        NUMERIC(10, 2);
    v_final_total     NUMERIC(12, 2);
    v_ref_no          VARCHAR(100);
BEGIN
    -- 1. Validate Customer
    SELECT EXISTS (SELECT 1 FROM customer WHERE customer_id = p_customer_id)
    INTO v_customer_exists;

    IF NOT v_customer_exists THEN
        RAISE EXCEPTION 'Customer ID % does not exist.', p_customer_id;
    END IF;

    -- 2. Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Items payload must be a non-empty JSON array of products.';
    END IF;

    -- 3. Validate Payment Mode
    IF p_payment_mode NOT IN ('Cash', 'Card', 'UPI', 'NetBanking') THEN
        RAISE EXCEPTION 'Invalid payment mode: "%". Allowed modes: Cash, Card, UPI, NetBanking.', p_payment_mode;
    END IF;

    -- Generate reference number if omitted for non-cash modes
    IF p_reference_no IS NULL OR trim(p_reference_no) = '' THEN
        IF p_payment_mode = 'Cash' THEN
            v_ref_no := 'CASH-POS-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS');
        ELSE
            v_ref_no := UPPER(p_payment_mode) || '-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS') || '-' || LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0');
        END IF;
    ELSE
        v_ref_no := trim(p_reference_no);
    END IF;

    -- 4. Create Sales Header Record (total_amount starts at 0, synced by details trigger)
    INSERT INTO sales (customer_id, sales_date, total_amount)
    VALUES (p_customer_id, CURRENT_TIMESTAMP, 0.00)
    RETURNING sales_id INTO p_sales_id;

    -- 5. Process and insert each line item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::INT;
        v_quantity   := (v_item->>'quantity')::INT;
        v_discount   := COALESCE((v_item->>'discount')::NUMERIC, 0.00);

        IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'Invalid line item: each item must contain a valid product_id and quantity > 0.';
        END IF;

        -- Extract unit_price from JSON or fallback to product master price
        IF v_item ? 'unit_price' AND (v_item->>'unit_price') IS NOT NULL THEN
            v_unit_price := (v_item->>'unit_price')::NUMERIC;
        ELSE
            SELECT unit_price INTO v_unit_price FROM product WHERE product_id = v_product_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product ID % does not exist in product catalog.', v_product_id;
            END IF;
        END IF;

        -- Insert line item: triggers handle subtotal, stock verification & decrement, and sales total sync
        INSERT INTO sales_detail (
            sales_id,
            product_id,
            quantity,
            unit_price,
            discount,
            sub_total
        )
        VALUES (
            p_sales_id,
            v_product_id,
            v_quantity,
            v_unit_price,
            v_discount,
            0.00
        );
    END LOOP;

    -- 6. Retrieve verified final order total
    SELECT total_amount INTO v_final_total
    FROM sales
    WHERE sales_id = p_sales_id;

    -- 7. Record payment settlement
    INSERT INTO payment (
        sales_id,
        payment_date,
        amount,
        payment_mode,
        reference_no
    )
    VALUES (
        p_sales_id,
        CURRENT_TIMESTAMP,
        v_final_total,
        p_payment_mode,
        v_ref_no
    );

    RAISE NOTICE 'Sale #% successfully finalized. Total Amount: ₹%, Payment: % (%)',
        p_sales_id, v_final_total, p_payment_mode, v_ref_no;
END;
$$;


-- ============================================================================
-- 2. PROCEDURE: sp_process_return
-- Purpose: Processes return of goods from a customer:
--          1. Validates the sales_detail line item and return quantity.
--          2. Restocks physical inventory.
--          3. Proportionately adjusts sales_detail discount and quantity
--             (or deletes the line item if entire quantity returned).
--          4. Triggers automatically recalculate sales total and payment amount.
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_process_return(
    IN p_sales_detail_id INT,
    IN p_return_qty      INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sales_id      INT;
    v_product_id    INT;
    v_current_qty   INT;
    v_current_disc  NUMERIC(10, 2);
    v_unit_price    NUMERIC(10, 2);
    v_product_name  VARCHAR(150);
    v_new_qty       INT;
    v_new_disc      NUMERIC(10, 2);
    v_updated_total NUMERIC(12, 2);
BEGIN
    -- 1. Validation
    IF p_return_qty <= 0 THEN
        RAISE EXCEPTION 'Return quantity must be strictly greater than 0.';
    END IF;

    SELECT sd.sales_id, sd.product_id, sd.quantity, sd.discount, sd.unit_price, p.product_name
    INTO v_sales_id, v_product_id, v_current_qty, v_current_disc, v_unit_price, v_product_name
    FROM sales_detail sd
    JOIN product p ON p.product_id = sd.product_id
    WHERE sd.sales_detail_id = p_sales_detail_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales detail line item ID % does not exist.', p_sales_detail_id;
    END IF;

    IF p_return_qty > v_current_qty THEN
        RAISE EXCEPTION 'Cannot return % units. Only % units were purchased on line item %.',
            p_return_qty, v_current_qty, p_sales_detail_id;
    END IF;

    -- 2. Adjust Sales Detail and Restock Inventory
    IF p_return_qty = v_current_qty THEN
        -- Full line return: delete line item (delete trigger restocks inventory and recalculates sales & payment)
        DELETE FROM sales_detail WHERE sales_detail_id = p_sales_detail_id;
        RAISE NOTICE 'Line item % completely returned (% units of "%"). Line removed from Sale #%.',
            p_sales_detail_id, p_return_qty, v_product_name, v_sales_id;
    ELSE
        -- Partial line return: reduce quantity and adjust discount proportionally
        v_new_qty  := v_current_qty - p_return_qty;
        v_new_disc := ROUND((v_current_disc * v_new_qty) / v_current_qty, 2);

        -- Update sales_detail (triggers automatically restock difference, recompute subtotal and sync sales & payment)
        UPDATE sales_detail
        SET quantity = v_new_qty,
            discount = v_new_disc
        WHERE sales_detail_id = p_sales_detail_id;

        RAISE NOTICE 'Partial return processed: % units of "%" restocked. New line qty: % for Sale #%.',
            p_return_qty, v_product_name, v_new_qty, v_sales_id;
    END IF;

    -- Fetch and report new total
    SELECT total_amount INTO v_updated_total FROM sales WHERE sales_id = v_sales_id;
    RAISE NOTICE 'Updated invoice total for Sale #% is now ₹%.', v_sales_id, v_updated_total;
END;
$$;


-- ============================================================================
-- 3. PROCEDURE: sp_receive_shipment
-- Purpose: Inward vendor delivery replenishment:
--          1. Validates product and inward quantity.
--          2. Increases quantity_in_hand in inventory table.
--          3. Updates last_updated timestamp.
--          4. Resolves any active stock_alert records if stock is now healthy.
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_receive_shipment(
    IN p_product_id INT,
    IN p_qty        INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_product_name  VARCHAR(150);
    v_reorder_level INT;
    v_new_qty       INT;
BEGIN
    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Inward shipment quantity must be greater than 0 (received: %).', p_qty;
    END IF;

    SELECT product_name, reorder_level
    INTO v_product_name, v_reorder_level
    FROM product
    WHERE product_id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product ID % does not exist in master catalog.', p_product_id;
    END IF;

    -- Update inventory balance
    UPDATE inventory
    SET quantity_in_hand = quantity_in_hand + p_qty,
        last_updated     = CURRENT_TIMESTAMP
    WHERE product_id = p_product_id
    RETURNING quantity_in_hand INTO v_new_qty;

    -- Resolve pending stock alerts if replenished above threshold
    IF v_new_qty > v_reorder_level THEN
        UPDATE stock_alert
        SET status = 'RESOLVED'
        WHERE product_id = p_product_id
          AND status = 'PENDING';
    END IF;

    RAISE NOTICE 'Shipment received for "%" (ID: %): +% units. Current Stock in hand: % units.',
        v_product_name, p_product_id, p_qty, v_new_qty;
END;
$$;
