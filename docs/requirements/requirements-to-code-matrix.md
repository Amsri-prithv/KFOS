# KFOS — Requirements to Code Traceability Matrix

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Last Updated:** August 8, 2026  

---

## Technical & Business Requirements Mapping

| # | Requirement Criterion | Primary Implementation File(s) | Status | Audit & Verification Summary |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Firestore Single Source of Truth** | `server/repositories/*.ts`, `src/services/kfosStore.ts` | **PASS** | Firestore is the sole database backend. React SPA synchronizes directly via `/api/firestore/*` endpoints. No secondary SQL DBs exist. |
| **2** | **Production Environment Secret Hardening** | `server/config/env.ts` | **PASS** | Server performs strict fail-fast validation in production mode (`NODE_ENV=production`) for `ADMIN_PIN`, `JWT_SECRET`, and `TELEGRAM_WEBHOOK_SECRET`. Insecure fallbacks strictly forbidden. |
| **3** | **Telegram Webhook Authorization** | `server/routes/telegram.routes.ts`, `server/services/telegram.service.ts` | **PASS** | Webhook endpoint `/api/telegram/webhook` validates header `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET`. Invalid or missing secret tokens return HTTP 403. |
| **4** | **Webhook Deduplication & Idempotency** | `server/services/telegram.service.ts` | **PASS** | Each `update_id` is atomically recorded in `telegramProcessedUpdates`. Duplicate updates are detected and ignored before any processing. |
| **5** | **Tamil / Tanglish NLU Processing** | `server/services/nlu.service.ts` | **PASS** | NLU engine utilizes `@google/genai` (Gemini 3.6 Flash) with structured JSON schemas and fallback rule-based parsing. |
| **6** | **NLU Strict Parameter Post-Validation** | `server/services/nlu.service.ts` | **PASS** | Strict post-validation layer rejects incomplete Gemini outputs and triggers clarification questions if required parameters (customer name, quantity, payment amount) are missing. |
| **7** | **Atomic Financial Order Creation** | `server/repositories/orders.repository.ts` | **PASS** | `createOrderAtomic` executes inside a single Firestore transaction: validates customer, deducts shared liquid stock, records order, updates balance, and logs audit record. |
| **8** | **Atomic Payment Recording** | `server/repositories/customers.repository.ts` | **PASS** | `recordPaymentAtomic` performs overpayment checks, updates customer `outstandingBalance`, creates `payments` record, and logs audit record in one atomic transaction. |
| **9** | **Atomic Sample Distribution & Limit Enforcement** | `server/repositories/customers.repository.ts` | **PASS** | `recordSampleAtomic` enforces strict lifetime limit of 3 free 200ml samples per customer, increments `free200mlSamplesUsed`, and logs audit trail atomically. |
| **10** | **Pending Action Document Key Isolation** | `server/services/telegram.service.ts` | **PASS** | Pending action document ID formatted as `chat_<chatId>_user_<telegramUserId>`. Different Telegram users cannot confirm or hijack another user's pending action. |
| **11** | **Atomic Race-Condition Lock ("Claim -> Execute")** | `server/services/telegram.service.ts` | **PASS** | `claimAndExecutePendingActionAtomic` transitions action status from `'pending'` to `'processing'` inside a Firestore transaction. Simultaneous confirmations fail safely. |
| **12** | **Customer Creation Validation** | `server/repositories/customers.repository.ts` | **PASS** | Customer creation requires valid `name`, `place`, and `phone`. Prevents injection of default or "Not provided" placeholder data. |
| **13** | **Seed Data Isolation** | `scripts/seed-dev.ts`, `src/services/kfosStore.ts` | **PASS** | Development seed datasets relocated to `scripts/seed-dev.ts`. Store initializes with empty state and fetches live data from Firestore. |
| **14** | **Firestore Security Rules Protection** | `firestore.rules` | **PASS** | `_systemTests`, `payments`, `expenses`, `inventoryTransactions`, `auditLogs`, and `telegramPendingActions` are restricted to server-side Firebase Admin SDK (`allow write: if false`). |
| **15** | **JWT & Role-Based Access Control (RBAC)** | `server/middleware/auth.ts` | **PASS** | Express routes protected via JWT middleware verifying user roles (Founder, Admin, Sales, Operations, Finance, Support). |
| **16** | **Database Schema Documentation** | `docs/database/schema.md` | **PASS** | Fully updated NoSQL Firestore schema documentation covering all 14 collections, data types, security rules, and transaction contracts. |
| **17** | **System Architecture Documentation** | `docs/architecture/system-architecture.md` | **PASS** | Fully updated architecture specification covering Cloud Run deployment, webhook pipeline, NLU parser, race condition locking, and Firestore atomic mutations. |
| **18** | **Requirements Traceability Matrix** | `docs/requirements/requirements-to-code-matrix.md` | **PASS** | Document updated and verified against repository code state. |
| **19** | **Concurrency & Failure Recovery Test Suite** | `tests/system-e2e.test.ts` | **PASS** | Comprehensive automated test suite verifying webhook security, race conditions, sample limits, and transaction rollbacks. |
| **20** | **Comprehensive Production Audit Report** | Prompt Output | **PASS** | Final PASS/FAIL report compiled with actual code verification results. |

---

## Status Legend
* **PASS:** Code implementation verified, test validated, and active in production code.
* **FAIL:** Deficiency identified or test assertion failed.
* **IN PROGRESS:** Implementation underway.
