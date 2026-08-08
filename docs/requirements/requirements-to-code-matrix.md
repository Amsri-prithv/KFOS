# KFOS — Requirements to Code Matrix

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Date:** August 8, 2026  

---

## Requirements Mapping Matrix

| Requirement / Module | Existing Code Location | Status | Missing Work / Gap Analysis | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Vol 1: Authentication & RBAC** | `src/components/AdminModal.tsx` | PARTIAL | Replace local PIN state with secure server-side Auth (JWT/Sessions) and granular Role-Based Access Control (Admin, Sales, Ops, Support, Finance). | P1 |
| **Vol 2: Dashboard & Executive Analytics** | `src/components/KpiDashboard.tsx`, `src/components/Navbar.tsx` | COMPLETE | Connect hardcoded weekly chart data directly to live database aggregates. | P1 |
| **Vol 3: CRM & Customer Management** | `src/components/CustomerDirectory.tsx`, `src/services/kfosStore.ts` | COMPLETE | Migrate customer records to relational/persistent database; add address history and credit limit rules. | P1 |
| **Vol 4: Products & Pricing Matrix** | `src/types/kfos.ts` (`PRICING_MATRIX`) | COMPLETE | Add product variants master management table for dynamic catalog management. | P1 |
| **Vol 5: Orders & Field Sales Processing** | `src/components/OrderManager.tsx`, `src/services/kfosStore.ts` | COMPLETE | Wire order creation and return profit reversal directly to server-side API endpoints. | P1 |
| **Vol 6: Shared Liquid Inventory Management** | `src/components/InventoryPoolManager.tsx`, `src/services/kfosStore.ts` | COMPLETE | Add low-stock automated alert webhooks and purchase order restocking flow. | P1 |
| **Vol 7: Sales & Discount Calculations** | `src/services/kfosStore.ts` (`createOrder`) | COMPLETE | Persist transaction records in SQL/Firestore DB. | P1 |
| **Vol 8: Marketing & Sample Distributions** | `src/components/SamplesTracker.tsx`, `src/services/kfosStore.ts` | COMPLETE | Add automated WhatsApp / SMS / Telegram sample follow-up reminders. | P2 |
| **Vol 9: Finance & Payments Ledger** | `src/services/kfosStore.ts` (`recordPayment`, `processReturn`) | PARTIAL | Create dedicated Finance Ledger UI for expense tracking, accounts receivable aging, and invoice generation. | P2 |
| **Vol 10: Customer Support & Tickets** | `src/components/TimelineAuditFeed.tsx` | PARTIAL | Create dedicated Support Module UI for complaint management and ticket SLAs. | P2 |
| **Vol 11: Telegram Bot & Voice NLU** | `server.ts` (`/api/nlu/parse`, `/api/telegram/message`), `src/components/TelegramBotSimulator.tsx` | COMPLETE | Add real Telegram Bot API Webhook integration for incoming audio notes from field staff. | P1 |
| **Vol 12: AI Agents & Automation Engine** | `server.ts`, `src/services/kfosStore.ts` | PARTIAL | Formalize AI Agent Service architecture (CEO Agent, Sales Agent, Inventory Agent) with restricted tool schemas and execution logs. | P2 |

---

## Status Legend
* **COMPLETE:** Implemented, functional, and integrated into system workflow.
* **PARTIAL:** Basic implementation or UI present, requires backend server-side completion or persistent storage.
* **MISSING:** Not yet implemented in repository.
* **NEEDS REFACTOR:** Functionality exists but requires architectural restructuring or performance optimization.
* **NOT APPLICABLE:** Non-functional or out of scope for current release.
