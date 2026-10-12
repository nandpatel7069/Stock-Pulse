-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: schema.sql
-- Description: Core 3NF Relational Database Schema DDL for PostgreSQL 16
-- ============================================================================

-- Clean up existing tables if executing afresh
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS stock_alert CASCADE;
DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS sales_detail CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS customer CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS category CASCADE;
DROP TABLE IF EXISTS supplier CASCADE;

-- ============================================================================
-- 1. SUPPLIER TABLE
-- Purpose: Stores vendor/supplier profiles who supply products to the retail store.
-- 3NF: All attributes functionally depend strictly on the primary key supplier_id.
-- ============================================================================
CREATE TABLE supplier (
    supplier_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    address       TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_supplier_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE supplier IS 'Stores details of merchandise suppliers including contact info and address (3NF entity).';
COMMENT ON COLUMN supplier.supplier_id IS 'Surrogate primary key uniquely identifying a supplier.';
COMMENT ON COLUMN supplier.email IS 'Unique contact email address for vendor communications.';

-- ============================================================================
-- 2. CATEGORY TABLE
-- Purpose: Classifies merchandise into distinct retail departments/categories.
-- 3NF: category_name and description describe the category entity alone.
-- ============================================================================
CREATE TABLE category (
    category_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name VARCHAR(50)  NOT NULL UNIQUE,
    description   TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE category IS 'Catalog classification categories for products (e.g., Dairy, Staples, Personal Care).';
COMMENT ON COLUMN category.category_name IS 'Unique name of the product category.';

-- ============================================================================
-- 3. PRODUCT TABLE
-- Purpose: Catalog of retail items available for sale.
-- 3NF: Normalized by referencing category_id and supplier_id as foreign keys.
-- ON DELETE: RESTRICT prevents orphan records if category/supplier has products.
-- ============================================================================
CREATE TABLE product (
    product_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name  VARCHAR(150)   NOT NULL,
    category_id   INT            NOT NULL,
    supplier_id   INT            NOT NULL,
    unit_price    NUMERIC(10, 2) NOT NULL,
    reorder_level INT            NOT NULL DEFAULT 10,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category FOREIGN KEY (category_id)
        REFERENCES category (category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id)
        REFERENCES supplier (supplier_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_product_unit_price CHECK (unit_price > 0),
    CONSTRAINT chk_product_reorder_level CHECK (reorder_level >= 0)
);

COMMENT ON TABLE product IS 'Master catalog of sellable products, their unit pricing, and reorder thresholds.';
COMMENT ON COLUMN product.unit_price IS 'Standard retail selling price in INR (must be positive).';
COMMENT ON COLUMN product.reorder_level IS 'Minimum inventory threshold below which a replenishment alert is triggered.';

-- ============================================================================
-- 4. INVENTORY TABLE
-- Purpose: Tracks current on-hand warehouse/shelf stock for each product.
-- 3NF: 1-to-1 relationship with product (product_id is UNIQUE).
-- ON DELETE: CASCADE ensures inventory row is removed if product is dropped.
-- ============================================================================
CREATE TABLE inventory (
    inventory_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id       INT         NOT NULL UNIQUE,
    quantity_in_hand INT         NOT NULL DEFAULT 0,
    last_updated     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_inventory_qty CHECK (quantity_in_hand >= 0)
);

COMMENT ON TABLE inventory IS 'Tracks current physical stock quantity in hand per product.';
COMMENT ON COLUMN inventory.quantity_in_hand IS 'Available stock units; cannot be negative (enforced by CHECK constraint).';
COMMENT ON COLUMN inventory.last_updated IS 'Timestamp of the most recent stock movement (sale, return, restock).';

-- ============================================================================
-- 5. CUSTOMER TABLE
-- Purpose: Maintains retail customer profiles and contact details.
-- 3NF: Stores non-transitive customer demographic attributes.
-- ============================================================================
CREATE TABLE customer (
    customer_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    phone         VARCHAR(20)  NOT NULL UNIQUE,
    email         VARCHAR(100),
    address       TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_customer_phone CHECK (phone ~* '^[0-9+ -]{10,15}$')
);

COMMENT ON TABLE customer IS 'Customer master records for loyalty, billing, and communication.';
COMMENT ON COLUMN customer.phone IS 'Unique phone number for customer identification at checkout.';

-- ============================================================================
-- 6. SALES TABLE
-- Purpose: Header record for checkout transactions.
-- 3NF: Contains order-level metadata (date, customer reference, calculated total).
-- ON DELETE: RESTRICT prevents deleting customer with historical purchase history.
-- ============================================================================
CREATE TABLE sales (
    sales_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id  INT            NOT NULL,
    sales_date   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_sales_total CHECK (total_amount >= 0)
);

COMMENT ON TABLE sales IS 'Sales transaction header table recording customer order metadata and invoice amount.';
COMMENT ON COLUMN sales.total_amount IS 'Cumulative invoice total kept synchronized via database triggers.';

-- ============================================================================
-- 7. SALES_DETAIL TABLE
-- Purpose: Itemized line items belonging to a sales transaction header.
-- 3NF: Resolves M:N relationship between Sales and Product.
-- ON DELETE: CASCADE removes line items if parent sale is removed.
--            RESTRICT prevents deleting product with existing sales history.
-- ============================================================================
CREATE TABLE sales_detail (
    sales_detail_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_id        INT            NOT NULL,
    product_id      INT            NOT NULL,
    quantity        INT            NOT NULL,
    unit_price      NUMERIC(10, 2) NOT NULL,
    discount        NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sub_total       NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_detail_sales FOREIGN KEY (sales_id)
        REFERENCES sales (sales_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_detail_product FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_detail_quantity CHECK (quantity > 0),
    CONSTRAINT chk_detail_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_detail_discount CHECK (discount >= 0),
    CONSTRAINT chk_detail_sub_total CHECK (sub_total >= 0)
);

COMMENT ON TABLE sales_detail IS 'Individual line items of a sales transaction with pricing, discounts, and line subtotals.';
COMMENT ON COLUMN sales_detail.sub_total IS 'Net line price (quantity * unit_price - discount) computed via trigger.';

-- ============================================================================
-- 8. PAYMENT TABLE
-- Purpose: Records financial settlement for each completed sale transaction.
-- 3NF: 1-to-1 relationship with sales table (sales_id is UNIQUE).
-- ON DELETE: CASCADE removes payment if the associated sale header is deleted.
-- ============================================================================
CREATE TABLE payment (
    payment_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_id     INT            NOT NULL UNIQUE,
    payment_date TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount       NUMERIC(12, 2) NOT NULL,
    payment_mode VARCHAR(20)    NOT NULL,
    reference_no VARCHAR(100),
    CONSTRAINT fk_payment_sales FOREIGN KEY (sales_id)
        REFERENCES sales (sales_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_payment_amount CHECK (amount >= 0),
    CONSTRAINT chk_payment_mode CHECK (payment_mode IN ('Cash', 'Card', 'UPI', 'NetBanking'))
);

COMMENT ON TABLE payment IS 'Payment receipts capturing settlement amount, transaction mode, and bank/UPI reference numbers.';
COMMENT ON COLUMN payment.payment_mode IS 'Settlement channel: Cash, Card, UPI, or NetBanking.';

-- ============================================================================
-- 9. STOCK_ALERT TABLE
-- Purpose: Logs automated alerts when inventory drops to or below reorder level.
-- Populated automatically via trigger on the inventory table.
-- ============================================================================
CREATE TABLE stock_alert (
    alert_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id         INT         NOT NULL,
    quantity_at_alert  INT         NOT NULL,
    reorder_level      INT         NOT NULL,
    alert_date         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alert_message      TEXT        NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT fk_stock_alert_product FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_stock_alert_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED'))
);

COMMENT ON TABLE stock_alert IS 'Automated notification queue triggered when product stock dips to or below reorder threshold.';

-- ============================================================================
-- 10. AUDIT_LOG TABLE
-- Purpose: Immutable security & compliance ledger tracking DML operations on product and inventory.
-- Populated automatically via audit triggers.
-- ============================================================================
CREATE TABLE audit_log (
    log_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(50)  NOT NULL,
    action     VARCHAR(10)  NOT NULL,
    record_id  INT          NOT NULL,
    old_data   JSONB,
    new_data   JSONB,
    changed_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50)  NOT NULL DEFAULT CURRENT_USER,
    CONSTRAINT chk_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

COMMENT ON TABLE audit_log IS 'System audit trail logging all modifications to product catalog and inventory balances.';

-- ============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING AND REFERENTIAL INTEGRITY
-- ============================================================================

-- Foreign Key Indexes (Optimizes joins and prevents cascading table locks)
CREATE INDEX idx_product_category_id   ON product (category_id);
CREATE INDEX idx_product_supplier_id   ON product (supplier_id);
CREATE INDEX idx_inventory_product_id  ON inventory (product_id);
CREATE INDEX idx_sales_customer_id     ON sales (customer_id);
CREATE INDEX idx_sales_detail_sales_id ON sales_detail (sales_id);
CREATE INDEX idx_sales_detail_prod_id  ON sales_detail (product_id);
CREATE INDEX idx_payment_sales_id      ON payment (sales_id);
CREATE INDEX idx_stock_alert_prod_id   ON stock_alert (product_id);

-- Explicitly Requested Business Indexes
CREATE INDEX idx_product_name          ON product (product_name);
CREATE INDEX idx_customer_phone        ON customer (phone);
CREATE INDEX idx_sales_sales_date      ON sales (sales_date);

-- Analytical Composite Indexes
CREATE INDEX idx_sales_date_total      ON sales (sales_date, total_amount);
CREATE INDEX idx_audit_log_table_rec   ON audit_log (table_name, record_id);
CREATE INDEX idx_stock_alert_status    ON stock_alert (status, alert_date);
