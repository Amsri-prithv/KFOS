import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './server/config/env.js';
import { handleNluParse } from './server/api/nlu.controller.js';
import { handleTelegramMessage, handleTelegramWebhook } from './server/api/telegram.controller.js';
import { handleLogin, handleVerify } from './server/api/auth.controller.js';
import { handleAgentExecution } from './server/api/agents.controller.js';
import { dbService } from './server/services/db.service.js';
import { authenticateToken, requireRole, requireResourcePermission } from './server/middleware/auth.js';
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
  getGenericCollection,
  createGenericDoc,
} from './server/api/firestore.controller.js';
import { errorHandler } from './server/middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

app.use(express.json({ limit: '20mb' }));

// Health Check API (Public)
app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'online',
    app: 'KFOS - Kashmeer Fragrances Operating System',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    pid: process.pid,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    },
  });
});

// Authentication APIs (Public)
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/verify', handleVerify);

// Database Health Check API (Public)
app.get('/api/db/health', async (req, res) => {
  const health = await dbService.getHealthStatus();
  res.json(health);
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

app.get('/api/firestore/collection/:name', authenticateToken, (req, res, next) => {
  const name = req.params.name;
  return requireResourcePermission(name)(req, res, next);
}, getGenericCollection);

app.post('/api/firestore/collection/:name', authenticateToken, (req, res, next) => {
  const name = req.params.name;
  return requireResourcePermission(name)(req, res, next);
}, createGenericDoc);

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
