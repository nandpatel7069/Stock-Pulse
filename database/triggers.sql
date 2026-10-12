-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: triggers.sql
-- Description: PL/pgSQL Business Rules, Automation Triggers, Stock Control,
--              Low Stock Alerts, and Audit Logging for PostgreSQL 16
-- ============================================================================

-- ============================================================================
-- 1. SUB-TOTAL CALCULATION TRIGGER
-- Timing: BEFORE INSERT OR UPDATE ON sales_detail
-- Purpose: Ensures sub_total is always mathematically accurate:
--          sub_total = (quantity * unit_price) - discount
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_sales_detail_subtotal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Fallback default for discount
    IF NEW.discount IS NULL THEN
        NEW.discount := 0.00;
    END IF;

    -- Validation: discount cannot exceed gross line amount
    IF NEW.discount > (NEW.quantity * NEW.unit_price) THEN
        RAISE EXCEPTION 'Invalid discount: Discount (₹%) cannot exceed total item price (₹%).',
            NEW.discount, (NEW.quantity * NEW.unit_price);
    END IF;

    -- Calculate sub_total rounded to 2 decimal places
    NEW.sub_total := ROUND((NEW.quantity * NEW.unit_price) - NEW.discount, 2);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_sales_detail_subtotal ON sales_detail;
CREATE TRIGGER trg_calc_sales_detail_subtotal
    BEFORE INSERT OR UPDATE ON sales_detail
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_sales_detail_subtotal();


-- ============================================================================
-- 2. INVENTORY STOCK MANAGEMENT & OVERSELL PREVENTION TRIGGER
-- Timing: AFTER INSERT OR UPDATE OR DELETE ON sales_detail
-- Purpose:
--   - Decrements inventory.quantity_in_hand on sale line addition.
--   - Raises an explicit exception if stock is insufficient (prevents overselling).
--   - Restocks inventory on line quantity reduction or deletion (returns/cancellations).
--   - Updates inventory.last_updated timestamp.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_inventory_on_sales_detail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_available_stock INT;
    v_product_name    VARCHAR(150);
    v_qty_delta       INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Acquire pessimistic lock on inventory record to prevent race conditions
        SELECT i.quantity_in_hand, p.product_name
        INTO v_available_stock, v_product_name
        FROM inventory i
        JOIN product p ON p.product_id = i.product_id
        WHERE i.product_id = NEW.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory record not found for product ID %.', NEW.product_id;
        END IF;

        -- Verify stock availability
        IF v_available_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for "%" (Product ID %). Available: %, Requested: % (Oversell prevented).',
                v_product_name, NEW.product_id, v_available_stock, NEW.quantity;
        END IF;

        -- Decrement inventory and update timestamp
        UPDATE inventory
        SET quantity_in_hand = quantity_in_hand - NEW.quantity,
            last_updated     = CURRENT_TIMESTAMP
        WHERE product_id = NEW.product_id;

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle case where product_id itself changed
        IF OLD.product_id <> NEW.product_id THEN
            -- Restock old product
            UPDATE inventory
            SET quantity_in_hand = quantity_in_hand + OLD.quantity,
                last_updated     = CURRENT_TIMESTAMP
            WHERE product_id = OLD.product_id;

            -- Check and deduct new product
            SELECT i.quantity_in_hand, p.product_name
            INTO v_available_stock, v_product_name
            FROM inventory i
            JOIN product p ON p.product_id = i.product_id
            WHERE i.product_id = NEW.product_id
            FOR UPDATE;

            IF v_available_stock < NEW.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for "%" (Product ID %). Available: %, Requested: %.',
                    v_product_name, NEW.product_id, v_available_stock, NEW.quantity;
            END IF;

            UPDATE inventory
            SET quantity_in_hand = quantity_in_hand - NEW.quantity,
                last_updated     = CURRENT_TIMESTAMP
            WHERE product_id = NEW.product_id;

        ELSE
            -- Same product, quantity difference
            v_qty_delta := NEW.quantity - OLD.quantity;

            IF v_qty_delta > 0 THEN
                SELECT i.quantity_in_hand, p.product_name
                INTO v_available_stock, v_product_name
                FROM inventory i
                JOIN product p ON p.product_id = i.product_id
                WHERE i.product_id = NEW.product_id
                FOR UPDATE;

                IF v_available_stock < v_qty_delta THEN
                    RAISE EXCEPTION 'Insufficient stock for "%" (Product ID %). Available: %, Additional needed: %.',
                        v_product_name, NEW.product_id, v_available_stock, v_qty_delta;
                END IF;

                UPDATE inventory
                SET quantity_in_hand = quantity_in_hand - v_qty_delta,
                    last_updated     = CURRENT_TIMESTAMP
                WHERE product_id = NEW.product_id;

            ELSIF v_qty_delta < 0 THEN
                -- Quantity reduced (partial return): restock the difference
                UPDATE inventory
                SET quantity_in_hand = quantity_in_hand + ABS(v_qty_delta),
                    last_updated     = CURRENT_TIMESTAMP
                WHERE product_id = NEW.product_id;
            END IF;
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- Line item cancelled / returned: return items back to stock
        UPDATE inventory
        SET quantity_in_hand = quantity_in_hand + OLD.quantity,
            last_updated     = CURRENT_TIMESTAMP
        WHERE product_id = OLD.product_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventory_on_sales_detail ON sales_detail;
CREATE TRIGGER trg_sync_inventory_on_sales_detail
    AFTER INSERT OR UPDATE OR DELETE ON sales_detail
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_inventory_on_sales_detail();


-- ============================================================================
-- 3. SALES TOTAL SYNCHRONIZATION TRIGGER
-- Timing: AFTER INSERT OR UPDATE OR DELETE ON sales_detail
-- Purpose: Keeps sales.total_amount perfectly synchronized with the sum of
--          its sales_detail.sub_total line items. Also syncs payment if present.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_sales_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sales_id       INT;
    v_calculated_sum NUMERIC(12, 2);
BEGIN
    v_sales_id := COALESCE(NEW.sales_id, OLD.sales_id);

    -- Sum current sub-totals for this sale
    SELECT COALESCE(SUM(sub_total), 0.00)
    INTO v_calculated_sum
    FROM sales_detail
    WHERE sales_id = v_sales_id;

    -- Update parent sales record
    UPDATE sales
    SET total_amount = v_calculated_sum
    WHERE sales_id = v_sales_id;

    -- If a payment record exists, maintain consistency with updated total
    UPDATE payment
    SET amount = v_calculated_sum
    WHERE sales_id = v_sales_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sales_total ON sales_detail;
CREATE TRIGGER trg_sync_sales_total
    AFTER INSERT OR UPDATE OR DELETE ON sales_detail
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_sales_total_amount();


-- ============================================================================
-- 4. STOCK REORDER ALERT TRIGGER
-- Timing: AFTER INSERT OR UPDATE OF quantity_in_hand ON inventory
-- Purpose: Automatically inserts an alert record in stock_alert whenever
--          physical stock drops to or below the product reorder_level.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_check_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_reorder_level INT;
    v_product_name  VARCHAR(150);
BEGIN
    SELECT p.reorder_level, p.product_name
    INTO v_reorder_level, v_product_name
    FROM product p
    WHERE p.product_id = NEW.product_id;

    -- Check if stock has breached reorder threshold
    IF NEW.quantity_in_hand <= v_reorder_level THEN
        -- Insert alert only if new insert or stock has reduced / changed while below threshold
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.quantity_in_hand > v_reorder_level OR NEW.quantity_in_hand <> OLD.quantity_in_hand)) THEN
            INSERT INTO stock_alert (
                product_id,
                quantity_at_alert,
                reorder_level,
                alert_date,
                alert_message,
                status
            )
            VALUES (
                NEW.product_id,
                NEW.quantity_in_hand,
                v_reorder_level,
                CURRENT_TIMESTAMP,
                format('CRITICAL: Product "%s" (ID: %s) stock level is %s (Reorder Level: %s). Replenishment required.',
                       v_product_name, NEW.product_id, NEW.quantity_in_hand, v_reorder_level),
                'PENDING'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_stock_alert ON inventory;
CREATE TRIGGER trg_inventory_stock_alert
    AFTER INSERT OR UPDATE OF quantity_in_hand ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_stock_alert();


-- ============================================================================
-- 5. AUDIT LOGGING TRIGGER FOR PRODUCT AND INVENTORY
-- Timing: AFTER INSERT OR UPDATE OR DELETE ON product & inventory
-- Purpose: Records all DML changes with user, timestamp, old and new JSON payloads.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_id INT;
    v_old_json  JSONB := NULL;
    v_new_json  JSONB := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'product' THEN
            v_record_id := OLD.product_id;
        ELSE
            v_record_id := OLD.inventory_id;
        END IF;
        v_old_json := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'product' THEN
            v_record_id := NEW.product_id;
        ELSE
            v_record_id := NEW.inventory_id;
        END IF;
        v_new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'product' THEN
            v_record_id := NEW.product_id;
        ELSE
            v_record_id := NEW.inventory_id;
        END IF;
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_log (
        table_name,
        action,
        record_id,
        old_data,
        new_data,
        changed_at,
        changed_by
    )
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        v_record_id,
        v_old_json,
        v_new_json,
        CURRENT_TIMESTAMP,
        CURRENT_USER
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger to product catalog
DROP TRIGGER IF EXISTS trg_audit_product ON product;
CREATE TRIGGER trg_audit_product
    AFTER INSERT OR UPDATE OR DELETE ON product
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log_changes();

-- Attach audit trigger to inventory balances
DROP TRIGGER IF EXISTS trg_audit_inventory ON inventory;
CREATE TRIGGER trg_audit_inventory
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log_changes();
