import { Request, Response } from 'express';
import { customersRepository } from '../repositories/customers.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { productsRepository } from '../repositories/products.repository.js';
import { expensesRepository } from '../repositories/expenses.repository.js';
import { genericRepository } from '../repositories/generic.repository.js';
import { CollectionName } from '../firebase/firestore.js';
import { COLLECTION_PERMISSIONS } from '../config/permissions.js';

function sanitizeErrorMessage(err: any, defaultMsg: string): string {
  if (!err) return defaultMsg;
  const msg = err.message || '';
  const isValidationError = 
    msg.includes('required') || 
    msg.includes('must be') || 
    msg.includes('limit') || 
    msg.includes('reached') || 
    msg.includes('Insufficient') || 
    msg.includes('already') || 
    msg.includes('Invalid') ||
    msg.includes('prohibited') ||
    msg.includes('not found') ||
    msg.includes('maximum') ||
    msg.includes('exceed') ||
    msg.includes('cannot') ||
    msg.includes('balance') ||
    msg.includes('negative') ||
    msg.includes('finite');

  if (isValidationError) {
    return msg;
  }
  return defaultMsg;
}

export async function getCustomers(req: Request, res: Response) {
  try {
    const customers = await customersRepository.getAll();
    res.json({ success: true, data: customers });
  } catch (err: any) {
    console.error('[Firestore] getCustomers error:', err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch customers') });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const { name, businessName, phone, place } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Customer name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, error: 'Customer name is too long' });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      return res.status(400).json({ success: false, error: 'Invalid customer phone number' });
    }
    if (place && (typeof place !== 'string' || place.length > 100)) {
      return res.status(400).json({ success: false, error: 'Invalid customer place name' });
    }
    if (businessName && (typeof businessName !== 'string' || businessName.length > 100)) {
      return res.status(400).json({ success: false, error: 'Invalid business name' });
    }

    // Pass ONLY whitelisted editable fields to prevent mass-assignment
    const customer = await customersRepository.create({
      name: name.trim(),
      businessName: businessName?.trim() || name.trim(),
      phone: phone?.trim() || '',
      place: place?.trim() || '',
    });
    res.json({ success: true, data: customer });
  } catch (err: any) {
    console.error('[Firestore] createCustomer error:', err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to create customer') });
  }
}

export async function getOrders(req: Request, res: Response) {
  try {
    const orders = await ordersRepository.getAll();
    res.json({ success: true, data: orders });
  } catch (err: any) {
    console.error('[Firestore] getOrders error:', err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch orders') });
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    const { customerId, items, paidAmount } = req.body;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one product item' });
    }
    if (items.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum order items exceeded (limit 50)' });
    }

    for (const item of items) {
      if (!item.productVariant || typeof item.productVariant !== 'string') {
        return res.status(400).json({ success: false, error: 'Product variant is required for all items' });
      }
      if (!item.quality || typeof item.quality !== 'string') {
        return res.status(400).json({ success: false, error: 'Quality grade is required for all items' });
      }
      const qty = Number(item.quantity);
      if (typeof item.quantity !== 'number' || Number.isNaN(qty) || !Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0 || qty > 10000) {
        return res.status(400).json({ success: false, error: 'Quantity must be a positive integer below 10,000' });
      }
      const disc = Number(item.discountPerUnit || 0);
      if (typeof item.discountPerUnit === 'number' && (Number.isNaN(disc) || !Number.isFinite(disc) || disc < 0 || disc > 100000)) {
        return res.status(400).json({ success: false, error: 'Discount must be a non-negative finite number' });
      }
    }

    if (paidAmount !== undefined) {
      const paid = Number(paidAmount);
      if (typeof paidAmount !== 'number' || Number.isNaN(paid) || !Number.isFinite(paid) || paid < 0) {
        return res.status(400).json({ success: false, error: 'Paid amount must be a non-negative finite number' });
      }
    }

    const order = await ordersRepository.createOrderAtomic(req.body);
    res.json({ success: true, data: order });
  } catch (err: any) {
    console.error('[Firestore] createOrder error:', err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to create order') });
  }
}

export async function getInventory(req: Request, res: Response) {
  try {
    const inventory = await inventoryRepository.getAll();
    res.json({ success: true, data: inventory });
  } catch (err: any) {
    console.error('[Firestore] getInventory error:', err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch inventory') });
  }
}

export async function updateInventory(req: Request, res: Response) {
  try {
    const { quality, currentStock5L, type, reason, orderId } = req.body;
    if (!quality || typeof quality !== 'string') {
      return res.status(400).json({ success: false, error: 'Quality grade is required' });
    }
    if (currentStock5L == null) {
      return res.status(400).json({ success: false, error: 'Stock amount is required' });
    }
    const stockNum = Number(currentStock5L);
    if (typeof currentStock5L !== 'number' || Number.isNaN(stockNum) || !Number.isFinite(stockNum) || stockNum < 0 || stockNum > 100000) {
      return res.status(400).json({ success: false, error: 'Stock amount must be a non-negative finite integer below 100,000' });
    }

    const item = await inventoryRepository.updateStock(quality as any, currentStock5L, type, reason, orderId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    console.error('[Firestore] updateInventory error:', err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to update inventory') });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const products = await productsRepository.getAll();
    res.json({ success: true, data: products });
  } catch (err: any) {
    console.error('[Firestore] getProducts error:', err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch products') });
  }
}

export async function getExpenses(req: Request, res: Response) {
  try {
    const expenses = await expensesRepository.getAll();
    res.json({ success: true, data: expenses });
  } catch (err: any) {
    console.error('[Firestore] getExpenses error:', err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch expenses') });
  }
}

export async function createExpense(req: Request, res: Response) {
  try {
    const { title, amount } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Expense title is required' });
    }
    if (amount == null) {
      return res.status(400).json({ success: false, error: 'Expense amount is required' });
    }
    const amtNum = Number(amount);
    if (typeof amount !== 'number' || Number.isNaN(amtNum) || !Number.isFinite(amtNum) || amtNum <= 0) {
      return res.status(400).json({ success: false, error: 'Expense amount must be a positive finite number' });
    }

    const expense = await expensesRepository.create(req.body);
    res.json({ success: true, data: expense });
  } catch (err: any) {
    console.error('[Firestore] createExpense error:', err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to create expense') });
  }
}

export async function createPayment(req: Request, res: Response) {
  try {
    const { customerId, amount, notes, idempotencyKey } = req.body;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }
    if (amount == null) {
      return res.status(400).json({ success: false, error: 'Payment amount is required' });
    }

    const amtNum = Number(amount);
    if (typeof amount !== 'number' || Number.isNaN(amtNum) || !Number.isFinite(amtNum) || amtNum <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be a positive finite number' });
    }

    const recordedBy = (req as any).user?.name || 'System';

    const result = await customersRepository.recordPaymentAtomic({
      customerId,
      amount: amtNum,
      idempotencyKey,
      recordedBy,
      notes,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Firestore] createPayment error:', err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to record payment') });
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
  'telegramProcessedUpdates',
  'returns'
];

const READ_ONLY_COLLECTIONS = [
  'customers',
  'orders',
  'orderItems',
  'inventory',
  'inventoryTransactions',
  'payments',
  'expenses',
  'samples',
  'products',
  'productVariants',
  'auditLogs',
  'telegramPendingActions',
  'telegramProcessedUpdates'
];

export async function getGenericCollection(req: Request, res: Response) {
  try {
    const name = req.params.name;
    if (!WHITELISTED_COLLECTIONS.includes(name)) {
      return res.status(400).json({ success: false, error: `Invalid collection name: ${name}` });
    }

    // Explicit Role-Based Collection Level Access Enforcement
    const userRole = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User role not found' });
    }

    const allowedRoles = COLLECTION_PERMISSIONS[name]?.read || [];
    if (userRole !== 'Founder' && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: `Access Denied: Role ${userRole} is not authorized to read collection ${name}` });
    }

    const docs = await genericRepository.getAll(name as CollectionName);
    res.json({ success: true, collection: name, data: docs });
  } catch (err: any) {
    console.error(`[Firestore] getGenericCollection ${req.params.name} error:`, err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to fetch collection') });
  }
}

export async function createGenericDoc(req: Request, res: Response) {
  try {
    const name = req.params.name;
    if (!WHITELISTED_COLLECTIONS.includes(name)) {
      return res.status(400).json({ success: false, error: `Invalid collection name: ${name}` });
    }

    // Explicit Role-Based Collection Level Access Enforcement
    const userRole = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User role not found' });
    }

    const allowedRoles = COLLECTION_PERMISSIONS[name]?.write || [];
    if (userRole !== 'Founder' && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: `Access Denied: Role ${userRole} is not authorized to write to collection ${name}` });
    }

    if (READ_ONLY_COLLECTIONS.includes(name)) {
      return res.status(403).json({ success: false, error: `Writes to collection ${name} are prohibited via generic API.` });
    }
    
    // Prevent mass assignment or privilege escalation. Sanitise input data:
    const data = { ...req.body };
    delete data._systemSecret;
    delete data.isAdmin;
    delete data.role;

    const doc = await genericRepository.create(name as CollectionName, data);
    res.json({ success: true, collection: name, data: doc });
  } catch (err: any) {
    console.error(`[Firestore] createGenericDoc ${req.params.name} error:`, err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to create document') });
  }
}

const PATCH_ALLOWED_FIELDS: Record<string, string[]> = {
  leads: ['status'],
  supportTickets: ['status'],
  tasks: ['status'],
  samples: ['followUpStatus', 'followUpNotes'],
};

export async function updateGenericDoc(req: Request, res: Response) {
  try {
    const { name, id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Document ID is required' });
    }
    if (!WHITELISTED_COLLECTIONS.includes(name)) {
      return res.status(400).json({ success: false, error: `Invalid collection name: ${name}` });
    }

    // Explicit Role-Based Collection Level Access Enforcement
    const userRole = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User role not found' });
    }

    const allowedRoles = COLLECTION_PERMISSIONS[name]?.write || [];
    if (userRole !== 'Founder' && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: `Access Denied: Role ${userRole} is not authorized to update collection ${name}` });
    }

    const allowedFields = PATCH_ALLOWED_FIELDS[name];
    if (!allowedFields) {
      return res.status(403).json({ success: false, error: `Updates to collection ${name} are prohibited.` });
    }

    // Verify document existence first to respect resource authorization
    const existing = await genericRepository.getById(name as CollectionName, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Document ${id} not found in collection ${name}` });
    }

    // Filter req.body to only allowed fields
    const data: Record<string, any> = {};
    for (const key of Object.keys(req.body)) {
      if (allowedFields.includes(key)) {
        data[key] = req.body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'No writable fields provided or permitted' });
    }

    const doc = await genericRepository.update(name as CollectionName, id, data);
    res.json({ success: true, collection: name, data: doc });
  } catch (err: any) {
    console.error(`[Firestore] updateGenericDoc ${req.params.name}/${req.params.id} error:`, err);
    res.status(400).json({ success: false, error: sanitizeErrorMessage(err, 'Failed to update document') });
  }
}
