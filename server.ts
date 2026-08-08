import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './server/config/env.js';
import { handleNluParse } from './server/api/nlu.controller.js';
import { handleTelegramMessage } from './server/api/telegram.controller.js';
import { handleLogin, handleVerify } from './server/api/auth.controller.js';
import { handleAgentExecution } from './server/api/agents.controller.js';
import { dbService } from './server/services/db.service.js';
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

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'KFOS - Kashmeer Fragrances Operating System',
    timestamp: new Date().toISOString(),
  });
});

// Authentication APIs
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/verify', handleVerify);

// Database Health Check API
app.get('/api/db/health', async (req, res) => {
  const health = await dbService.getHealthStatus();
  res.json(health);
});

// Firestore CRUD APIs
app.get('/api/firestore/customers', getCustomers);
app.post('/api/firestore/customers', createCustomer);

app.get('/api/firestore/orders', getOrders);
app.post('/api/firestore/orders', createOrder);

app.get('/api/firestore/inventory', getInventory);
app.post('/api/firestore/inventory', updateInventory);

app.get('/api/firestore/products', getProducts);

app.get('/api/firestore/expenses', getExpenses);
app.post('/api/firestore/expenses', createExpense);

app.get('/api/firestore/collection/:name', getGenericCollection);
app.post('/api/firestore/collection/:name', createGenericDoc);

// Voice & Text NLU Parsing API
app.post('/api/nlu/parse', handleNluParse);

// Telegram Bot Webhook & Simulator API
app.post('/api/telegram/message', handleTelegramMessage);

// AI Agents Execution API
app.post('/api/agents/execute', handleAgentExecution);

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
