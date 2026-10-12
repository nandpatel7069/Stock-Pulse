-- ============================================================================
-- Retail Inventory and Sales Management System
-- File: run_all.sql
-- Description: Universal Local/Remote Setup Script (Uses Relative Includes \ir)
-- Usage: psql -U postgres -d retail_db -f database/run_all.sql
-- ============================================================================

\echo '============================================================================'
\echo '>>> Initializing Retail Inventory and Sales Management System...'
\echo '============================================================================'

\echo '>>> [1/6] Applying 3NF Schema DDL...'
\ir schema.sql

\echo '>>> [2/6] Compiling Triggers and Automation Functions...'
\ir triggers.sql

\echo '>>> [3/6] Compiling Transactional Stored Procedures...'
\ir procedures.sql

\echo '>>> [4/6] Creating Analytical Views & Dashboards...'
\ir views.sql

\echo '>>> [5/6] Establishing Roles and RBAC Permissions...'
\ir roles.sql

\echo '>>> [6/6] Seeding 8 Categories, 10 Suppliers, 60 SKUs, 40 Customers, 300 Orders...'
\ir seed.sql

\echo '============================================================================'
\echo 'DATABASE INITIALIZATION COMPLETED WITH ZERO ERRORS!'
\echo '============================================================================'
