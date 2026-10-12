-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: tests.sql
-- Description: Automated Verification Test Suite demonstrating:
--              (a) Successful Sale Creation & Payment Integration
--              (b) Oversell Prevention (Stock Exception)
--              (c) Transaction Atomicity & Rollback on Partial Failure
--              (d) Automatic Low-Stock Alert Generation
--              (e) Customer Return Processing & Restocking
--              (f) Vendor Restock & Alert Resolution
--              (g) Audit Log Verification
-- ============================================================================

\set ECHO all
\timing on

-- ============================================================================
-- TEST 1: (a) Successful Sale via sp_create_sale
-- ============================================================================
DO $$
DECLARE
    v_test_prod_id    INT := 1; -- Aashirvaad Atta (Price: 245.00)
    v_stock_before    INT;
    v_stock_after     INT;
    v_new_sale_id     INT;
    v_total_amount    NUMERIC(12, 2);
    v_payment_amount  NUMERIC(12, 2);
    v_payment_mode    VARCHAR(20);
    v_order_qty       INT := 2;
    v_disc            NUMERIC(10, 2) := 20.00;
    v_expected_total  NUMERIC(12, 2);
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 1: Verifying Successful Sale via sp_create_sale...';

    -- Capture baseline stock
    SELECT quantity_in_hand INTO v_stock_before FROM inventory WHERE product_id = v_test_prod_id;

    -- Execute checkout procedure
    CALL sp_create_sale(
        1, -- Customer Aarav Sharma
        jsonb_build_array(
            jsonb_build_object('product_id', v_test_prod_id, 'quantity', v_order_qty, 'discount', v_disc)
        ),
        'UPI',
        'TEST-UPI-SUCCESS-01',
        v_new_sale_id
    );

    -- Verify stock decremented
    SELECT quantity_in_hand INTO v_stock_after FROM inventory WHERE product_id = v_test_prod_id;
    IF v_stock_after <> (v_stock_before - v_order_qty) THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Inventory not decremented correctly. Before: %, After: %', v_stock_before, v_stock_after;
    END IF;

    -- Verify sales total
    SELECT total_amount INTO v_total_amount FROM sales WHERE sales_id = v_new_sale_id;
    v_expected_total := (2 * 245.00) - v_disc; -- 490 - 20 = 470.00
    IF v_total_amount <> v_expected_total THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Sales total mismatch. Expected: %, Got: %', v_expected_total, v_total_amount;
    END IF;

    -- Verify payment record
    SELECT amount, payment_mode INTO v_payment_amount, v_payment_mode FROM payment WHERE sales_id = v_new_sale_id;
    IF v_payment_amount <> v_expected_total OR v_payment_mode <> 'UPI' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Payment record invalid. Amount: %, Mode: %', v_payment_amount, v_payment_mode;
    END IF;

    RAISE NOTICE '>>> TEST 1 PASSED: Sale #% created with total ₹%. Inventory decremented % -> % units.',
        v_new_sale_id, v_total_amount, v_stock_before, v_stock_after;
END;
$$;


-- ============================================================================
-- TEST 2: (b) Oversell Rejection
-- ============================================================================
DO $$
DECLARE
    v_test_prod_id INT := 35; -- Dove Body Wash (Stock is only 2 units)
    v_stock_avail  INT;
    v_sale_id      INT;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 2: Verifying Oversell Prevention (Stock Exception)...';

    SELECT quantity_in_hand INTO v_stock_avail FROM inventory WHERE product_id = v_test_prod_id;

    BEGIN
        -- Attempt to purchase 100 units when only 2 are available
        CALL sp_create_sale(
            2,
            jsonb_build_array(
                jsonb_build_object('product_id', v_test_prod_id, 'quantity', 100)
            ),
            'Cash',
            NULL,
            v_sale_id
        );
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := TRUE;
        RAISE NOTICE 'Expected exception successfully caught: "%"', SQLERRM;
    END IF;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Oversell was NOT prevented! System allowed selling unavailable stock.';
    END IF;

    -- Ensure stock was untouched
    IF (SELECT quantity_in_hand FROM inventory WHERE product_id = v_test_prod_id) <> v_stock_avail THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Inventory changed despite transaction abort!';
    END IF;

    RAISE NOTICE '>>> TEST 2 PASSED: Oversell properly rejected by trigger. Available stock (%) preserved.', v_stock_avail;
END;
$$;


-- ============================================================================
-- TEST 3: (c) Transaction Atomicity & Rollback on Partial Failure
-- ============================================================================
DO $$
DECLARE
    v_valid_prod_id   INT := 2;   -- Fortune Sunflower Oil (sufficient stock)
    v_oversell_prod_id INT := 35;  -- Dove Body Wash (only 2 units in stock)
    v_stock_prod_2_pre INT;
    v_stock_prod_2_post INT;
    v_sales_count_pre INT;
    v_sales_count_post INT;
    v_sale_id         INT;
    v_error_caught    BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 3: Verifying ACID Atomicity (Rollback on Cart Failure)...';

    SELECT quantity_in_hand INTO v_stock_prod_2_pre FROM inventory WHERE product_id = v_valid_prod_id;
    SELECT COUNT(*) INTO v_sales_count_pre FROM sales;

    -- Multi-item order: Item 1 has valid stock; Item 2 triggers oversell exception
    BEGIN
        CALL sp_create_sale(
            3,
            jsonb_build_array(
                jsonb_build_object('product_id', v_valid_prod_id, 'quantity', 2),
                jsonb_build_object('product_id', v_oversell_prod_id, 'quantity', 9999)
            ),
            'Card',
            NULL,
            v_sale_id
        );
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := TRUE;
        RAISE NOTICE 'Expected abort caught during multi-item transaction: "%"', SQLERRM;
    END IF;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Procedure did not abort on invalid second line item!';
    END IF;

    -- Verify that sales table count is strictly unchanged (no orphan sale header)
    SELECT COUNT(*) INTO v_sales_count_post FROM sales;
    IF v_sales_count_post <> v_sales_count_pre THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Sales header was committed despite transaction failure!';
    END IF;

    -- Verify that valid Item 1 was NOT decremented (complete rollback)
    SELECT quantity_in_hand INTO v_stock_prod_2_post FROM inventory WHERE product_id = v_valid_prod_id;
    IF v_stock_prod_2_post <> v_stock_prod_2_pre THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Product 2 was partially decremented! Atomicity violated.';
    END IF;

    RAISE NOTICE '>>> TEST 3 PASSED: Full transaction rolled back. Zero orphan headers, stock strictly intact.';
END;
$$;


-- ============================================================================
-- TEST 4: (d) Low-Stock Alert Trigger Firing
-- ============================================================================
DO $$
DECLARE
    v_test_prod_id     INT := 15; -- Kelloggs Corn Flakes (reorder_level = 10)
    v_reorder_lvl      INT;
    v_stock_initial    INT;
    v_alerts_count_pre INT;
    v_alerts_count_post INT;
    v_sale_id          INT;
    v_sell_qty         INT;
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 4: Verifying Automated Low-Stock Alert Generation...';

    SELECT reorder_level INTO v_reorder_lvl FROM product WHERE product_id = v_test_prod_id;

    -- Ensure product stock is just above reorder level (e.g., reorder 10, set to 12)
    UPDATE inventory SET quantity_in_hand = 12, last_updated = CURRENT_TIMESTAMP WHERE product_id = v_test_prod_id;

    -- Count existing pending alerts
    SELECT COUNT(*) INTO v_alerts_count_pre FROM stock_alert WHERE product_id = v_test_prod_id AND status = 'PENDING';

    -- Sell 4 units so stock drops from 12 to 8 (breaching threshold of 10)
    v_sell_qty := 4;
    CALL sp_create_sale(
        4,
        jsonb_build_array(
            jsonb_build_object('product_id', v_test_prod_id, 'quantity', v_sell_qty)
        ),
        'UPI',
        'TEST-ALERT-01',
        v_sale_id
    );

    -- Check if alert was triggered
    SELECT COUNT(*) INTO v_alerts_count_post FROM stock_alert WHERE product_id = v_test_prod_id AND status = 'PENDING';

    IF v_alerts_count_post <= v_alerts_count_pre THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Stock alert was not logged when quantity dropped below reorder level!';
    END IF;

    RAISE NOTICE '>>> TEST 4 PASSED: Low stock alert logged successfully in stock_alert (Current Stock: 8, Reorder Level: %).',
        v_reorder_lvl;
END;
$$;


-- ============================================================================
-- TEST 5: (e) Customer Return Processing & Restocking via sp_process_return
-- ============================================================================
DO $$
DECLARE
    v_test_prod_id    INT := 4; -- Daawat Basmati Rice (Price: 395.00)
    v_sale_id         INT;
    v_detail_id       INT;
    v_stock_pre_sale  INT;
    v_stock_post_sale INT;
    v_stock_post_ret  INT;
    v_order_total_orig NUMERIC(12, 2);
    v_order_total_adj  NUMERIC(12, 2);
    v_payment_adj     NUMERIC(12, 2);
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 5: Verifying Return Processing & Restocking...';

    SELECT quantity_in_hand INTO v_stock_pre_sale FROM inventory WHERE product_id = v_test_prod_id;

    -- Create sale with 3 units
    CALL sp_create_sale(
        5,
        jsonb_build_array(
            jsonb_build_object('product_id', v_test_prod_id, 'quantity', 3, 'discount', 0.00)
        ),
        'NetBanking',
        'RET-TEST-001',
        v_sale_id
    );

    SELECT sales_detail_id INTO v_detail_id FROM sales_detail WHERE sales_id = v_sale_id AND product_id = v_test_prod_id;
    SELECT quantity_in_hand INTO v_stock_post_sale FROM inventory WHERE product_id = v_test_prod_id;
    SELECT total_amount INTO v_order_total_orig FROM sales WHERE sales_id = v_sale_id;

    -- Execute partial return: return 1 unit out of 3
    CALL sp_process_return(v_detail_id, 1);

    -- Verify inventory restocked by 1
    SELECT quantity_in_hand INTO v_stock_post_ret FROM inventory WHERE product_id = v_test_prod_id;
    IF v_stock_post_ret <> (v_stock_post_sale + 1) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Inventory not restocked on partial return. Expected: %, Got: %',
            (v_stock_post_sale + 1), v_stock_post_ret;
    END IF;

    -- Verify updated invoice total (395 * 2 = 790.00)
    SELECT total_amount INTO v_order_total_adj FROM sales WHERE sales_id = v_sale_id;
    IF v_order_total_adj <> 790.00 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Sales total was not updated on return. Expected 790.00, Got %', v_order_total_adj;
    END IF;

    -- Verify payment record adjusted
    SELECT amount INTO v_payment_adj FROM payment WHERE sales_id = v_sale_id;
    IF v_payment_adj <> 790.00 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Payment settlement not updated. Expected 790.00, Got %', v_payment_adj;
    END IF;

    -- Now return remaining 2 units (full return)
    CALL sp_process_return(v_detail_id, 2);

    -- Verify stock returned to original pre-sale level
    SELECT quantity_in_hand INTO v_stock_post_ret FROM inventory WHERE product_id = v_test_prod_id;
    IF v_stock_post_ret <> v_stock_pre_sale THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Inventory did not return to original baseline. Expected: %, Got: %',
            v_stock_pre_sale, v_stock_post_ret;
    END IF;

    -- Line item should be removed
    IF EXISTS (SELECT 1 FROM sales_detail WHERE sales_detail_id = v_detail_id) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Fully returned line item was not removed!';
    END IF;

    -- Order total should now be 0.00
    SELECT total_amount INTO v_order_total_adj FROM sales WHERE sales_id = v_sale_id;
    IF v_order_total_adj <> 0.00 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Sales total should be 0.00 after full return. Got %', v_order_total_adj;
    END IF;

    RAISE NOTICE '>>> TEST 5 PASSED: Return successfully restocked inventory and synchronized sales and payment.';
END;
$$;


-- ============================================================================
-- TEST 6: Vendor Restock & Alert Resolution via sp_receive_shipment
-- ============================================================================
DO $$
DECLARE
    v_test_prod_id INT := 3; -- Tata Salt (Stock is at 5 units, reorder 30)
    v_stock_before INT;
    v_stock_after  INT;
    v_pending_alerts INT;
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 6: Verifying Vendor Shipment Receipt & Alert Resolution...';

    SELECT quantity_in_hand INTO v_stock_before FROM inventory WHERE product_id = v_test_prod_id;

    -- Receive shipment of 50 units
    CALL sp_receive_shipment(v_test_prod_id, 50);

    SELECT quantity_in_hand INTO v_stock_after FROM inventory WHERE product_id = v_test_prod_id;
    IF v_stock_after <> (v_stock_before + 50) THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Inward stock not updated properly. Before: %, After: %', v_stock_before, v_stock_after;
    END IF;

    -- Verify that pending alert has been marked RESOLVED
    SELECT COUNT(*) INTO v_pending_alerts FROM stock_alert WHERE product_id = v_test_prod_id AND status = 'PENDING';
    IF v_pending_alerts > 0 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Pending stock alerts were not resolved upon replenishment!';
    END IF;

    RAISE NOTICE '>>> TEST 6 PASSED: Inward replenishment (+50) logged. New stock: % units. Alert status: RESOLVED.',
        v_stock_after;
END;
$$;


-- ============================================================================
-- TEST 7: Audit Log Verification
-- ============================================================================
DO $$
DECLARE
    v_log_count INT;
BEGIN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'TEST 7: Verifying Audit Log Records...';

    SELECT COUNT(*) INTO v_log_count FROM audit_log;
    IF v_log_count = 0 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Audit log contains zero records!';
    END IF;

    RAISE NOTICE '>>> TEST 7 PASSED: Audit ledger has recorded % total DML catalog and inventory mutations.', v_log_count;
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'ALL 7 AUTOMATED INTEGRATION TESTS COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '===============================================================';
END;
$$;

-- Display recent audit log sample
SELECT log_id, table_name, action, record_id, changed_at, changed_by
FROM audit_log
ORDER BY log_id DESC
LIMIT 5;
