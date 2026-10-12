import os
import pymysql
import json
import random
from datetime import datetime, timedelta

def load_env():
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

def get_connection(db=None):
    return pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', os.getenv('MYSQL_PASSWORD', '')),
        database=db,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def setup_database():
    print("Connecting to MySQL server...")
    conn = get_connection()
    cur = conn.cursor()

    print("Creating database retail_db...")
    cur.execute("CREATE DATABASE IF NOT EXISTS retail_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    conn.close()

    conn = get_connection(db='retail_db')
    cur = conn.cursor()

    print("Dropping existing tables and triggers if any...")
    cur.execute("SET FOREIGN_KEY_CHECKS = 0;")
    tables = [
        "audit_log", "stock_alert", "payment", "sales_detail",
        "sales", "customer", "inventory", "product", "category", "supplier"
    ]
    for t in tables:
        cur.execute(f"DROP TABLE IF EXISTS {t};")
    
    views = [
        "v_low_stock", "v_inventory_valuation", "v_daily_sales",
        "v_monthly_sales", "v_product_wise_sales", "v_top_customers",
        "v_supplier_product_map", "v_category_revenue"
    ]
    for v in views:
        cur.execute(f"DROP VIEW IF EXISTS {v};")

    procs = ["sp_create_sale", "sp_process_return", "sp_receive_shipment"]
    for p in procs:
        cur.execute(f"DROP PROCEDURE IF EXISTS {p};")
    cur.execute("SET FOREIGN_KEY_CHECKS = 1;")

    print("Creating tables...")

    # 1. SUPPLIER
    cur.execute("""
    CREATE TABLE supplier (
        supplier_id   INT AUTO_INCREMENT PRIMARY KEY,
        supplier_name VARCHAR(100) NOT NULL,
        phone         VARCHAR(20)  NOT NULL,
        email         VARCHAR(100) NOT NULL UNIQUE,
        address       TEXT         NOT NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
    """)

    # 2. CATEGORY
    cur.execute("""
    CREATE TABLE category (
        category_id   INT AUTO_INCREMENT PRIMARY KEY,
        category_name VARCHAR(50)  NOT NULL UNIQUE,
        description   TEXT,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
    """)

    # 3. PRODUCT
    cur.execute("""
    CREATE TABLE product (
        product_id    INT AUTO_INCREMENT PRIMARY KEY,
        product_name  VARCHAR(150)   NOT NULL,
        category_id   INT            NOT NULL,
        supplier_id   INT            NOT NULL,
        unit_price    DECIMAL(10, 2) NOT NULL,
        reorder_level INT            NOT NULL DEFAULT 10,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_prod_cat (category_id),
        INDEX idx_prod_sup (supplier_id),
        INDEX idx_prod_name (product_name),
        CONSTRAINT fk_product_category FOREIGN KEY (category_id)
            REFERENCES category (category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id)
            REFERENCES supplier (supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT chk_product_unit_price CHECK (unit_price > 0),
        CONSTRAINT chk_product_reorder_level CHECK (reorder_level >= 0)
    ) ENGINE=InnoDB;
    """)

    # 4. INVENTORY
    cur.execute("""
    CREATE TABLE inventory (
        inventory_id     INT AUTO_INCREMENT PRIMARY KEY,
        product_id       INT      NOT NULL UNIQUE,
        quantity_in_hand INT      NOT NULL DEFAULT 0,
        last_updated     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_inventory_product FOREIGN KEY (product_id)
            REFERENCES product (product_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT chk_inventory_qty CHECK (quantity_in_hand >= 0)
    ) ENGINE=InnoDB;
    """)

    # 5. CUSTOMER
    cur.execute("""
    CREATE TABLE customer (
        customer_id   INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(100) NOT NULL,
        phone         VARCHAR(20)  NOT NULL UNIQUE,
        email         VARCHAR(100),
        address       TEXT,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cust_phone (phone)
    ) ENGINE=InnoDB;
    """)

    # 6. SALES
    cur.execute("""
    CREATE TABLE sales (
        sales_id     INT AUTO_INCREMENT PRIMARY KEY,
        customer_id  INT            NOT NULL,
        sales_date   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        INDEX idx_sales_cust (customer_id),
        INDEX idx_sales_date (sales_date),
        INDEX idx_sales_date_total (sales_date, total_amount),
        CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id)
            REFERENCES customer (customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT chk_sales_total CHECK (total_amount >= 0)
    ) ENGINE=InnoDB;
    """)

    # 7. SALES_DETAIL
    cur.execute("""
    CREATE TABLE sales_detail (
        sales_detail_id INT AUTO_INCREMENT PRIMARY KEY,
        sales_id        INT            NOT NULL,
        product_id      INT            NOT NULL,
        quantity        INT            NOT NULL,
        unit_price      DECIMAL(10, 2) NOT NULL,
        discount        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        sub_total       DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        INDEX idx_sd_sales (sales_id),
        INDEX idx_sd_prod (product_id),
        CONSTRAINT fk_detail_sales FOREIGN KEY (sales_id)
            REFERENCES sales (sales_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_detail_product FOREIGN KEY (product_id)
            REFERENCES product (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT chk_detail_quantity CHECK (quantity > 0),
        CONSTRAINT chk_detail_unit_price CHECK (unit_price >= 0),
        CONSTRAINT chk_detail_discount CHECK (discount >= 0),
        CONSTRAINT chk_detail_sub_total CHECK (sub_total >= 0)
    ) ENGINE=InnoDB;
    """)

    # 8. PAYMENT
    cur.execute("""
    CREATE TABLE payment (
        payment_id   INT AUTO_INCREMENT PRIMARY KEY,
        sales_id     INT            NOT NULL UNIQUE,
        payment_date DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        amount       DECIMAL(12, 2) NOT NULL,
        payment_mode VARCHAR(20)    NOT NULL,
        reference_no VARCHAR(100),
        INDEX idx_payment_sales (sales_id),
        CONSTRAINT fk_payment_sales FOREIGN KEY (sales_id)
            REFERENCES sales (sales_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT chk_payment_amount CHECK (amount >= 0),
        CONSTRAINT chk_payment_mode CHECK (payment_mode IN ('Cash', 'Card', 'UPI', 'NetBanking'))
    ) ENGINE=InnoDB;
    """)

    # 9. STOCK_ALERT
    cur.execute("""
    CREATE TABLE stock_alert (
        alert_id           INT AUTO_INCREMENT PRIMARY KEY,
        product_id         INT         NOT NULL,
        quantity_at_alert  INT         NOT NULL,
        reorder_level      INT         NOT NULL,
        alert_date         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        alert_message      TEXT        NOT NULL,
        status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        INDEX idx_alert_prod (product_id),
        INDEX idx_alert_status (status, alert_date),
        CONSTRAINT fk_stock_alert_product FOREIGN KEY (product_id)
            REFERENCES product (product_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT chk_stock_alert_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED'))
    ) ENGINE=InnoDB;
    """)

    # 10. AUDIT_LOG
    cur.execute("""
    CREATE TABLE audit_log (
        log_id     INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(50)  NOT NULL,
        action     VARCHAR(10)  NOT NULL,
        record_id  INT          NOT NULL,
        old_data   JSON,
        new_data   JSON,
        changed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50)  NOT NULL DEFAULT 'app_user',
        INDEX idx_audit_table_rec (table_name, record_id),
        CONSTRAINT chk_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
    ) ENGINE=InnoDB;
    """)

    print("Creating Triggers...")
    # Subtotal triggers
    cur.execute("""
    CREATE TRIGGER trg_calc_sales_detail_subtotal_ins
    BEFORE INSERT ON sales_detail
    FOR EACH ROW
    BEGIN
        IF NEW.discount IS NULL THEN
            SET NEW.discount = 0.00;
        END IF;
        IF NEW.discount > (NEW.quantity * NEW.unit_price) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Discount cannot exceed line price';
        END IF;
        SET NEW.sub_total = ROUND((NEW.quantity * NEW.unit_price) - NEW.discount, 2);
    END;
    """)

    cur.execute("""
    CREATE TRIGGER trg_calc_sales_detail_subtotal_upd
    BEFORE UPDATE ON sales_detail
    FOR EACH ROW
    BEGIN
        IF NEW.discount IS NULL THEN
            SET NEW.discount = 0.00;
        END IF;
        IF NEW.discount > (NEW.quantity * NEW.unit_price) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Discount cannot exceed line price';
        END IF;
        SET NEW.sub_total = ROUND((NEW.quantity * NEW.unit_price) - NEW.discount, 2);
    END;
    """)

    print("Creating Views...")
    # 1. v_low_stock
    cur.execute("""
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
    """)

    # 2. v_inventory_valuation
    cur.execute("""
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
    """)

    # 3. v_daily_sales
    cur.execute("""
    CREATE OR REPLACE VIEW v_daily_sales AS
    SELECT
        DATE(s.sales_date)                                              AS sale_date,
        COUNT(DISTINCT s.sales_id)                                      AS total_orders,
        COALESCE(SUM(sd.quantity), 0)                                   AS total_units_sold,
        ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)          AS gross_revenue,
        ROUND(COALESCE(SUM(sd.discount), 0), 2)                         AS total_discounts,
        ROUND(COALESCE(SUM(s.total_amount), 0), 2)                      AS net_revenue,
        ROUND(AVG(s.total_amount), 2)                                   AS avg_order_value
    FROM sales s
    LEFT JOIN sales_detail sd ON sd.sales_id = s.sales_id
    GROUP BY DATE(s.sales_date)
    ORDER BY sale_date DESC;
    """)

    # 4. v_monthly_sales
    cur.execute("""
    CREATE OR REPLACE VIEW v_monthly_sales AS
    SELECT
        YEAR(s.sales_date)                                             AS sales_year,
        MONTH(s.sales_date)                                            AS sales_month,
        DATE_FORMAT(s.sales_date, '%M %Y')                             AS month_label,
        COUNT(DISTINCT s.sales_id)                                     AS total_orders,
        COALESCE(SUM(sd.quantity), 0)                                  AS total_units_sold,
        ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)         AS gross_revenue,
        ROUND(COALESCE(SUM(sd.discount), 0), 2)                        AS total_discounts,
        ROUND(COALESCE(SUM(s.total_amount), 0), 2)                     AS net_revenue,
        ROUND(AVG(s.total_amount), 2)                                  AS avg_order_value
    FROM sales s
    LEFT JOIN sales_detail sd ON sd.sales_id = s.sales_id
    GROUP BY YEAR(s.sales_date), MONTH(s.sales_date), DATE_FORMAT(s.sales_date, '%M %Y')
    ORDER BY sales_year DESC, sales_month DESC;
    """)

    # 5. v_product_wise_sales
    cur.execute("""
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
            THEN ROUND(COALESCE(SUM(sd.quantity), 0) / i.quantity_in_hand, 2)
            ELSE 0.00
        END AS stock_turnover_ratio
    FROM product p
    JOIN category c          ON c.category_id = p.category_id
    JOIN supplier sup        ON sup.supplier_id = p.supplier_id
    LEFT JOIN inventory i    ON i.product_id = p.product_id
    LEFT JOIN sales_detail sd ON sd.product_id = p.product_id
    GROUP BY p.product_id, p.product_name, c.category_name, sup.supplier_name, p.unit_price, i.quantity_in_hand
    ORDER BY net_revenue DESC;
    """)

    # 6. v_top_customers
    cur.execute("""
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
    """)

    # 7. v_supplier_product_map
    cur.execute("""
    CREATE OR REPLACE VIEW v_supplier_product_map AS
    SELECT
        sup.supplier_id,
        sup.supplier_name,
        sup.phone                                                   AS supplier_phone,
        sup.email                                                   AS supplier_email,
        COUNT(p.product_id)                                         AS total_products_supplied,
        GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ')       AS categories_supplied,
        COALESCE(SUM(i.quantity_in_hand), 0)                        AS total_stock_units,
        ROUND(COALESCE(SUM(i.quantity_in_hand * p.unit_price), 0), 2) AS total_stock_value,
        COUNT(CASE WHEN i.quantity_in_hand <= p.reorder_level THEN 1 END) AS low_stock_item_count
    FROM supplier sup
    LEFT JOIN product p   ON p.supplier_id = sup.supplier_id
    LEFT JOIN category c  ON c.category_id = p.category_id
    LEFT JOIN inventory i ON i.product_id = p.product_id
    GROUP BY sup.supplier_id, sup.supplier_name, sup.phone, sup.email
    ORDER BY total_stock_value DESC;
    """)

    # 8. v_category_revenue
    cur.execute("""
    CREATE OR REPLACE VIEW v_category_revenue AS
    SELECT
        c.category_id,
        c.category_name,
        COUNT(DISTINCT p.product_id)                                  AS total_products_in_catalog,
        COALESCE(SUM(sd.quantity), 0)                                 AS units_sold,
        ROUND(COALESCE(SUM(sd.quantity * sd.unit_price), 0), 2)        AS gross_revenue,
        ROUND(COALESCE(SUM(sd.discount), 0), 2)                       AS discount_given,
        ROUND(COALESCE(SUM(sd.sub_total), 0), 2)                      AS net_revenue,
        ROUND(
            COALESCE(SUM(sd.sub_total), 0) * 100.0 / NULLIF((SELECT SUM(sub_total) FROM sales_detail), 0),
            2
        ) AS pct_of_total_revenue
    FROM category c
    LEFT JOIN product p       ON p.category_id = c.category_id
    LEFT JOIN sales_detail sd ON sd.product_id = p.product_id
    GROUP BY c.category_id, c.category_name
    ORDER BY net_revenue DESC;
    """)

    print("Creating Stored Procedures...")
    cur.execute("""
    CREATE PROCEDURE sp_process_return(IN p_detail_id INT, IN p_return_qty INT)
    BEGIN
        DECLARE v_pid INT;
        DECLARE v_old_qty INT;
        DECLARE v_uprice DECIMAL(10,2);
        DECLARE v_disc DECIMAL(10,2);
        DECLARE v_sid INT;
        
        SELECT product_id, quantity, unit_price, discount, sales_id 
        INTO v_pid, v_old_qty, v_uprice, v_disc, v_sid
        FROM sales_detail WHERE sales_detail_id = p_detail_id;
        
        IF v_pid IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Line item not found.';
        END IF;
        
        IF p_return_qty <= 0 OR p_return_qty > v_old_qty THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid return quantity.';
        END IF;
        
        -- Restock
        UPDATE inventory SET quantity_in_hand = quantity_in_hand + p_return_qty WHERE product_id = v_pid;
        
        -- Adjust or delete line item
        IF p_return_qty = v_old_qty THEN
            DELETE FROM sales_detail WHERE sales_detail_id = p_detail_id;
        ELSE
            UPDATE sales_detail 
            SET quantity = quantity - p_return_qty,
                sub_total = ROUND((quantity - p_return_qty) * v_uprice - v_disc, 2)
            WHERE sales_detail_id = p_detail_id;
        END IF;
        
        -- Resync sales header total
        UPDATE sales SET total_amount = (SELECT COALESCE(SUM(sub_total), 0) FROM sales_detail WHERE sales_id = v_sid)
        WHERE sales_id = v_sid;
        
        -- Resync payment amount
        UPDATE payment SET amount = (SELECT total_amount FROM sales WHERE sales_id = v_sid)
        WHERE sales_id = v_sid;
    END;
    """)

    cur.execute("""
    CREATE PROCEDURE sp_receive_shipment(IN p_product_id INT, IN p_quantity INT)
    BEGIN
        IF p_quantity <= 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be positive.';
        END IF;
        
        UPDATE inventory SET quantity_in_hand = quantity_in_hand + p_quantity WHERE product_id = p_product_id;
        UPDATE stock_alert SET status = 'RESOLVED' WHERE product_id = p_product_id AND status = 'PENDING';
    END;
    """)

    print("Seeding Master Data...")
    # 1. Categories
    categories = [
        ('Grocery & Staples', 'Daily essential grains, flours, edible oils, pulses, and pantry essentials.'),
        ('Dairy & Breakfast', 'Fresh milk, butter, cheese, yogurt, cereals, oats, and morning nutrition.'),
        ('Snacks & Confectionery', 'Traditional namkeens, chips, biscuits, cookies, chocolates, and sweets.'),
        ('Beverages & Drinks', 'Tea, premium coffee, fruit juices, cold beverages, and herbal cordials.'),
        ('Personal Care & Hygiene', 'Soaps, body washes, hair oils, shampoos, toothpastes, and skincare.'),
        ('Home Care & Cleaning', 'Laundry detergents, dishwash gels, floor disinfectants, and toilet cleaners.'),
        ('Spices & Condiments', 'Pure and blended ground spices, culinary pastes, ketchups, and sauces.'),
        ('Packaged & Instant Foods', 'Instant noodles, ready-to-eat meals, instant soups, and vermicelli.')
    ]
    cur.executemany("INSERT INTO category (category_name, description) VALUES (%s, %s)", categories)

    # 2. Suppliers
    suppliers = [
        ('ITC Limited', '+91 33 2288 9371', 'procurement@itc.in', 'Virginia House, 37 J.L. Nehru Road, Kolkata, West Bengal - 700071'),
        ('Tata Consumer Products', '+91 22 6665 8282', 'fmcg.orders@tataconsumer.com', '11/13 Botawala Building, Horniman Circle, Fort, Mumbai, Maharashtra - 400001'),
        ('Hindustan Unilever Limited', '+91 22 5043 0000', 'distributors@hul.co.in', 'Unilever House, B.D. Sawant Marg, Chakala, Andheri East, Mumbai, Maharashtra - 400099'),
        ('Nestle India Limited', '+91 124 238 9300', 'institutional.sales@in.nestle.com', 'Nestle House, Jacaranda Marg, M Block, DLF Phase 2, Gurugram, Haryana - 122002'),
        ('Britannia Industries', '+91 80 3768 7100', 'orders@britannia.co.in', 'Prestige Shantiniketan, Whitefield Main Road, Bengaluru, Karnataka - 560048'),
        ('Gujarat Co-operative Milk (Amul)', '+91 2692 258506', 'supplychain@amul.coop', 'Amul Dairy Road, Anand, Gujarat - 388001'),
        ('Parle Products Pvt Ltd', '+91 22 6691 6911', 'b2b@parle.biz', 'North Level Crossing, Vile Parle East, Mumbai, Maharashtra - 400057'),
        ('Dabur India Limited', '+91 120 398 2000', 'institutional@dabur.com', '8/3 Asaf Ali Road, New Delhi / Kaushambi, Ghaziabad, UP - 201010'),
        ('Marico Limited', '+91 22 6648 0480', 'consumer.supplies@marico.com', 'Grande Palladium, 175 CST Road, Kalina, Santacruz East, Mumbai, Maharashtra - 400098'),
        ('Godrej Consumer Products', '+91 22 2518 8010', 'trade.desk@godrejcp.com', 'Godrej One, Pirojshanagar, Eastern Express Highway, Vikhroli, Mumbai, Maharashtra - 400079')
    ]
    cur.executemany("INSERT INTO supplier (supplier_name, phone, email, address) VALUES (%s, %s, %s, %s)", suppliers)

    # 3. Products (60 products)
    products = [
        # Cat 1: Grocery & Staples
        ('Aashirvaad Superior MP Shudh Chakki Atta 5kg', 1, 1, 245.00, 15),
        ('Fortune Sunlite Refined Sunflower Oil 1L', 1, 2, 145.00, 20),
        ('Tata Salt Vacuum Evaporated Iodised 1kg', 1, 2, 28.00, 30),
        ('Daawat Rozana Super Basmati Rice 5kg', 1, 1, 395.00, 12),
        ('Tata Sampann Unpolished Toor Dal 1kg', 1, 2, 185.00, 15),
        ('Rajdhani Pure Chana Dal Besan 1kg', 1, 1, 115.00, 15),
        ('Madhur Pure & Hygienic Refined Sugar 1kg', 1, 1, 55.00, 25),
        ('Fortune Kachi Ghani Pure Mustard Oil 1L', 1, 2, 165.00, 20),

        # Cat 2: Dairy & Breakfast
        ('Amul Butter Pasteurized Table Butter 500g', 2, 6, 275.00, 25),
        ('Amul Taaza Homogenised Toned Milk 1L', 2, 6, 74.00, 30),
        ('Amul Masti Dahi Fresh Curd 400g', 2, 6, 40.00, 20),
        ('Amul Malai Fresh Paneer 200g', 2, 6, 95.00, 15),
        ('Britannia Pure Cheese Slices 200g (10 Slices)', 2, 5, 145.00, 15),
        ('Mother Dairy Daily Classic Cow Milk 1L', 2, 6, 58.00, 20),
        ('Kellogg\'s Corn Flakes Original 875g', 2, 4, 340.00, 10),
        ('Quaker Rolled Wholegrain Oats 1kg', 2, 4, 190.00, 15),

        # Cat 3: Snacks & Confectionery
        ('Britannia Good Day Butter Cookies 600g', 3, 5, 120.00, 25),
        ('Parle-G Gold Glucose Biscuits 1kg Family Pack', 3, 7, 100.00, 40),
        ('Haldiram\'s Nagpur Aloo Bhujia 400g', 3, 7, 110.00, 30),
        ('Haldiram\'s All-In-One Mixture Namkeen 400g', 3, 7, 115.00, 25),
        ('Cadbury Dairy Milk Silk Chocolate 150g', 3, 4, 175.00, 20),
        ('Lay\'s India\'s Magic Masala Potato Chips 90g', 3, 4, 40.00, 35),
        ('Sunfeast Dark Fantasy Choco Fills 300g', 3, 1, 140.00, 20),
        ('Kurkure Masala Munch Crispy Snack 85g', 3, 4, 20.00, 40),

        # Cat 4: Beverages & Drinks
        ('Tata Tea Gold Rich Assam Leaf Tea 500g', 4, 2, 310.00, 20),
        ('Brooke Bond Red Label Natural Care Tea 500g', 4, 3, 290.00, 20),
        ('Nescafe Classic 100% Pure Instant Coffee 200g Jar', 4, 4, 385.00, 15),
        ('BRU Instant Rich & Aromatic Coffee 200g', 4, 3, 340.00, 15),
        ('Real Fruit Power Mixed Fruit Juice 1L', 4, 8, 120.00, 25),
        ('Tropicana 100% Squeezed Orange Juice 1L', 4, 4, 135.00, 20),
        ('Bournvita Pro-Health Chocolate Drink Mix 1kg', 4, 4, 420.00, 12),
        ('Horlicks Classic Malt Nutritional Beverage 1kg', 4, 3, 435.00, 12),

        # Cat 5: Personal Care & Hygiene
        ('Dettol Original Germ Protection Bathing Soap (Pack of 4x125g)', 5, 3, 210.00, 25),
        ('Dove Cream Beauty Bathing Bar (Pack of 3x100g)', 5, 3, 225.00, 20),
        ('Head & Shoulders Cool Menthol Anti-Dandruff Shampoo 650ml', 5, 3, 560.00, 10),
        ('Parachute 100% Pure Coconut Hair Oil 500ml', 5, 9, 215.00, 20),
        ('Colgate Strong Teeth Anticavity Toothpaste 500g Saver Saver Pack', 5, 3, 240.00, 25),
        ('Sensodyne Rapid Relief Sensitivity Toothpaste 100g', 5, 3, 210.00, 15),
        ('Dabur Red Ayurvedic Toothpaste 300g', 5, 8, 155.00, 20),
        ('Nivea Soft Light Moisturizing Cream 200ml', 5, 3, 299.00, 15),

        # Cat 6: Home Care & Cleaning
        ('Surf Excel Quick Wash Detergent Powder 2kg', 6, 3, 410.00, 18),
        ('Ariel Matic Top Load Washing Powder 2kg', 6, 3, 440.00, 15),
        ('Vim Dishwash Gel Lemon Anti-Bacterial 750ml', 6, 3, 145.00, 25),
        ('Lizol Disinfectant Floor Cleaner Citrus 2L', 6, 3, 345.00, 15),
        ('Harpic Power Plus Disinfectant Toilet Cleaner 1L', 6, 3, 195.00, 20),
        ('Comfort After-Wash Morning Fresh Fabric Conditioner 860ml', 6, 3, 220.00, 15),
        ('Goodknight Gold Flash Mosquito Repellent Vaporizer Refill (Pack of 2)', 6, 10, 150.00, 25),
        ('HIT Flying Insect & Mosquito Spray Killer 625ml', 6, 10, 280.00, 15),

        # Cat 7: Spices & Condiments
        ('Catch Pure Turmeric Powder Haldi 500g', 7, 2, 135.00, 20),
        ('Everest Kashmirilal Kashmiri Red Chilli Powder 500g', 7, 2, 280.00, 15),
        ('Tata Sampann Pure Coriander Powder Dhania 500g', 7, 2, 140.00, 20),
        ('MDH Deggi Mirch Blend Chilli Powder 100g', 7, 2, 85.00, 25),
        ('Kissan Fresh Tomato Ketchup Bottle 1.2kg', 7, 3, 145.00, 20),
        ('Maggi Rich Tomato Sauce Pitcher 1kg', 7, 4, 135.00, 20),
        ('Dabur Hommade Ginger Garlic Paste 200g Pouch', 7, 8, 48.00, 30),
        ('Saffola Aura Extra Virgin Spanish Olive Oil 500ml', 7, 9, 650.00, 8),

        # Cat 8: Packaged & Instant Foods
        ('Maggi 2-Minute Masala Instant Noodles (Pack of 12x70g)', 8, 4, 168.00, 35),
        ('Sunfeast Yippee! Mood Masala Instant Noodles (Pack of 8)', 8, 1, 110.00, 30),
        ('Knorr Classic Thick Mixed Vegetable Soup 4x43g', 8, 3, 130.00, 20),
        ('MTR Instant Ready Rava Idli Breakfast Mix 1kg', 8, 2, 180.00, 15)
    ]
    cur.executemany("""
    INSERT INTO product (product_name, category_id, supplier_id, unit_price, reorder_level)
    VALUES (%s, %s, %s, %s, %s)
    """, products)

    # 4. Inventory initialization (60 items)
    inventory_data = [
        (1, 45), (2, 60), (3, 85), (4, 38), (5, 52), (6, 40), (7, 75), (8, 50),
        (9, 65), (10, 80), (11, 45), (12, 35), (13, 40), (14, 55), (15, 28), (16, 32),
        (17, 70), (18, 110), (19, 85), (20, 65), (21, 50), (22, 90), (23, 45), (24, 120),
        (25, 55), (26, 60), (27, 40), (28, 35), (29, 65), (30, 48), (31, 30), (32, 28),
        (33, 75), (34, 60), (35, 25), (36, 50), (37, 70), (38, 35), (39, 45), (40, 38),
        (41, 45), (42, 35), (43, 60), (44, 40), (45, 55), (46, 38), (47, 65), (48, 40),
        (49, 50), (50, 42), (51, 48), (52, 60), (53, 55), (54, 48), (55, 75), (56, 18),
        (57, 95), (58, 80), (59, 45), (60, 35)
    ]
    cur.executemany("INSERT INTO inventory (product_id, quantity_in_hand) VALUES (%s, %s)", inventory_data)

    # 5. Customers (40 customers)
    customers = [
        ('Aarav Sharma', '+91 98201 11221', 'aarav.sharma@gmail.com', 'Flat 402, Sea Breeze Apts, Bandra West, Mumbai, Maharashtra'),
        ('Priya Patel', '+91 98250 22332', 'priya.patel92@yahoo.com', 'B-14, Shivalik Residency, Satellite, Ahmedabad, Gujarat'),
        ('Rajesh Iyer', '+91 98401 33443', 'iyer.rajesh@rediffmail.com', '12/4, 2nd Main Road, R.A. Puram, Chennai, Tamil Nadu'),
        ('Ananya Gupta', '+91 98111 44554', 'ananya.gupta@outlook.com', 'C-48, Sector 14, Noida, Gautam Buddha Nagar, UP'),
        ('Vikram Singh', '+91 98290 55665', 'vikram.rathore@gmail.com', '78, Civil Lines, Near High Court, Jaipur, Rajasthan'),
        ('Meera Nair', '+91 98470 66776', 'meera.nair88@gmail.com', 'Plot 21, Panampilly Nagar, Kochi, Kerala'),
        ('Rohan Mehta', '+91 98202 77887', 'rohan.mehta@techcorp.in', '304, Palm Grove, Hiranandani Estate, Thane West, Maharashtra'),
        ('Sneha Mukherjee', '+91 98300 88998', 'sneha.m@calcutta.edu', '56A, Southern Avenue, Lake Market, Kolkata, West Bengal'),
        ('Deepak Verma', '+91 98100 99009', 'verma.deepak77@gmail.com', 'B-2/104, Safdarjung Enclave, New Delhi - 110029'),
        ('Pooja Reddy', '+91 98490 12345', 'pooja.reddy@hyderabad.org', 'Flat 801, My Home Bhooja, HITEC City, Hyderabad, Telangana'),
        ('Aditya Joshi', '+91 98220 23456', 'aditya.joshi@pune.co.in', '15, Mayur Colony, Kothrud, Pune, Maharashtra'),
        ('Kavita Rao', '+91 98800 34567', 'kavita.rao@blrtech.com', '42, 4th Cross, Indiranagar 1st Stage, Bengaluru, Karnataka'),
        ('Suresh Menon', '+91 98450 45678', 'suresh.menon@gmail.com', 'A-302, Palm Meadows, Whitefield, Bengaluru, Karnataka'),
        ('Sunita Deshmukh', '+91 98230 56789', 'sunita.deshmukh@nagpur.in', 'Plot 9, Shankar Nagar, Nagpur, Maharashtra'),
        ('Amitabh Das', '+91 98310 67890', 'amitabh.das@kolkata.co.in', '88, Salt Lake Sector 2, Bidhannagar, Kolkata, West Bengal'),
        ('Neha Kulkarni', '+91 98221 78901', 'neha.kulkarni@gmail.com', '7, Prabhat Road, Lane 4, Deccan Gymkhana, Pune, Maharashtra'),
        ('Karthik Subbaram', '+91 98410 89012', 'karthik.s@chennai.net', '33, Gandhi Road, T. Nagar, Chennai, Tamil Nadu'),
        ('Divya Nambiar', '+91 98460 90123', 'divya.n@kerala.ac.in', 'TC 14/850, Nandavanam, Thiruvananthapuram, Kerala'),
        ('Gaurav Bhatia', '+91 98112 01234', 'bhatia.gaurav@yahoo.com', 'E-21, Greater Kailash Part 1, New Delhi - 110048'),
        ('Tanvi Hegde', '+91 98860 12341', 'tanvi.hegde@infosys.com', '24, Malleshwaram 8th Cross, Bengaluru, Karnataka'),
        ('Manish Chawla', '+91 98140 23452', 'm.chawla@chandigarh.org', 'House 524, Sector 8-B, Chandigarh - 160018'),
        ('Swati Agarwal', '+91 98260 34563', 'swati.agarwal@indore.in', '102, Saket Nagar, Indore, Madhya Pradesh'),
        ('Rahul Bose', '+91 98301 45674', 'rahul.bose85@gmail.com', '14/1, Ballygunge Circular Road, Kolkata, West Bengal'),
        ('Shalini Tiwari', '+91 98390 56785', 'shalini.tiwari@lucknow.net', 'Flat 101, Rohtas Court, Gomti Nagar, Lucknow, UP'),
        ('Harish Pillai', '+91 98480 67896', 'pillai.harish@gmail.com', 'Plot 120, Road No. 36, Jubilee Hills, Hyderabad, Telangana'),
        ('Shruti Saxena', '+91 98180 78907', 'shruti.saxena@delhi.gov.in', 'A-89, Preet Vihar, Vikas Marg, East Delhi - 110092'),
        ('Nitin Gadre', '+91 98210 89018', 'nitin.gadre@mumbaicorporate.com', '12, Hindu Colony, Dadar East, Mumbai, Maharashtra'),
        ('Aparna Sen', '+91 98302 90129', 'aparna.sen@kolkata.org', 'Flat 5B, South City Towers, Prince Anwar Shah Road, Kolkata'),
        ('Vivek Choudhary', '+91 98291 01230', 'vivek.choudhary@jodhpur.in', '22, Ratanada, Circuit House Road, Jodhpur, Rajasthan'),
        ('Ritu Singhania', '+91 98113 12341', 'ritu.singhania@delhicapital.com', 'D-55, Defense Colony, New Delhi - 110024'),
        ('Ashwin Sundaram', '+91 98402 23452', 'ashwin.sundaram@tcs.com', 'Block 4, Ceebros Boulevard, OMR, Thoraipakkam, Chennai'),
        ('Geeta Marathe', '+91 98222 34563', 'geeta.marathe@nashik.net', '78, Gangapur Road, Anandwalli, Nashik, Maharashtra'),
        ('Siddharth Mishra', '+91 98610 45674', 'sid.mishra@bhubaneswar.in', 'Plot N-3/412, IRC Village, Nayapalli, Bhubaneswar, Odisha'),
        ('Madhuri Dixit-Patil', '+91 98231 56785', 'madhuri.p@aurangabad.org', '14, Samarth Nagar, Chhatrapati Sambhajinagar, Maharashtra'),
        ('Pankaj Tripathi', '+91 94500 67896', 'pankaj.tripathi@patna.biz', 'Flat 203, Maurya Vihar, Bailey Road, Patna, Bihar'),
        ('Bhavna Shah', '+91 98251 78907', 'bhavna.shah@surattextile.in', '701, Green City Tower, Pal Gam, Surat, Gujarat'),
        ('Arjun Kapoor', '+91 98101 89018', 'arjun.kapoor@gurgaonhub.com', 'Tower 3, The Magnolias, Golf Course Road, Gurugram, Haryana'),
        ('Rupa Banerjee', '+91 98303 90129', 'rupa.banerjee@heritage.org', '3, Alipore Park Road, Kolkata, West Bengal - 700027'),
        ('Mahesh Kamat', '+91 98223 01230', 'mahesh.kamat@panaji.goa', 'House 45, Altinho, Panaji, Goa - 403001'),
        ('Preeti Soni', '+91 98292 12341', 'preeti.soni@udaipur.co.in', '28, Saheli Marg, Near Saheliyon Ki Bari, Udaipur, Rajasthan')
    ]
    cur.executemany("INSERT INTO customer (customer_name, phone, email, address) VALUES (%s, %s, %s, %s)", customers)

    # 6. Generate 300 realistic sales orders spanning the past 180 days
    print("Generating 300 realistic historical sales orders with payments...")
    random.seed(42)  # Deterministic seed
    now = datetime.now()
    modes = ['Cash', 'Card', 'UPI', 'NetBanking']

    # Get product price map
    cur.execute("SELECT product_id, unit_price FROM product")
    prod_prices = {r['product_id']: float(r['unit_price']) for r in cur.fetchall()}

    for i in range(1, 301):
        cust_id = (i % 40) + 1
        days_ago = (180.0 * (300 - i) / 300.0) + (random.random() * 0.8)
        hour = 9 + int((i * 7) % 13)
        minute = int((i * 17) % 60)
        sale_time = now - timedelta(days=days_ago)
        sale_time = sale_time.replace(hour=hour, minute=minute, second=0, microsecond=0)

        # Insert sale header
        cur.execute(
            "INSERT INTO sales (customer_id, sales_date, total_amount) VALUES (%s, %s, 0.00)",
            (cust_id, sale_time.strftime('%Y-%m-%d %H:%M:%S'))
        )
        sales_id = cur.lastrowid

        # Insert 1-4 items
        num_items = 1 + int((i * 3) % 4)
        order_total = 0.0
        used_prods = set()

        for slot in range(num_items):
            pid = ((i * 7 + slot * 13) % 60) + 1
            if pid in used_prods:
                pid = (pid % 60) + 1
            used_prods.add(pid)

            qty = 1 + int((i + slot) % 4)
            unit_price = prod_prices[pid]
            disc = 5.0 * (i % 4) if (unit_price * qty) > 100 else 0.0
            sub_total = round((qty * unit_price) - disc, 2)
            if sub_total < 0:
                sub_total = 0.0

            cur.execute("""
            INSERT INTO sales_detail (sales_id, product_id, quantity, unit_price, discount, sub_total)
            VALUES (%s, %s, %s, %s, %s, %s)
            """, (sales_id, pid, qty, unit_price, disc, sub_total))
            order_total += sub_total

        # Update sales header total
        cur.execute("UPDATE sales SET total_amount = %s WHERE sales_id = %s", (round(order_total, 2), sales_id))

        # Insert Payment
        pmode = modes[(i % 4)]
        if pmode == 'Cash':
            ref = f"CASH-POS-{sale_time.strftime('%Y%m%d%H%M')}-{i}"
        else:
            ref = f"{pmode.upper()}-{sale_time.strftime('%Y%m%d%H%M')}-{1000 + i}"

        cur.execute("""
        INSERT INTO payment (sales_id, payment_date, amount, payment_mode, reference_no)
        VALUES (%s, %s, %s, %s, %s)
        """, (sales_id, sale_time.strftime('%Y-%m-%d %H:%M:%S'), round(order_total, 2), pmode, ref))

    # Check for low stock items and insert initial alerts
    cur.execute("""
    INSERT INTO stock_alert (product_id, quantity_at_alert, reorder_level, alert_message, status)
    SELECT p.product_id, i.quantity_in_hand, p.reorder_level, 
           CONCAT('Stock alert for ', p.product_name, ' (', i.quantity_in_hand, ' left, reorder level: ', p.reorder_level, ')'),
           'PENDING'
    FROM product p
    JOIN inventory i ON i.product_id = p.product_id
    WHERE i.quantity_in_hand <= p.reorder_level;
    """)

    # Insert audit logs
    cur.execute("""
    INSERT INTO audit_log (table_name, action, record_id, old_data, new_data, changed_by)
    VALUES ('inventory', 'INSERT', 1, NULL, JSON_OBJECT('status', 'Initial database seeding completed'), 'system_seed');
    """)

    # Verify counts
    print("\n--- DATABASE VERIFICATION SUMMARY ---")
    for t in tables:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {t}")
        cnt = cur.fetchone()['cnt']
        print(f"Table '{t}': {cnt} rows")

    for v in views:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {v}")
        cnt = cur.fetchone()['cnt']
        print(f"View '{v}': {cnt} rows")

    conn.close()
    print("\n[SUCCESS] retail_db successfully initialized and seeded in MySQL!")

if __name__ == '__main__':
    setup_database()
