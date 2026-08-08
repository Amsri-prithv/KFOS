import { firestoreDb } from './admin.js';
import { Timestamp } from 'firebase-admin/firestore';

export const COLLECTIONS = {
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  PRODUCT_VARIANTS: 'productVariants',
  ORDERS: 'orders',
  ORDER_ITEMS: 'orderItems',
  INVENTORY: 'inventory',
  INVENTORY_TRANSACTIONS: 'inventoryTransactions',
  PAYMENTS: 'payments',
  LEADS: 'leads',
  CAMPAIGNS: 'campaigns',
  SUPPORT_TICKETS: 'supportTickets',
  TASKS: 'tasks',
  EXPENSES: 'expenses',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export function getCollectionRef(collectionName: CollectionName) {
  return firestoreDb.collection(collectionName);
}

export function prepareDataForInsert<T extends Record<string, any>>(data: T): T & { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return {
    ...data,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function prepareDataForUpdate<T extends Record<string, any>>(data: Partial<T>): Partial<T> & { updatedAt: string } {
  const now = new Date().toISOString();
  return {
    ...data,
    updatedAt: now,
  };
}

export { firestoreDb };
