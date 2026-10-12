-- ============================================================================
-- Retail Inventory and Sales Management System
-- MySQL 8.0 Full Schema & Database Export for MySQL Workbench
-- ============================================================================

CREATE DATABASE IF NOT EXISTS retail_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE retail_db;

DROP TABLE IF EXISTS audit_log;
CREATE TABLE `audit_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int NOT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'app_user',
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_table_rec` (`table_name`,`record_id`),
  CONSTRAINT `chk_audit_action` CHECK ((`action` in (_utf8mb4'INSERT',_utf8mb4'UPDATE',_utf8mb4'DELETE')))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS category;
CREATE TABLE `category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS customer;
CREATE TABLE `customer` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_cust_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS inventory;
CREATE TABLE `inventory` (
  `inventory_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `quantity_in_hand` int NOT NULL DEFAULT '0',
  `last_updated` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`inventory_id`),
  UNIQUE KEY `product_id` (`product_id`),
  CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_inventory_qty` CHECK ((`quantity_in_hand` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS payment;
CREATE TABLE `payment` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `sales_id` int NOT NULL,
  `payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `sales_id` (`sales_id`),
  KEY `idx_payment_sales` (`sales_id`),
  CONSTRAINT `fk_payment_sales` FOREIGN KEY (`sales_id`) REFERENCES `sales` (`sales_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_payment_amount` CHECK ((`amount` >= 0)),
  CONSTRAINT `chk_payment_mode` CHECK ((`payment_mode` in (_utf8mb4'Cash',_utf8mb4'Card',_utf8mb4'UPI',_utf8mb4'NetBanking')))
) ENGINE=InnoDB AUTO_INCREMENT=305 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS product;
CREATE TABLE `product` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `product_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `reorder_level` int NOT NULL DEFAULT '10',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  KEY `idx_prod_cat` (`category_id`),
  KEY `idx_prod_sup` (`supplier_id`),
  KEY `idx_prod_name` (`product_name`),
  CONSTRAINT `fk_product_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_product_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_product_reorder_level` CHECK ((`reorder_level` >= 0)),
  CONSTRAINT `chk_product_unit_price` CHECK ((`unit_price` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS sales;
CREATE TABLE `sales` (
  `sales_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `sales_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`sales_id`),
  KEY `idx_sales_cust` (`customer_id`),
  KEY `idx_sales_date` (`sales_date`),
  KEY `idx_sales_date_total` (`sales_date`,`total_amount`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_sales_total` CHECK ((`total_amount` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=308 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS sales_detail;
CREATE TABLE `sales_detail` (
  `sales_detail_id` int NOT NULL AUTO_INCREMENT,
  `sales_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `sub_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`sales_detail_id`),
  KEY `idx_sd_sales` (`sales_id`),
  KEY `idx_sd_prod` (`product_id`),
  CONSTRAINT `fk_detail_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_detail_sales` FOREIGN KEY (`sales_id`) REFERENCES `sales` (`sales_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_detail_discount` CHECK ((`discount` >= 0)),
  CONSTRAINT `chk_detail_quantity` CHECK ((`quantity` > 0)),
  CONSTRAINT `chk_detail_sub_total` CHECK ((`sub_total` >= 0)),
  CONSTRAINT `chk_detail_unit_price` CHECK ((`unit_price` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=756 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS stock_alert;
CREATE TABLE `stock_alert` (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `quantity_at_alert` int NOT NULL,
  `reorder_level` int NOT NULL,
  `alert_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `alert_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`alert_id`),
  KEY `idx_alert_prod` (`product_id`),
  KEY `idx_alert_status` (`status`,`alert_date`),
  CONSTRAINT `fk_stock_alert_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_stock_alert_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'ACKNOWLEDGED',_utf8mb4'RESOLVED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS supplier;
CREATE TABLE `supplier` (
  `supplier_id` int NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`supplier_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

