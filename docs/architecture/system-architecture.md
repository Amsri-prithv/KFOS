# KFOS — Target System Architecture Specification

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Deployment Platform:** Single-Instance Cloud Run Container (Port 3000)  
**Database:** Google Cloud Firestore (Firebase Admin SDK)  
**Last Updated:** August 8, 2026  

---

## Architecture Topology Diagram

```
                              Field Sales / Telegram Voice / Web Dashboard Users
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │   Cloud Run Container Proxy  │
                                       │    Express Server (Port 3000)│
                                       └──────────────┬───────────────┘
                                                      │
               ┌──────────────────────────────────────┼──────────────────────────────────────┐
               ▼                                      ▼                                      ▼
    ┌────────────────────┐                 ┌────────────────────┐                 ┌────────────────────┐
    │  JWT Auth & RBAC   │                 │  Telegram Webhook  │                 │  React 19 Web SPA  │
    │   Authentication   │                 │     Pipeline       │                 │   Field Dashboard  │
    └──────────┬─────────┘                 └──────────┬─────────┘                 └──────────┬─────────┘
               │                                      │                                      │
               ▼                                      ▼                                      ▼
    ┌────────────────────┐                 ┌────────────────────┐                 ┌────────────────────┐
    │ REST API Routes    │                 │ Gemini NLU Engine  │                 │ State Management   │
    │ /api/firestore/*   │                 │ Tamil / Tanglish   │                 │ KFOS Store         │
    └──────────┬─────────┘                 └──────────┬─────────┘                 └──────────┬─────────┘
               │                                      │                                      │
               └──────────────────────────────────────┼──────────────────────────────────────┘
                                                      │
                                                      ▼
                                   ┌─────────────────────────────────────┐
                                   │     Firestore Repositories Layer    │
                                   │  - customersRepository              │
                                   │  - ordersRepository                 │
                                   │  - inventoryRepository              │
                                   └──────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                   ┌─────────────────────────────────────┐
                                   │     Atomic Firestore Transactions   │
                                   │  - createOrderAtomic                │
                                   │  - recordPaymentAtomic              │
                                   │  - recordSampleAtomic               │
                                   │  - claimAndExecutePendingAction     │
                                   └──────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                   ┌─────────────────────────────────────┐
                                   │     Google Cloud Firestore DB       │
                                   │      Single Source of Truth         │
                                   └─────────────────────────────────────┘
```

---

## Component Architecture Breakdown

### 1. Web Application Container (`server.ts`)
- **Runtime:** Single-instance Cloud Run container binding to port `3000` (`0.0.0.0`).
- **Dev Mode:** tsx execution with Vite SPA middleware.
- **Production Mode:** Bundled CommonJS server (`dist/server.cjs`) created via esbuild, serving static SPA assets from `dist/`.

### 2. Telegram Webhook Security & Idempotency Pipeline (`server/services/telegram.service.ts`)
- **Secret Verification:** Incoming POST requests to `/api/telegram/webhook` validate the header `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET`. Unauthenticated requests are rejected immediately with HTTP 403.
- **Update Idempotency:** Each `update_id` is atomically recorded in Firestore collection `telegramProcessedUpdates`. Duplicate webhooks are ignored immediately.

### 3. NLU Engine (`server/services/nlu.service.ts`)
- **Language Support:** Tamil, Tanglish (Latin alphabet), and English text/voice inputs.
- **Model:** `@google/genai` (Gemini 3.6 Flash) structured output generation.
- **Fallback Engine:** Rule-based fallback parser active when Gemini API key is missing or rate limited.
- **Strict Post-Validation:** Enforces mandatory parameters (customer name, quantity, payment amount) to prevent invalid transaction creation.

### 4. Pending Action State Machine & Race-Condition Locking
- **Document Key Isolation:** Pending actions are stored under document ID `chat_<chatId>_user_<telegramUserId>` in `telegramPendingActions`.
- **User Ownership Guarantee:** A user can only confirm or cancel an action initiated by their own Telegram user ID. Cross-user hijacking is strictly prevented.
- **Atomic Concurrency Lock (`claimAndExecutePendingActionAtomic`):**
  - Uses an explicit Firestore transaction.
  - Reads pending action status.
  - Verifies expiry (< 10 min) and status (`=== 'pending'`).
  - Transitions status atomically to `'processing'` within the transaction.
  - If two identical "Confirm" requests arrive simultaneously, exactly ONE transaction succeeds in setting state to `'processing'`, while the second transaction fails with state `'processing'`, preventing duplicate financial execution.
  - Upon successful business transaction execution, state transitions to `'executed'`.

### 5. Atomic Repository Mutations (`server/repositories/*.ts`)
- **`createOrderAtomic`:**
  1. Validates customer and pricing matrix.
  2. Reads inventory in transaction.
  3. Deducts stock from shared liquid pool (`inventory`).
  4. Computes gross amount, discounts, and realized profit.
  5. Creates `orders` document.
  6. Updates customer `outstandingBalance`, `totalOrdersCount`, and `totalSpent`.
  7. Appends audit log to `auditLogs`.
- **`recordPaymentAtomic`:**
  1. Performs overpayment check.
  2. Updates customer `outstandingBalance` atomically.
  3. Creates `payments` record with idempotency check.
  4. Appends audit log to `auditLogs`.
- **`recordSampleAtomic`:**
  1. Enforces lifetime limit of 3 free 200ml samples per customer.
  2. Increments `free200mlSamplesUsed`.
  3. Creates sample log and audit log.

### 6. Authentication & RBAC (`server/middleware/auth.ts`)
- **JWT Standard:** Signed via `JWT_SECRET`.
- **Roles:** Founder, Admin, Sales, Operations, Finance, Support.
- **Production Startup Check:** Mandatory env variables (`JWT_SECRET`, `ADMIN_PIN`, `TELEGRAM_WEBHOOK_SECRET`) trigger an immediate fail-fast server crash if missing or left at insecure defaults in production (`NODE_ENV=production`).
