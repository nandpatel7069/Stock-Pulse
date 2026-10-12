-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: views.sql
-- Description: Business Intelligence, Analytics & Operational Views
-- ============================================================================

-- ============================================================================
-- 1. VIEW: v_low_stock
-- Purpose: Identifies all products that are currently below or at their
--          reorder threshold, highlighting shortage and urgency level.
-- ============================================================================
CREATE OR REPLACE VIEW v_low_stock AS
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    s.supplier_name,
    s.phone AS supplier_phone,
    i.quantity_in_hand,
    p.reorder_level,
    (p.reorder_level - i.quantity_in_hand) AS shortage_quantity,
    p.unit_price,
    ROUND((p.reorder_level - i.quantity_in_hand) * p.unit_price, 2) AS estimated_restock_cost,
    CASE
        WHEN i.quantity_in_hand = 0 THEN 'OUT OF STOCK'
        WHEN i.quantity_in_hand <= CEIL(p.reorder_level * 0.3) THEN 'CRITICAL ALERT'
        ELSE 'LOW STOCK'
    END AS stock_status,
    i.last_updated
FROM product p
JOIN inventory i ON i.product_id = p.product_id
JOIN category c  ON c.category_id = p.category_id
JOIN supplier s  ON s.supplier_id = p.supplier_id
WHERE i.quantity_in_hand <= p.reorder_level
ORDER BY shortage_quantity DESC, i.quantity_in_hand ASC;

COMMENT ON VIEW v_low_stock IS 'Real-time operational dashboard for products requiring procurement replenishment.';


-- ============================================================================
-- 2. VIEW: v_inventory_valuation
-- Purpose: Calculates total monetary capitalization of stock on hand,
--          categorized by department with min, max, and avg price metrics.
-- ============================================================================
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
    c.category_id,
    c.category_name,
    COUNT(p.product_id)                                         AS total_sku_count,
    COALESCE(SUM(i.quantity_in_hand), 0)                        AS total_units_in_hand,
    ROUND(COALESCE(SUM(i.quantity_in_hand * p.unit_price), 0), 2) AS total_inventory_value,
    ROUND(AVG(p.unit_price), 2)                                 AS avg_unit_price,
    MIN(p.unit_price)                                           AS min_unit_price,
    MAX(p.unit_price)                                           AS max_unit_price
FROM category c
LEFT JOIN product p   ON p.category_id = c.category_id
LEFT JOIN inventory i ON i.product_id = p.product_id
GROUP BY c.category_id, c.category_name
ORDER BY total_inventory_value DESC;

COMMENT ON VIEW v_inventory_valuation IS 'Financial balance sheet view of warehouse inventory valuation by category.';


-- ============================================================================
-- 3. VIEW: v_daily_sales
-- Purpose: Aggregates day-by-day checkout throughput, volume, gross/net
--          revenue, discounts, and average order basket size.
-- ============================================================================
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
    s.sales_date::DATE                                              AS sale_date,
    COUNT(DISTINCT s.sales_id)                                      AS total_orders,
    COALESCE(SUM(sd.quantity), 0)                                   AS total_units_sold,
    ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)          AS gross_revenue,
    ROUND(COALESCE(SUM(sd.discount), 0), 2)                         AS total_discounts,
    ROUND(COALESCE(SUM(s.total_amount), 0), 2)                      AS net_revenue,
    ROUND(AVG(s.total_amount), 2)                                   AS avg_order_value
FROM sales s
LEFT JOIN sales_detail sd ON sd.sales_id = s.sales_id
GROUP BY s.sales_date::DATE
ORDER BY sale_date DESC;

COMMENT ON VIEW v_daily_sales IS 'Daily sales performance KPIs including order counts, items sold, and net turnover.';


-- ============================================================================
-- 4. VIEW: v_monthly_sales
-- Purpose: Monthly financial tracking showing long-term trends and seasonality.
-- ============================================================================
CREATE OR REPLACE VIEW v_monthly_sales AS
SELECT
    EXTRACT(YEAR FROM s.sales_date)::INT                           AS sales_year,
    EXTRACT(MONTH FROM s.sales_date)::INT                          AS sales_month,
    TO_CHAR(s.sales_date, 'Month YYYY')                            AS month_label,
    COUNT(DISTINCT s.sales_id)                                     AS total_orders,
    COALESCE(SUM(sd.quantity), 0)                                  AS total_units_sold,
    ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)         AS gross_revenue,
    ROUND(COALESCE(SUM(sd.discount), 0), 2)                        AS total_discounts,
    ROUND(COALESCE(SUM(s.total_amount), 0), 2)                     AS net_revenue,
    ROUND(AVG(s.total_amount), 2)                                  AS avg_order_value
FROM sales s
LEFT JOIN sales_detail sd ON sd.sales_id = s.sales_id
GROUP BY EXTRACT(YEAR FROM s.sales_date), EXTRACT(MONTH FROM s.sales_date), TO_CHAR(s.sales_date, 'Month YYYY')
ORDER BY sales_year DESC, sales_month DESC;

COMMENT ON VIEW v_monthly_sales IS 'Monthly revenue summary for high-level management reporting.';


-- ============================================================================
-- 5. VIEW: v_product_wise_sales
-- Purpose: Product performance analysis: units sold, revenue generated,
--          order frequency, current stock, and inventory turnover ratio.
-- ============================================================================
CREATE OR REPLACE VIEW v_product_wise_sales AS
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    sup.supplier_name,
    p.unit_price,
    COALESCE(SUM(sd.quantity), 0)                                     AS units_sold,
    ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)            AS gross_revenue,
    ROUND(COALESCE(SUM(sd.discount), 0), 2)                            AS total_discounts,
    ROUND(COALESCE(SUM(sd.sub_total), 0), 2)                           AS net_revenue,
    COUNT(DISTINCT sd.sales_id)                                        AS total_orders_count,
    COALESCE(i.quantity_in_hand, 0)                                    AS current_stock_in_hand,
    CASE
        WHEN COALESCE(i.quantity_in_hand, 0) > 0
        THEN ROUND(COALESCE(SUM(sd.quantity), 0)::NUMERIC / i.quantity_in_hand, 2)
        ELSE 0.00
    END AS stock_turnover_ratio
FROM product p
JOIN category c          ON c.category_id = p.category_id
JOIN supplier sup        ON sup.supplier_id = p.supplier_id
LEFT JOIN inventory i    ON i.product_id = p.product_id
LEFT JOIN sales_detail sd ON sd.product_id = p.product_id
GROUP BY p.product_id, p.product_name, c.category_name, sup.supplier_name, p.unit_price, i.quantity_in_hand
ORDER BY net_revenue DESC;

COMMENT ON VIEW v_product_wise_sales IS 'Item-level sales performance, volume velocity, and inventory turnover.';


-- ============================================================================
-- 6. VIEW: v_top_customers
-- Purpose: Customer relationship management (CRM) view identifying high-value
--          shoppers, purchase frequency, order recency, and customer tiers.
-- ============================================================================
CREATE OR REPLACE VIEW v_top_customers AS
SELECT
    c.customer_id,
    c.customer_name,
    c.phone,
    c.email,
    c.address,
    COUNT(s.sales_id)                                              AS total_orders,
    ROUND(COALESCE(SUM(s.total_amount), 0), 2)                     AS total_spent,
    ROUND(AVG(s.total_amount), 2)                                  AS avg_order_value,
    MIN(s.sales_date)                                              AS first_purchase_date,
    MAX(s.sales_date)                                              AS latest_purchase_date,
    CASE
        WHEN COALESCE(SUM(s.total_amount), 0) >= 15000 THEN 'Platinum VIP'
        WHEN COALESCE(SUM(s.total_amount), 0) >= 8000  THEN 'Gold'
        WHEN COALESCE(SUM(s.total_amount), 0) >= 3000  THEN 'Silver'
        ELSE 'Bronze'
    END AS customer_tier
FROM customer c
JOIN sales s ON s.customer_id = c.customer_id
GROUP BY c.customer_id, c.customer_name, c.phone, c.email, c.address
ORDER BY total_spent DESC;

COMMENT ON VIEW v_top_customers IS 'Customer loyalty metrics ranking shoppers by gross lifetime value.';


-- ============================================================================
-- 7. VIEW: v_supplier_product_map
-- Purpose: Vendor assessment view showing catalog breadth, inventory values,
--          and low-stock alerts tied to each supplier.
-- ============================================================================
CREATE OR REPLACE VIEW v_supplier_product_map AS
SELECT
    sup.supplier_id,
    sup.supplier_name,
    sup.phone                                                   AS supplier_phone,
    sup.email                                                   AS supplier_email,
    COUNT(p.product_id)                                         AS total_products_supplied,
    STRING_AGG(DISTINCT c.category_name, ', ')                  AS categories_supplied,
    COALESCE(SUM(i.quantity_in_hand), 0)                        AS total_stock_units,
    ROUND(COALESCE(SUM(i.quantity_in_hand * p.unit_price), 0), 2) AS total_stock_value,
    COUNT(CASE WHEN i.quantity_in_hand <= p.reorder_level THEN 1 END) AS low_stock_item_count
FROM supplier sup
LEFT JOIN product p   ON p.supplier_id = sup.supplier_id
LEFT JOIN category c  ON c.category_id = p.category_id
LEFT JOIN inventory i ON i.product_id = p.product_id
GROUP BY sup.supplier_id, sup.supplier_name, sup.phone, sup.email
ORDER BY total_stock_value DESC;

COMMENT ON VIEW v_supplier_product_map IS 'Vendor catalog representation, supplier risk profile, and aggregate holding value.';


-- ============================================================================
-- 8. VIEW: v_category_revenue
-- Purpose: Category revenue distribution, gross profit metrics, and percentage
--          contribution to total store turnover.
-- ============================================================================
CREATE OR REPLACE VIEW v_category_revenue AS
WITH total_store_sales AS (
    SELECT NULLIF(SUM(sub_total), 0) AS grand_total FROM sales_detail
)
SELECT
    c.category_id,
    c.category_name,
    COUNT(DISTINCT p.product_id)                                  AS total_products_in_catalog,
    COALESCE(SUM(sd.quantity), 0)                                 AS units_sold,
    ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)        AS gross_revenue,
    ROUND(COALESCE(SUM(sd.discount), 0), 2)                       AS discount_given,
    ROUND(COALESCE(SUM(sd.sub_total), 0), 2)                      AS net_revenue,
    ROUND(
        COALESCE(SUM(sd.sub_total), 0) * 100.0 / (SELECT grand_total FROM total_store_sales),
        2
    ) AS pct_of_total_revenue
FROM category c
LEFT JOIN product p       ON p.category_id = c.category_id
LEFT JOIN sales_detail sd ON sd.product_id = p.product_id
GROUP BY c.category_id, c.category_name
ORDER BY net_revenue DESC;

COMMENT ON VIEW v_category_revenue IS 'Revenue breakdown by department with market share percentage of overall sales.';
