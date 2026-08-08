import { Request, Response } from 'express';
import { customersRepository } from '../repositories/customers.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { productsRepository } from '../repositories/products.repository.js';
import { expensesRepository } from '../repositories/expenses.repository.js';
import { genericRepository } from '../repositories/generic.repository.js';
import { CollectionName } from '../firebase/firestore.js';

export async function getCustomers(req: Request, res: Response) {
  try {
    const customers = await customersRepository.getAll();
    res.json({ success: true, data: customers });
  } catch (err: any) {
    console.error('[Firestore] getCustomers error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch customers' });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const customer = await customersRepository.create(req.body);
    res.json({ success: true, data: customer });
  } catch (err: any) {
    console.error('[Firestore] createCustomer error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create customer' });
  }
}

export async function getOrders(req: Request, res: Response) {
  try {
    const orders = await ordersRepository.getAll();
    res.json({ success: true, data: orders });
  } catch (err: any) {
    console.error('[Firestore] getOrders error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch orders' });
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    const order = await ordersRepository.create(req.body);
    res.json({ success: true, data: order });
  } catch (err: any) {
    console.error('[Firestore] createOrder error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create order' });
  }
}

export async function getInventory(req: Request, res: Response) {
  try {
    const inventory = await inventoryRepository.getAll();
    res.json({ success: true, data: inventory });
  } catch (err: any) {
    console.error('[Firestore] getInventory error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch inventory' });
  }
}

export async function updateInventory(req: Request, res: Response) {
  try {
    const { quality, currentStock5L, type, reason, orderId } = req.body;
    if (!quality || currentStock5L == null) {
      return res.status(400).json({ success: false, error: 'Quality grade and stock amount are required' });
    }
    const item = await inventoryRepository.updateStock(quality, currentStock5L, type, reason, orderId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    console.error('[Firestore] updateInventory error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to update inventory' });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const products = await productsRepository.getAll();
    res.json({ success: true, data: products });
  } catch (err: any) {
    console.error('[Firestore] getProducts error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch products' });
  }
}

export async function getExpenses(req: Request, res: Response) {
  try {
    const expenses = await expensesRepository.getAll();
    res.json({ success: true, data: expenses });
  } catch (err: any) {
    console.error('[Firestore] getExpenses error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch expenses' });
  }
}

export async function createExpense(req: Request, res: Response) {
  try {
    const expense = await expensesRepository.create(req.body);
    res.json({ success: true, data: expense });
  } catch (err: any) {
    console.error('[Firestore] createExpense error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create expense' });
  }
}

const WHITELISTED_COLLECTIONS = [
  'customers',
  'products',
  'productVariants',
  'orders',
  'orderItems',
  'inventory',
  'inventoryTransactions',
  'payments',
  'leads',
  'campaigns',
  'supportTickets',
  'tasks',
  'expenses',
  'notifications',
  'auditLogs',
  'samples',
  'telegramPendingActions',
  'telegramProcessedUpdates'
];

const READ_ONLY_COLLECTIONS = [
  'payments',
  'inventoryTransactions',
  'auditLogs',
  'samples'
];

export async function getGenericCollection(req: Request, res: Response) {
  try {
    const name = req.params.name;
    if (!WHITELISTED_COLLECTIONS.includes(name)) {
      return res.status(400).json({ success: false, error: `Invalid collection name: ${name}` });
    }
    const docs = await genericRepository.getAll(name as CollectionName);
    res.json({ success: true, collection: name, data: docs });
  } catch (err: any) {
    console.error(`[Firestore] getGenericCollection ${req.params.name} error:`, err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch collection' });
  }
}

export async function createGenericDoc(req: Request, res: Response) {
  try {
    const name = req.params.name;
    if (!WHITELISTED_COLLECTIONS.includes(name)) {
      return res.status(400).json({ success: false, error: `Invalid collection name: ${name}` });
    }
    if (READ_ONLY_COLLECTIONS.includes(name)) {
      return res.status(403).json({ success: false, error: `Writes to collection ${name} are prohibited via client API.` });
    }
    const doc = await genericRepository.create(name as CollectionName, req.body);
    res.json({ success: true, collection: name, data: doc });
  } catch (err: any) {
    console.error(`[Firestore] createGenericDoc ${req.params.name} error:`, err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create document' });
  }
}
