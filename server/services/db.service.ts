import { customersRepository } from '../repositories/customers.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';

export interface DatabaseHealth {
  connected: boolean;
  type: string;
  customersCount: number;
  ordersCount: number;
  stocksCount: number;
  error?: string;
}

export const dbService = {
  getHealthStatus: async (): Promise<DatabaseHealth> => {
    try {
      const customers = await customersRepository.getAll();
      const orders = await ordersRepository.getAll();
      const stocks = await inventoryRepository.getAll();

      return {
        connected: true,
        type: 'Firebase Cloud Firestore',
        customersCount: customers.length,
        ordersCount: orders.length,
        stocksCount: stocks.length,
      };
    } catch (err: any) {
      console.error('[Firestore Health] Connection error:', err);
      return {
        connected: false,
        type: 'Firebase Cloud Firestore',
        customersCount: 0,
        ordersCount: 0,
        stocksCount: 0,
        error: err.message,
      };
    }
  },
};
