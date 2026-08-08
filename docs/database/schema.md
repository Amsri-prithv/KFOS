# KFOS — Cloud Firestore NoSQL Database Schema Specification

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Database:** Google Cloud Firestore (Native NoSQL Mode)  
**Last Updated:** August 8, 2026  

---

## Architecture & Security Overview

KFOS uses Google Cloud Firestore as its single source of truth. All financial, stock, and audit mutations are performed server-side via the Firebase Admin SDK inside atomic Firestore transactions to guarantee consistency, idempotency, and strict Role-Based Access Control (RBAC).

---

## Firestore Collections Schema

### 1. `customers`
* **Doc ID:** `cust-<timestamp>` or custom string key
* **Fields:**
  * `id` (string, Required) — Primary document key
  * `name` (string, Required) — Business / Customer name
  * `businessName` (string, Optional) — Trade name
  * `place` (string, Required) — Location (e.g., Trichy, Madurai, Salem, Chennai)
  * `phone` (string, Required) — Phone contact
  * `outstandingBalance` (number, Required) — Current unpaid balance (in ₹)
  * `free200mlSamplesUsed` (number, Required) — Lifetime free sample count (Max 3)
  * `totalOrdersCount` (number, Required) — Total completed orders
  * `totalSpent` (number, Required) — Cumulative revenue (in ₹)
  * `isArchived` (boolean, Required) — Soft delete flag
  * `createdAt` (string/ISO, Required)
  * `updatedAt` (string/ISO, Required)
* **Security Rules:** Read: Authenticated users; Write: Sales / Admin roles only.

### 2. `products` & `productVariants`
* **Doc ID:** `prod-<id>` / `var-<id>`
* **Fields:**
  * `id` (string, Required)
  * `name` (string, Required) — E.g., "Room Freshener", "Bathroom Freshener"
  * `category` (string, Required)
  * `active` (boolean, Required)
  * `createdAt` / `updatedAt` (string/ISO)
* **Security Rules:** Read: Authenticated users; Write: Founder / Admin only.

### 3. `orders`
* **Doc ID:** `ord-<timestamp>`
* **Fields:**
  * `id` (string, Required)
  * `orderNumber` (string, Required, Unique) — E.g., "KF-2026-1001"
  * `customerId` (string, Required) — Reference -> `customers.id`
  * `customerName` (string, Required)
  * `customerPlace` (string, Required)
  * `items` (array of objects, Required):
    * `id` (string)
    * `productVariant` (string)
    * `quality` (string: 'Eco' | 'Standard' | 'Premium')
    * `quantity` (number)
    * `buyPricePerUnit` (number)
    * `salePricePerUnit` (number)
    * `discountPerUnit` (number)
    * `realizedProfitPerUnit` (number)
    * `totalAmount` (number)
    * `totalProfit` (number)
  * `totalAmount` (number, Required)
  * `totalDiscount` (number, Required)
  * `totalProfit` (number, Required)
  * `paidAmount` (number, Required)
  * `paymentStatus` (string: 'Paid' | 'Partial' | 'Unpaid')
  * `orderDate` (string/ISO, Required)
  * `source` (string: 'Telegram Voice' | 'Telegram Text' | 'Dashboard Manual')
  * `isArchived` (boolean, Required)
  * `createdAt` / `updatedAt` (string/ISO)
* **Transactional Relationships:** Created via `createOrderAtomic` transaction (deducts stock from `inventory`, updates customer `outstandingBalance`, logs to `auditLogs`).
* **Security Rules:** Read: Authenticated users; Write: Sales / Admin only.

### 4. `orderItems`
* **Doc ID:** `item-<id>`
* **Fields:** Sub-document item records for detailed reporting.
* **Security Rules:** Read: Authenticated users; Write: Server-Side Admin SDK only (`allow write: if false`).

### 5. `inventory`
* **Doc ID:** Quality Grade ('Eco' | 'Standard' | 'Premium')
* **Fields:**
  * `quality` (string, Required)
  * `currentStock5L` (number, Required) — Available 5L cans
  * `lowStockThreshold` (number, Required)
  * `lastRestockedAt` (string/ISO, Required)
  * `updatedAt` (string/ISO, Required)
* **Security Rules:** Read: Authenticated users; Write: Operations / Admin only.

### 6. `inventoryTransactions`
* **Doc ID:** `invtx-<timestamp>`
* **Fields:**
  * `id` (string, Required)
  * `quality` (string, Required)
  * `quantity` (number, Required)
  * `type` (string: 'DEDUCT_ORDER' | 'RESTOCK' | 'CORRECTION')
  * `reason` (string)
  * `timestamp` (string/ISO, Required)
* **Security Rules:** Read: Authenticated users; Write: Server-Side Admin SDK only (`allow write: if false`).

### 7. `payments`
* **Doc ID:** `pay_<idempotencyKey>` or `pay_<timestamp>`
* **Fields:**
  * `id` (string, Required)
  * `customerId` (string, Required) — Reference -> `customers.id`
  * `customerName` (string, Required)
  * `amount` (number, Required) — Payment collected in ₹
  * `paymentDate` (string/YYYY-MM-DD, Required)
  * `paymentMethod` (string: 'Cash / UPI')
  * `notes` (string)
  * `recordedBy` (string)
  * `createdAt` / `updatedAt` (string/ISO)
* **Security Rules:** Read: Finance / Admin roles; Write: Server-Side Admin SDK only (`allow write: if false`). Executed via `recordPaymentAtomic` transaction.

### 8. `expenses`
* **Doc ID:** `exp-<timestamp>`
* **Fields:**
  * `id` (string, Required)
  * `title` (string, Required)
  * `category` (string, Required)
  * `amount` (number, Required)
  * `recordedBy` (string)
  * `date` (string/ISO)
* **Security Rules:** Read: Finance / Admin roles; Write: Server-Side Admin SDK only (`allow write: if false`).

### 9. `leads` & `campaigns`
* **Doc ID:** `lead-<id>` / `camp-<id>`
* **Fields:** Lead tracking & marketing campaign metadata.
* **Security Rules:** Read: Authenticated users; Write: Sales / Admin only.

### 10. `supportTickets`
* **Doc ID:** `ticket-<id>`
* **Fields:** Customer support queries, issue descriptions, status.
* **Security Rules:** Read: Authenticated users; Create: Sales / Support; Update/Delete: Support / Admin.

### 11. `tasks` & `notifications`
* **Doc ID:** `task-<id>` / `notif-<id>`
* **Fields:** Scheduled follow-ups & system alerts.
* **Security Rules:** Read & Write: Authenticated users.

### 12. `auditLogs`
* **Doc ID:** `audit_<timestamp>`
* **Fields:**
  * `id` (string, Required)
  * `timestamp` (string/ISO, Required)
  * `type` (string, Required) — E.g., 'Payment Recorded', 'Order Created', 'Stock Restocked'
  * `title` (string, Required)
  * `description` (string, Required)
  * `customerId` (string, Optional)
  * `customerName` (string, Optional)
  * `amount` (number, Optional)
  * `recordedBy` (string, Optional)
* **Security Rules:** Read: Founder / Admin; Write: Server-Side Admin SDK append-only (`allow write: if false`).

### 13. `telegramProcessedUpdates`
* **Doc ID:** `update_<telegramUpdateId>`
* **Fields:**
  * `updateId` (number, Required)
  * `processedAt` (string/ISO, Required)
* **Security Rules:** Server-Side Admin SDK only (`allow read, write: if false`). Guarantees webhook update idempotency.

### 14. `telegramPendingActions`
* **Doc ID:** `chat_<chatId>_user_<telegramUserId>`
* **Fields:**
  * `chatId` (string, Required)
  * `telegramUserId` (string, Optional)
  * `intent` (string, Required) — E.g., 'CREATE_ORDER', 'RECORD_PAYMENT'
  * `data` (object, Required) — Parameters required for business execution
  * `summaryText` (string, Required) — Human-readable confirmation prompt
  * `createdAt` (string/ISO, Required)
  * `expiresAt` (number, Required) — Unix timestamp (10 min expiry)
  * `status` (string: 'pending' | 'processing' | 'executed' | 'cancelled' | 'expired' | 'failed')
  * `claimedAt` / `claimedBy` / `executedAt` / `failedAt` / `lastError` (string, Optional)
* **Security Rules:** Server-Side Admin SDK only (`allow read, write: if false`). Guarantees user isolation and atomic confirmation state transitions.
