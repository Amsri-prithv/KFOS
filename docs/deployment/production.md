# Kashmeer Fragrances Operating System (KFOS) - Production Deployment Guide

This document outlines the standard operating procedures for configuring, building, deploying, securing, and rolling back the KFOS full-stack application in a production environment.

---

## 1. Environment Variables

All sensitive environment variables must be managed securely through secret managers (e.g., Google Cloud Secret Manager, GitHub Secrets) and never committed to source control.

| Variable Name | Description | Example / Allowed Values | Production Mandate |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Application environment state | `production` or `development` | Must be `production` |
| `PORT` | Node server port | `3000` | Hardcoded inside container |
| `ADMIN_PIN` | Fallback supervisor credentials | e.g., `9174` (numeric string) | Must change from dev defaults |
| `JWT_SECRET` | Cryptographic signature for logins | Raw cryptographic secure string | Must change from dev defaults |
| `TELEGRAM_BOT_TOKEN` | Incoming Telegram webhook agent bot token | e.g., `1234567890:ABCdef...` | Required for Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook security token | High-entropy random string | Verified in `X-Telegram-Bot-Api-Secret-Token` |
| `GEMINI_API_KEY` | Gemini 3.6 Flash NLU engine credentials | Secure API Key | Used server-side only |
| `APP_URL` | Root URL for the application server | e.g., `https://kfos.kashmeerfragrances.com` | No trailing slash |

---

## 2. Firebase Setup & Config

KFOS relies on Google Cloud Firestore for transactional storage and persistence.

1. **Create Firebase Project**:
   - Set up a standard Firebase Project via the Firebase Console.
   - Provision Cloud Firestore in **Native Mode** inside your region of choice (e.g., `asia-south1` / Mumbai or `asia-east1` / Taiwan for low latency to South Asia).

2. **Generate Admin SDK Service Account**:
   - Go to Google Cloud Console or Firebase Settings -> Service Accounts.
   - Generate a new private key JSON.
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to the private key path on the host, or load the configuration safely on the backend.

3. **Public Client Configuration**:
   - Generate a Web App configuration in Firebase settings.
   - Add the non-sensitive public configurations (such as `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`) into `/firebase-applet-config.json` for client bundle consumption.

---

## 3. Firestore Rules Deployment

Before routing production traffic, secure Firestore using the local rule definition (`firestore.rules`).

1. **Verification**:
   - Run a validation check to make sure client-side mutation of financial records (`payments`, `expenses`), logs (`auditLogs`), and Telegram state (`telegramProcessedUpdates`, `telegramPendingActions`) is blocked.

2. **Deploy via CLI**:
   - Install the Firebase CLI:
     ```bash
     npm install -g firebase-tools
     ```
   - Authenticate with the Firebase CLI:
     ```bash
     firebase login
     ```
   - Deploy only Firestore security rules:
     ```bash
     firebase deploy --only firestore:rules
     ```

---

## 4. Build Commands

To build KFOS for production, compile the React SPA assets first, and then compile the TypeScript backend server into a single bundled CommonJS file (`dist/server.cjs`) to avoid ES module resolution overhead.

1. **Install dependencies**:
   ```bash
   npm ci
   ```

2. **Run Linting / Type Verification**:
   ```bash
   npm run lint
   ```

3. **Compile Client & Server**:
   ```bash
   npm run build
   ```

   *Note: This runs `vite build` to output HTML/CSS/JS client-side assets to `dist/`, and then bundles `server.ts` into `dist/server.cjs` with `esbuild` using external flags for libraries like Express.*

---

## 5. Server Start Command

The production runtime container launches using Node.js without additional build compilation dependencies:

```bash
npm start
```

This resolves directly to:
```bash
node dist/server.cjs
```

Ensure that the environment has `NODE_ENV=production` configured before starting.

---

## 6. Telegram Webhook Setup

Since KFOS utilizes a secure webhook for instant message processing, you must register your production domain with the Telegram Bot API.

1. **Set Webhook API Call**:
   Execute a HTTP POST request to register the URL along with your custom secret token:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{
          "url": "https://<YOUR_APP_DOMAIN>/api/telegram/webhook",
          "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
        }'
   ```

2. **Verify Setup**:
   You can inspect current webhook configurations:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/getWebhookInfo"
   ```

---

## 7. Health Checks

KFOS provides lightweight HTTP endpoints to monitor server operational state and Firestore connectivity:

- **Server Health**: `/api/health`
  - Returns `200 OK` with JSON indicating runtime status and timestamp.
  - Useful for Kubernetes or Cloud Run liveness probes.

- **Firestore Database Connection**: `/api/db/health`
  - Performs a lightweight write-and-read operation to check end-to-end database latency and auth status.
  - Returns `200 OK` or detailed connection health status.

---

## 8. Rollback Procedure

If a production deployment introduces critical regressions or fails smoke tests:

1. **Application Rollback**:
   - Redeploy the last known stable Docker image tag (e.g., rollback from `v1.2.1` to `v1.2.0` on Cloud Run).
   - Alternatively, revert the `main` git branch and execute the CI/CD rebuild workflow.

2. **Firestore Rules Rollback**:
   - In case a rules deployment has locked out valid actions, revert to the last working Git version of `firestore.rules` and run:
     ```bash
     firebase deploy --only firestore:rules
     ```

3. **NLU Fallback Enforcement**:
   - If the external Gemini API is rate-limited or experiencing high latencies, KFOS automatically falls back to its robust, rule-based regular expression engine server-side to guarantee continuous operation for field agents.
