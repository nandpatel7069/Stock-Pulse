-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: init.sql
-- Description: Master Orchestration Initialization Script for Docker Container
-- ============================================================================

\echo '============================================================================'
-- 1. Schema DDL
\echo '>>> [1/6] Executing schema.sql (3NF Tables, Keys, Constraints, Indexes)...'
\i /database/schema.sql

-- 2. Triggers
\echo '>>> [2/6] Executing triggers.sql (PL/pgSQL Business Rules & Auditing)...'
\i /database/triggers.sql

-- 3. Stored Procedures
\echo '>>> [3/6] Executing procedures.sql (ACID Checkout, Returns, Restock)...'
\i /database/procedures.sql

-- 4. Analytical Views
\echo '>>> [4/6] Executing views.sql (Business Intelligence & KPIs)...'
\i /database/views.sql

-- 5. Role-Based Access Control
\echo '>>> [5/6] Executing roles.sql (Admin, Manager, Cashier RBAC)...'
\i /database/roles.sql

-- 6. Sample Indian Retail Seed Data
\echo '>>> [6/6] Executing seed.sql (Categories, Suppliers, Products, 300 Orders)...'
\i /database/seed.sql

\echo '============================================================================'
\echo 'RETAIL INVENTORY & SALES MANAGEMENT SYSTEM DATABASE INITIALIZED SUCCESSFULLY!'
\echo '============================================================================'
