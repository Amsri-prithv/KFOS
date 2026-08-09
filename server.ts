import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './server/config/env.js';
import { handleNluParse } from './server/api/nlu.controller.js';
import { handleTelegramMessage, handleTelegramWebhook } from './server/api/telegram.controller.js';
import { handleLogin, handleVerify, handleLogout } from './server/api/auth.controller.js';
import { handleAgentExecution } from './server/api/agents.controller.js';
import { dbService } from './server/services/db.service.js';
import { authenticateToken, requireRole, requireResourcePermission } from './server/middleware/auth.js';
import { verifyToken } from './server/utils/jwt.js';
import {
  getCustomers,
  createCustomer,
  getOrders,
  createOrder,
  getInventory,
  updateInventory,
  getProducts,
  getExpenses,
  createExpense,
  createPayment,
  getGenericCollection,
  createGenericDoc,
  updateGenericDoc,
} from './server/api/firestore.controller.js';
import { errorHandler } from './server/middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Configure Express trust proxy for secure, normalized client IP tracking (req.ip) in Cloud Run
app.set('trust proxy', 1);

// Phase 4: Express Hardening - Dynamic JSON limits based on endpoint
app.use((req, res, next) => {
  if (
    req.path === '/api/nlu/parse' ||
    req.path === '/api/telegram/webhook' ||
    req.path === '/api/telegram/message'
  ) {
    return express.json({ limit: '20mb' })(req, res, next);
  }
  return express.json({ limit: '100kb' })(req, res, next);
});

// Phase 4: Handle malformed JSON safely without throwing server-side trace leaks
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Malformed JSON payload' });
  }
  next(err);
});

// Phase 3: Public Health Check API (Hardened - No internal diagnostics)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
  });
});

// Authentication APIs (Public)
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/verify', handleVerify);
app.post('/api/auth/logout', handleLogout);

// Phase 3: Database Health Check API (Hardened - No sensitive statistics for public)
app.get('/api/db/health', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  let isAuthorized = false;
  if (token) {
    const payload = verifyToken(token);
    if (payload && (payload.role === 'Admin' || payload.role === 'Founder' || payload.role === 'Finance')) {
      isAuthorized = true;
    }
  }

  if (isAuthorized) {
    const health = await dbService.getHealthStatus();
    return res.json(health);
  } else {
    const isConnected = await dbService.checkConnection();
    return res.json({
      connected: isConnected,
      status: isConnected ? 'ok' : 'error',
    });
  }
});

// Telegram Bot Webhook (Public webhook routes)
app.post('/api/telegram/webhook', handleTelegramWebhook);
app.post('/api/telegram/message', handleTelegramMessage);

// Protected Firestore CRUD APIs with Authentication & RBAC
app.get('/api/firestore/customers', authenticateToken, requireResourcePermission('customers'), getCustomers);
app.post('/api/firestore/customers', authenticateToken, requireRole(['Founder', 'Admin', 'Sales']), createCustomer);

app.get('/api/firestore/orders', authenticateToken, requireResourcePermission('orders'), getOrders);
app.post('/api/firestore/orders', authenticateToken, requireRole(['Founder', 'Admin', 'Sales']), createOrder);

app.get('/api/firestore/inventory', authenticateToken, requireResourcePermission('inventory'), getInventory);
app.post('/api/firestore/inventory', authenticateToken, requireRole(['Founder', 'Admin', 'Operations']), updateInventory);

app.get('/api/firestore/products', authenticateToken, requireResourcePermission('products'), getProducts);

app.get('/api/firestore/expenses', authenticateToken, requireResourcePermission('expenses'), getExpenses);
app.post('/api/firestore/expenses', authenticateToken, requireRole(['Founder', 'Admin', 'Finance']), createExpense);

app.post('/api/firestore/payments', authenticateToken, requireRole(['Founder', 'Admin', 'Finance', 'Sales']), createPayment);

app.get('/api/firestore/collection/:name', authenticateToken, (req, res, next) => {
  const name = req.params.name;
  return requireResourcePermission(name)(req, res, next);
}, getGenericCollection);

app.post('/api/firestore/collection/:name', authenticateToken, (req, res, next) => {
  const name = req.params.name;
  return requireResourcePermission(name)(req, res, next);
}, createGenericDoc);

app.patch('/api/firestore/collection/:name/:id', authenticateToken, (req, res, next) => {
  const name = req.params.name;
  return requireResourcePermission(name)(req, res, next);
}, updateGenericDoc);

// Voice & Text NLU Parsing API (Protected)
app.post('/api/nlu/parse', authenticateToken, requireResourcePermission('nlu'), handleNluParse);

// AI Agents Execution API (Protected)
app.post('/api/agents/execute', authenticateToken, requireResourcePermission('agents'), handleAgentExecution);

// Error Handling Middleware
app.use(errorHandler);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KFOS] Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
