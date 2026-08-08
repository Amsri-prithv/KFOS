# KFOS — Target System Architecture

**Project:** Kashmeer Fragrances Operating System (KFOS)  
**Date:** August 8, 2026  

---

## Architecture Topology

```
Field Staff / Telegram Voice / Web Dashboard
                  ↓
          [Express Gateway] (Port 3000)
                  ↓
  ┌───────────────┼───────────────┐
  ↓               ↓               ↓
[Auth & RBAC]  [NLU & Voice]  [AI Agents Engine]
  ↓               ↓               ↓
[Customer Svc] [Order Svc]   [Inventory Pool Svc]
  └───────────────┼───────────────┘
                  ↓
  [Relational DB / LocalStore Sync]
```

---

## Modular Component Breakdown

1. **Frontend Dashboard (`src/App.tsx`):** React 19 + Tailwind CSS dark mode application containing Executive Analytics, Field Sales Orders, Customer Directory, Shared Liquid Pools, Free Samples Tracker, Finance Ledger, AI Agents Hub, and System Settings.
2. **Express Backend Application (`server.ts`):** Lightweight entry point serving API routes and Vite middleware in development or bundled static files in production (`dist/server.cjs`).
3. **NLU Service (`server/services/nlu.service.ts`):** Parses Tanglish, Tamil, and English audio/text notes into structured transaction JSON schemas using `@google/genai` (Gemini 3.6 Flash).
4. **AI Agents Hub (`server/services/aiAgent.service.ts`):** Multi-agent orchestrator providing role-restricted advice for CEO Agent, Sales Agent, Marketing Agent, Support Agent, Inventory Agent, and Finance Agent.
5. **Finance & Credit Ledger (`src/components/FinanceLedger.tsx`):** Tracks Accounts Receivable aging by customer, operating expenses, realized gross profits, and generates tax invoices.
