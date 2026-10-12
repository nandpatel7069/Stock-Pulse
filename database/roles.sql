-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: roles.sql
-- Description: Role-Based Access Control (RBAC) Security Model
--              Configures Admin, Manager, and Cashier roles with granular GRANTs
-- ============================================================================

-- ============================================================================
-- 1. ROLE CREATION (Idempotent DDL)
-- ============================================================================

DO $$
BEGIN
    -- 1. Admin Role (Superintendent with total database authority)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
        CREATE ROLE admin WITH CREATEROLE;
    END IF;

    -- 2. Manager Role (Store supervisor overseeing catalog, inventory & restock)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manager') THEN
        CREATE ROLE manager;
    END IF;

    -- 3. Cashier Role (Front-desk POS operator creating sales and looking up items)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cashier') THEN
        CREATE ROLE cashier;
    END IF;

    -- Demonstration user accounts for login/testing
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user_admin') THEN
        CREATE ROLE user_admin WITH LOGIN PASSWORD 'Admin@Secure123' IN ROLE admin;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user_manager') THEN
        CREATE ROLE user_manager WITH LOGIN PASSWORD 'Manager@Secure123' IN ROLE manager;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user_cashier') THEN
        CREATE ROLE user_cashier WITH LOGIN PASSWORD 'Cashier@Secure123' IN ROLE cashier;
    END IF;
END;
$$;

-- Connect and schema usage grants
GRANT CONNECT ON DATABASE retail_db TO admin, manager, cashier;
GRANT USAGE ON SCHEMA public TO admin, manager, cashier;


-- ============================================================================
-- 2. ROLE: ADMIN PERMISSIONS
-- Complete administrative authority: DDL, DML, audit review, security management
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL PROCEDURES IN SCHEMA public TO admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO admin;


-- ============================================================================
-- 3. ROLE: MANAGER PERMISSIONS
-- Store manager:
--  - Can read all catalog, sales, and analytics views
--  - Can edit and replenish inventory, product catalog, categories, suppliers
--  - Can update and acknowledge stock_alert records
--  - Can execute sp_receive_shipment and sp_process_return
--  - Cannot drop core audit logs or change user roles
-- ============================================================================

-- Read access to all tables and analytics views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO manager;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO manager;

-- DML permissions on operational catalog and inventory entities
GRANT INSERT, UPDATE ON product, inventory, category, supplier, stock_alert TO manager;

-- Stored procedure execution permissions
GRANT EXECUTE ON PROCEDURE sp_receive_shipment TO manager;
GRANT EXECUTE ON PROCEDURE sp_process_return TO manager;
GRANT EXECUTE ON PROCEDURE sp_create_sale TO manager;


-- ============================================================================
-- 4. ROLE: CASHIER PERMISSIONS
-- Cashier (POS Terminal operator):
--  - Can read products and categories to view prices and lookup barcodes
--  - Can read and register customers
--  - Can create sales transactions, sales details, and payment receipts
--  - Can execute sp_create_sale
--  - STRICTLY FORBIDDEN from modifying inventory quantities directly
--  - STRICTLY FORBIDDEN from modifying unit_price, deleting products or altering audit_log
-- ============================================================================

-- Read catalog and lookup data
GRANT SELECT ON product, category, customer, inventory TO cashier;
GRANT SELECT ON sales, sales_detail, payment TO cashier;
GRANT SELECT ON v_low_stock, v_daily_sales TO cashier;

-- Customer onboarding and sales checkout insertion
GRANT INSERT ON customer, sales, sales_detail, payment TO cashier;

-- Sequence usage for identity generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cashier;

-- Procedure execution for checkout
GRANT EXECUTE ON PROCEDURE sp_create_sale TO cashier;

-- Explicitly ensure Cashier cannot alter master product pricing or inventory directly
REVOKE UPDATE, DELETE ON product, category, supplier, inventory, stock_alert, audit_log FROM cashier;
REVOKE UPDATE, DELETE ON sales, payment FROM cashier;
