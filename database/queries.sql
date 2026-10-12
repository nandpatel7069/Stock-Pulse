-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: queries.sql
-- Description: 15 Production-Grade Demonstration Queries showcasing Advanced SQL
--              (JOINs, GROUP BY, HAVING, Correlated Subqueries, CTEs,
--               Recursive CTEs, Window Functions, and Pivots)
-- ============================================================================

-- ============================================================================
-- QUERY 1: Multi-Table INNER JOIN & Invoice Header Reconciliation
-- Concept: INNER JOINs across 5 tables (sales, customer, payment, sales_detail, product)
-- Purpose: Generates a complete invoice summary for recent orders showing customer
--          name, city, line item count, total units, invoice amount, and payment mode.
-- ============================================================================
SELECT
    s.sales_id                                                    AS invoice_no,
    s.sales_date::DATE                                            AS invoice_date,
    c.customer_name,
    c.phone                                                       AS customer_phone,
    COUNT(sd.sales_detail_id)                                     AS distinct_items_count,
    SUM(sd.quantity)                                              AS total_quantity_purchased,
    s.total_amount                                                AS invoice_total_inr,
    p.payment_mode,
    p.reference_no                                                AS payment_ref
FROM sales s
INNER JOIN customer c     ON c.customer_id = s.customer_id
INNER JOIN payment p      ON p.sales_id = s.sales_id
INNER JOIN sales_detail sd ON sd.sales_id = s.sales_id
INNER JOIN product pr     ON pr.product_id = sd.product_id
GROUP BY s.sales_id, s.sales_date, c.customer_name, c.phone, s.total_amount, p.payment_mode, p.reference_no
ORDER BY s.sales_id DESC
LIMIT 10;


-- ============================================================================
-- QUERY 2: Department-Level Sales Volume & Price Range Aggregation
-- Concept: GROUP BY, Aggregation Functions (SUM, COUNT, MIN, MAX, AVG)
-- Purpose: Evaluates merchandise performance per category, showing total units
--          sold, gross sales, average selling price, and category price spread.
-- ============================================================================
SELECT
    cat.category_id,
    cat.category_name,
    COUNT(DISTINCT pr.product_id)                                 AS total_skus_in_cat,
    COUNT(sd.sales_detail_id)                                     AS total_line_orders,
    SUM(sd.quantity)                                              AS total_units_sold,
    ROUND(SUM(sd.sub_total), 2)                                   AS total_net_revenue_inr,
    ROUND(AVG(pr.unit_price), 2)                                  AS avg_catalog_price_inr,
    MIN(pr.unit_price)                                            AS lowest_priced_sku,
    MAX(pr.unit_price)                                            AS highest_priced_sku
FROM category cat
INNER JOIN product pr     ON pr.category_id = cat.category_id
LEFT JOIN sales_detail sd ON sd.product_id = pr.product_id
GROUP BY cat.category_id, cat.category_name
ORDER BY total_net_revenue_inr DESC;


-- ============================================================================
-- QUERY 3: High-Performing Categories Filtered by Volume and Turnover
-- Concept: GROUP BY with HAVING clause
-- Purpose: Filters only top-performing retail categories generating more than
--          ₹35,000 in net revenue with at least 80 units sold.
-- ============================================================================
SELECT
    c.category_name,
    COUNT(DISTINCT s.sales_id)                                    AS total_transactions,
    SUM(sd.quantity)                                              AS total_units_sold,
    ROUND(SUM(sd.sub_total), 2)                                   AS total_category_revenue,
    ROUND(AVG(sd.sub_total), 2)                                   AS avg_line_item_value
FROM category c
JOIN product p       ON p.category_id = c.category_id
JOIN sales_detail sd ON sd.product_id = p.product_id
JOIN sales s         ON s.sales_id = sd.sales_id
GROUP BY c.category_name
HAVING SUM(sd.sub_total) > 35000.00 AND SUM(sd.quantity) >= 80
ORDER BY total_category_revenue DESC;


-- ============================================================================
-- QUERY 4: Correlated Subquery for Premium Products
-- Concept: Correlated Subquery in WHERE clause
-- Purpose: Identifies products priced strictly higher than the average price
--          of all products within their respective category.
-- ============================================================================
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    p.unit_price                                                  AS product_price,
    ROUND((
        SELECT AVG(p_sub.unit_price)
        FROM product p_sub
        WHERE p_sub.category_id = p.category_id
    ), 2)                                                         AS category_avg_price,
    ROUND(p.unit_price - (
        SELECT AVG(p_sub.unit_price)
        FROM product p_sub
        WHERE p_sub.category_id = p.category_id
    ), 2)                                                         AS premium_above_avg
FROM product p
JOIN category c ON c.category_id = p.category_id
WHERE p.unit_price > (
    SELECT AVG(p_sub.unit_price)
    FROM product p_sub
    WHERE p_sub.category_id = p.category_id
)
ORDER BY premium_above_avg DESC
LIMIT 12;


-- ============================================================================
-- QUERY 5: Scalar Subquery Benchmark (Order Value vs Global Store Average)
-- Concept: Scalar Subquery in SELECT clause with Mathematical Deviation
-- Purpose: Computes each order's deviation percentage against the overall store
--          historical Average Order Value (AOV).
-- ============================================================================
SELECT
    s.sales_id,
    s.sales_date::DATE                                            AS order_date,
    c.customer_name,
    s.total_amount                                                AS order_amount,
    ROUND((SELECT AVG(total_amount) FROM sales), 2)               AS store_overall_aov,
    ROUND(s.total_amount - (SELECT AVG(total_amount) FROM sales), 2) AS variance_from_aov,
    ROUND(
        ((s.total_amount - (SELECT AVG(total_amount) FROM sales)) / (SELECT AVG(total_amount) FROM sales)) * 100,
        1
    )                                                             AS pct_variance_from_aov
FROM sales s
JOIN customer c ON c.customer_id = s.customer_id
WHERE s.total_amount > (SELECT AVG(total_amount) FROM sales) * 1.5
ORDER BY s.total_amount DESC
LIMIT 10;


-- ============================================================================
-- QUERY 6: Subquery with IN / NOT IN (Low Stock Risk Supplier Exposure)
-- Concept: Subquery using IN and NOT IN operators
-- Purpose: Lists suppliers who do NOT currently supply any products triggering
--          critical low-stock alerts, identifying risk-resilient vendor partners.
-- ============================================================================
SELECT
    sup.supplier_id,
    sup.supplier_name,
    sup.phone,
    sup.email,
    COUNT(p.product_id)                                           AS active_products_supplied
FROM supplier sup
JOIN product p ON p.supplier_id = sup.supplier_id
WHERE sup.supplier_id NOT IN (
    -- Subquery: Suppliers having any product currently in low_stock status
    SELECT DISTINCT p_alert.supplier_id
    FROM product p_alert
    JOIN inventory inv ON inv.product_id = p_alert.product_id
    WHERE inv.quantity_in_hand <= p_alert.reorder_level
)
GROUP BY sup.supplier_id, sup.supplier_name, sup.phone, sup.email
ORDER BY active_products_supplied DESC;


-- ============================================================================
-- QUERY 7: Cross-Department Shopping Behavior (EXISTS & NOT EXISTS)
-- Concept: Correlated Subqueries using EXISTS and NOT EXISTS
-- Purpose: Identifies cross-selling targets: customers who have purchased
--          Grocery & Staples items, but have NEVER purchased Personal Care items.
-- ============================================================================
SELECT
    c.customer_id,
    c.customer_name,
    c.phone,
    c.email,
    c.address
FROM customer c
WHERE EXISTS (
    -- Has purchased Grocery & Staples (category_id = 1)
    SELECT 1
    FROM sales s
    JOIN sales_detail sd ON sd.sales_id = s.sales_id
    JOIN product p       ON p.product_id = sd.product_id
    WHERE s.customer_id = c.customer_id
      AND p.category_id = 1
)
AND NOT EXISTS (
    -- Has never purchased Personal Care & Hygiene (category_id = 5)
    SELECT 1
    FROM sales s
    JOIN sales_detail sd ON sd.sales_id = s.sales_id
    JOIN product p       ON p.product_id = sd.product_id
    WHERE s.customer_id = c.customer_id
      AND p.category_id = 5
)
ORDER BY c.customer_id ASC
LIMIT 10;


-- ============================================================================
-- QUERY 8: Common Table Expression (CTE) for Month-over-Month Growth Analysis
-- Concept: Non-recursive CTE with Window LAG() function
-- Purpose: Calculates monthly gross revenue, previous month's baseline, and
--          percentage MoM revenue growth rate.
-- ============================================================================
WITH monthly_metrics AS (
    SELECT
        EXTRACT(YEAR FROM sales_date)::INT                       AS yr,
        EXTRACT(MONTH FROM sales_date)::INT                      AS mo,
        TO_CHAR(sales_date, 'Mon YYYY')                          AS month_period,
        COUNT(sales_id)                                          AS order_count,
        ROUND(SUM(total_amount), 2)                              AS monthly_revenue
    FROM sales
    GROUP BY EXTRACT(YEAR FROM sales_date), EXTRACT(MONTH FROM sales_date), TO_CHAR(sales_date, 'Mon YYYY')
),
growth_calculation AS (
    SELECT
        yr,
        mo,
        month_period,
        order_count,
        monthly_revenue,
        LAG(monthly_revenue, 1) OVER (ORDER BY yr, mo)           AS prev_month_revenue
    FROM monthly_metrics
)
SELECT
    month_period,
    order_count,
    monthly_revenue,
    COALESCE(prev_month_revenue, 0.00)                           AS prev_month_revenue,
    ROUND(monthly_revenue - COALESCE(prev_month_revenue, monthly_revenue), 2) AS revenue_delta,
    CASE
        WHEN prev_month_revenue IS NULL OR prev_month_revenue = 0 THEN 0.0
        ELSE ROUND(((monthly_revenue - prev_month_revenue) / prev_month_revenue) * 100, 2)
    END                                                          AS mom_growth_pct
FROM growth_calculation
ORDER BY yr ASC, mo ASC;


-- ============================================================================
-- QUERY 9: Recursive CTE for Continuous 30-Day Daily Sales Trend
-- Concept: Recursive CTE generating a calendar date series without gaps
-- Purpose: Ensures days with zero sales are properly represented in the time
--          series chart, joining against actual sales headers.
-- ============================================================================
WITH RECURSIVE date_spine AS (
    -- Anchor: 30 days ago
    SELECT (CURRENT_DATE - INTERVAL '29 days')::DATE AS timeline_date
    UNION ALL
    -- Recursive member: increment day by day until today
    SELECT (timeline_date + INTERVAL '1 day')::DATE
    FROM date_spine
    WHERE timeline_date < CURRENT_DATE
)
SELECT
    ds.timeline_date                                             AS calendar_day,
    TO_CHAR(ds.timeline_date, 'Day')                             AS day_name,
    COUNT(s.sales_id)                                            AS orders_processed,
    COALESCE(SUM(s.total_amount), 0.00)                          AS daily_turnover_inr
FROM date_spine ds
LEFT JOIN sales s ON s.sales_date::DATE = ds.timeline_date
GROUP BY ds.timeline_date
ORDER BY ds.timeline_date DESC
LIMIT 15;


-- ============================================================================
-- QUERY 10: Window Function: RANK() & DENSE_RANK() Top 3 SKUs per Category
-- Concept: DENSE_RANK() OVER (PARTITION BY category_id ORDER BY revenue DESC)
-- Purpose: Identifies the top 3 best-selling products in every category by total
--          revenue generated.
-- ============================================================================
WITH product_revenue_ranks AS (
    SELECT
        c.category_name,
        p.product_id,
        p.product_name,
        p.unit_price,
        SUM(sd.quantity)                                          AS total_units_sold,
        ROUND(SUM(sd.sub_total), 2)                               AS product_revenue,
        DENSE_RANK() OVER (
            PARTITION BY c.category_id
            ORDER BY SUM(sd.sub_total) DESC
        )                                                         AS rank_in_category
    FROM category c
    JOIN product p       ON p.category_id = c.category_id
    JOIN sales_detail sd ON sd.product_id = p.product_id
    GROUP BY c.category_id, c.category_name, p.product_id, p.product_name, p.unit_price
)
SELECT
    category_name,
    rank_in_category,
    product_name,
    unit_price,
    total_units_sold,
    product_revenue
FROM product_revenue_ranks
WHERE rank_in_category <= 3
ORDER BY category_name, rank_in_category;


-- ============================================================================
-- QUERY 11: Window Function: Cumulative Running Total of Sales Revenue
-- Concept: SUM() OVER (ORDER BY sales_date ROWS UNBOUNDED PRECEDING)
-- Purpose: Displays running cumulative financial turnover over time.
-- ============================================================================
WITH daily_totals AS (
    SELECT
        sales_date::DATE                                         AS txn_date,
        COUNT(sales_id)                                          AS daily_orders,
        SUM(total_amount)                                        AS daily_sales
    FROM sales
    GROUP BY sales_date::DATE
)
SELECT
    txn_date,
    daily_orders,
    ROUND(daily_sales, 2)                                        AS daily_revenue,
    ROUND(
        SUM(daily_sales) OVER (
            ORDER BY txn_date ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ),
        2
    )                                                            AS cumulative_running_total
FROM daily_totals
ORDER BY txn_date DESC
LIMIT 15;


-- ============================================================================
-- QUERY 12: Window Function: LAG() for Customer Purchase Cycle Velocity
-- Concept: LAG(sales_date) OVER (PARTITION BY customer_id ORDER BY sales_date)
-- Purpose: Measures days elapsed between consecutive orders for frequent customers
--          to calculate average customer repurchase cycle.
-- ============================================================================
WITH customer_order_timeline AS (
    SELECT
        s.customer_id,
        c.customer_name,
        s.sales_id,
        s.sales_date,
        s.total_amount,
        LAG(s.sales_date, 1) OVER (
            PARTITION BY s.customer_id
            ORDER BY s.sales_date
        )                                                        AS previous_order_date
    FROM sales s
    JOIN customer c ON c.customer_id = s.customer_id
)
SELECT
    customer_name,
    sales_id,
    sales_date::DATE                                             AS order_date,
    previous_order_date::DATE                                    AS prev_order_date,
    ROUND(
        EXTRACT(EPOCH FROM (sales_date - previous_order_date)) / 86400,
        1
    )                                                            AS days_since_last_order,
    total_amount                                                 AS order_total
FROM customer_order_timeline
WHERE previous_order_date IS NOT NULL
ORDER BY customer_id ASC, sales_date DESC
LIMIT 15;


-- ============================================================================
-- QUERY 13: Window Function: NTILE(4) Customer RFM Spending Quartiles
-- Concept: NTILE(4) OVER (ORDER BY total_spent DESC)
-- Purpose: Segments customer base into 4 spending quartiles (VIP, Gold, Silver, Bronze).
-- ============================================================================
WITH customer_expenditure AS (
    SELECT
        c.customer_id,
        c.customer_name,
        c.phone,
        COUNT(s.sales_id)                                        AS total_orders,
        ROUND(SUM(s.total_amount), 2)                            AS total_spent
    FROM customer c
    JOIN sales s ON s.customer_id = c.customer_id
    GROUP BY c.customer_id, c.customer_name, c.phone
)
SELECT
    customer_id,
    customer_name,
    phone,
    total_orders,
    total_spent,
    NTILE(4) OVER (ORDER BY total_spent DESC)                    AS quartile_segment,
    CASE NTILE(4) OVER (ORDER BY total_spent DESC)
        WHEN 1 THEN 'Quartile 1: Platinum VIP (Top 25%)'
        WHEN 2 THEN 'Quartile 2: High Value'
        WHEN 3 THEN 'Quartile 3: Moderate Spender'
        WHEN 4 THEN 'Quartile 4: Casual / New Shopper'
    END                                                          AS segment_label
FROM customer_expenditure
ORDER BY total_spent DESC;


-- ============================================================================
-- QUERY 14: Payment Channel Cross-Tabulation / Pivot via CASE WHEN
-- Concept: Conditional Aggregation (Pivot) with CASE WHEN
-- Purpose: Matrix showing revenue share across Cash, Card, UPI, and NetBanking
--          per calendar month.
-- ============================================================================
SELECT
    TO_CHAR(s.sales_date, 'YYYY-MM')                             AS month_key,
    ROUND(COALESCE(SUM(CASE WHEN p.payment_mode = 'Cash' THEN p.amount END), 0.00), 2)       AS cash_revenue,
    ROUND(COALESCE(SUM(CASE WHEN p.payment_mode = 'Card' THEN p.amount END), 0.00), 2)       AS card_revenue,
    ROUND(COALESCE(SUM(CASE WHEN p.payment_mode = 'UPI' THEN p.amount END), 0.00), 2)        AS upi_revenue,
    ROUND(COALESCE(SUM(CASE WHEN p.payment_mode = 'NetBanking' THEN p.amount END), 0.00), 2) AS netbanking_revenue,
    ROUND(SUM(p.amount), 2)                                                                  AS monthly_total_settled
FROM sales s
JOIN payment p ON p.sales_id = s.sales_id
GROUP BY TO_CHAR(s.sales_date, 'YYYY-MM')
ORDER BY month_key DESC;


-- ============================================================================
-- QUERY 15: Inventory Velocity & Fast vs Slow Mover Classification
-- Concept: Multi-table JOIN with Window/DATEDIFF logic & CASE classification
-- Purpose: Analyzes product sales velocity, days since last purchase, and
--          categorizes inventory into Fast Mover, Active, and Slow Mover.
-- ============================================================================
WITH product_sales_summary AS (
    SELECT
        p.product_id,
        p.product_name,
        c.category_name,
        p.unit_price,
        i.quantity_in_hand,
        COALESCE(SUM(sd.quantity), 0)                             AS total_units_sold,
        MAX(s.sales_date)                                         AS last_sold_date
    FROM product p
    JOIN category c       ON c.category_id = p.category_id
    JOIN inventory i      ON i.product_id = p.product_id
    LEFT JOIN sales_detail sd ON sd.product_id = p.product_id
    LEFT JOIN sales s         ON s.sales_id = sd.sales_id
    GROUP BY p.product_id, p.product_name, c.category_name, p.unit_price, i.quantity_in_hand
)
SELECT
    product_id,
    product_name,
    category_name,
    unit_price,
    quantity_in_hand                                              AS stock_in_hand,
    total_units_sold,
    last_sold_date::DATE                                          AS last_sale_date,
    CURRENT_DATE - last_sold_date::DATE                           AS days_since_last_sale,
    CASE
        WHEN total_units_sold >= 20 THEN 'FAST MOVER (High Velocity)'
        WHEN total_units_sold >= 10 THEN 'REGULAR MOVER (Stable)'
        WHEN total_units_sold > 0   THEN 'SLOW MOVER (Low Velocity)'
        ELSE 'DEAD STOCK (Zero Sales)'
    END                                                           AS inventory_classification
FROM product_sales_summary
ORDER BY total_units_sold DESC, stock_in_hand ASC
LIMIT 15;
