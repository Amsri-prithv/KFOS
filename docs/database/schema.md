# KFOS — Relational Database Schema Specification

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Date:** August 8, 2026  

---

## Core Entities & Schema Definition

### 1. `customers`
* `id` (VARCHAR Primary Key)
* `name` (VARCHAR Required)
* `business_name` (VARCHAR Optional)
* `place` (VARCHAR Required - e.g. Trichy, Madurai, Salem, Chennai)
* `phone` (VARCHAR Required)
* `outstanding_balance` (DECIMAL Default 0)
* `free_200ml_samples_used` (INTEGER Default 0 - Max 2 Lifetime)
* `total_orders_count` (INTEGER Default 0)
* `total_spent` (DECIMAL Default 0)
* `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### 2. `orders` & `order_items`
* `id` (VARCHAR Primary Key)
* `order_number` (VARCHAR Unique)
* `customer_id` (VARCHAR Foreign Key -> customers.id)
* `total_amount` (DECIMAL)
* `total_discount` (DECIMAL)
* `total_profit` (DECIMAL - Realized Margin)
* `paid_amount` (DECIMAL)
* `payment_status` (ENUM: 'Paid', 'Partial', 'Unpaid')
* `source` (ENUM: 'Telegram Voice', 'Telegram Text', 'Dashboard Manual')

### 3. `liquid_stock_pools`
* `quality` (ENUM Primary Key: 'Eco', 'Standard', 'Premium')
* `current_stock_5l` (INTEGER - Number of 5L Cans)
* `low_stock_threshold` (INTEGER)
* `last_restocked_at` (TIMESTAMP)

### 4. `sample_distributions`
* `id` (VARCHAR Primary Key)
* `customer_id` (VARCHAR Foreign Key -> customers.id)
* `sample_type` (ENUM: '200ml', '500ml')
* `is_free` (BOOLEAN)
* `charge_amount` (DECIMAL - Free=0, Paid 200ml=200, 500ml=300)
* `profit` (DECIMAL - ALWAYS 0)
* `follow_up_due_date` (TIMESTAMP - Exactly +3 Days)
* `follow_up_status` (ENUM: 'Pending', 'Completed', 'Overdue')
