import { customersRepository } from '../repositories/customers.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';

export interface DatabaseHealth {
  connected: boolean;
  type: string;
  customersCount: number;
  ordersCount: number;
  stocksCount: number;
  latencyMs?: number;
  warnings?: Array<{ quality: string; currentStock5L: number; message: string }>;
  hasWarnings?: boolean;
  error?: string;
}

export const dbService = {
  getHealthStatus: async (): Promise<DatabaseHealth> => {
    try {
      const startTime = performance.now();
      const customers = await customersRepository.getAll();
      const orders = await ordersRepository.getAll();
      const stocks = await inventoryRepository.getAll();
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      const lowStockWarnings = stocks
        .filter(s => s.currentStock5L < 200)
        .map(s => ({
          quality: s.quality,
          currentStock5L: s.currentStock5L,
          message: `Warning: Inventory for ${s.quality} is low (${s.currentStock5L}L), below the 200L safety threshold.`
        }));

      return {
        connected: true,
        type: 'Firebase Cloud Firestore',
        customersCount: customers.length,
        ordersCount: orders.length,
        stocksCount: stocks.length,
        latencyMs,
        warnings: lowStockWarnings,
        hasWarnings: lowStockWarnings.length > 0,
      };
    } catch (err: any) {
      console.error('[Firestore Health] Connection error:', err);
      return {
        connected: false,
        type: 'Firebase Cloud Firestore',
        customersCount: 0,
        ordersCount: 0,
        stocksCount: 0,
        latencyMs: 0,
        warnings: [],
        hasWarnings: false,
        error: err.message,
      };
    }
  },
};
