# Kashmeer Fragrances Operating System (KFOS)

KFOS is a highly secure, real-time, full-stack field sales automation, inventory tracking, and business intelligence platform designed specifically for the premium room freshener market.

It features a server-side Gemini 3.6 Flash NLU engine capable of understanding natural field-sales conversations in English, Tamil, and Tanglish (Tamil-English code-mixed speech/text), allowing field representatives to query inventory, create credit orders, and record payments directly via Telegram and voice.

---

## 🚀 Tech Stack

- **Frontend**: React 19 (SPA) with Vite 6, Tailwind CSS 4, Lucide Icons, and Motion for UI animations.
- **Backend**: Node.js (Express), ESBuild (CommonJS compilation), and TSX (direct TypeScript execution in development).
- **Database**: Cloud Firestore (Native Mode) with persistent transactions.
- **AI/NLU Service**: `@google/genai` TypeScript SDK (utilizing Gemini 3.6 Flash) with a high-reliability regex-based fallback engine.
- **Testing**: Vitest for unit, integration, and end-to-end (E2E) testing.

---

## ⚙️ Architecture & Data Integrity

KFOS is engineered with a strict full-stack architecture that encapsulates all business rules, database mutations, and external APIs behind a secure backend.

1. **Firestore Transactions**: All inventory deduction, order processing, and payment records run atomically inside server-side Firestore Transactions (`transaction.update`) to prevent duplicate operations and race conditions.
2. **Strict RBAC**: API endpoints are guarded with signed, high-entropy JWT auth tokens, verifying specific user roles (`Founder`, `Admin`, `Sales`, `Operations`, `Finance`, `Support`).
3. **Webhook Security**: The Telegram incoming webhook validates the `X-Telegram-Bot-Api-Secret-Token` header.
4. **Idempotency**: All Telegram updates check `telegramProcessedUpdates` collection to ignore duplicate messages, and confirm actions atomically to prevent double execution.

---

## 🛠️ Local Development & Setup

### Prerequisites

- Node.js v20+
- A Firebase Project with Firestore enabled

### 1. Setup Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Define the following credentials:
```env
# Server
PORT=3000
NODE_ENV=development
ADMIN_PIN="6124"
JWT_SECRET="kfos_jwt_secret_key_dev_only"

# AI/NLU Engine
GEMINI_API_KEY="AIza..."

# Telegram
TELEGRAM_BOT_TOKEN="1234567890:ABC..."
TELEGRAM_WEBHOOK_SECRET="high_entropy_secret_token"
```

### 2. Configure Firebase Applet Config

Save your public client Firebase configuration to `/firebase-applet-config.json`.

### 3. Run Development Server

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

The development server binds to host `0.0.0.0` on port `3000`.

---

## 🧪 Testing

KFOS includes automated unit/integration suites and system E2E tests using Vitest.

```bash
# Run all tests (Unit & E2E)
npm run test

# Run E2E tests specifically
npm run test:e2e
```

The test suites verify:
- Concurrency locking on Telegram actions
- Single sample limits per customer
- Insufficient inventory rollbacks
- Correct Tamil/Tanglish NLU extraction and confirmation

---

## 📦 Production Deployment & Build

To compile and package KFOS for production environments:

```bash
# Build React assets & bundle backend server
npm run build

# Start the bundled server
npm start
```

For more comprehensive setup details, please consult our [Production Deployment Guide](docs/deployment/production.md).
