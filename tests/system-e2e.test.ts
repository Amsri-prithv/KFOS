import { describe, it, expect, beforeAll } from 'vitest';
import { claimAndExecutePendingActionAtomic } from '../server/services/telegram.service.js';
import { customersRepository } from '../server/repositories/customers.repository.js';
import { ordersRepository } from '../server/repositories/orders.repository.js';
import { inventoryRepository } from '../server/repositories/inventory.repository.js';

describe('KFOS Production Safety & Concurrency E2E Test Suite', () => {
  let testCustomerId: string;

  beforeAll(async () => {
    // Setup clean test customer in Firestore
    const cust = await customersRepository.create({
      name: 'E2E Test Customer Supermarket',
      businessName: 'E2E Test Retail',
      place: 'Trichy Test Zone',
      phone: '+91 99999 11111',
      outstandingBalance: 1000,
      free200mlSamplesUsed: 0,
      totalOrdersCount: 0,
      totalSpent: 0,
      isArchived: false,
    });
    testCustomerId = cust.id;
  });

  describe('1. Telegram Pending Action Concurrency Locking', () => {
    it('prevents double execution when two identical confirmation requests arrive simultaneously', async () => {
      const chatId = 'test_chat_concurrency_999';
      const telegramUserId = 'test_user_777';

      // Set up mock pending action directly using user-isolated keying
      const { setPendingActionPersistent } = await import('../server/services/telegram.service.js');
      
      await setPendingActionPersistent(chatId, telegramUserId, {
        intent: 'RECORD_PAYMENT',
        data: { customerId: testCustomerId, amount: 200 },
        summaryText: 'Record payment of ₹200',
      });

      // Fire two concurrent claimAndExecute requests simultaneously
      const executor = async () => {
        await customersRepository.recordPaymentAtomic({
          customerId: testCustomerId,
          amount: 200,
          recordedBy: 'Concurrent Test Runner',
        });
        return 'Payment recorded successfully';
      };

      const [res1, res2] = await Promise.allSettled([
        claimAndExecutePendingActionAtomic(chatId, telegramUserId, executor),
        claimAndExecutePendingActionAtomic(chatId, telegramUserId, executor),
      ]);

      // Exactly ONE request must succeed; the other must be rejected due to atomic status lock
      const fulfilledCount = [res1, res2].filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.success).length;
      const rejectedCount = [res1, res2].filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r as PromiseFulfilledResult<any>).value.success)).length;

      expect(fulfilledCount).toBe(1);
      expect(rejectedCount).toBe(1);
    });
  });

  describe('2. Sample Limit Enforcement (Max 3 Lifetime)', () => {
    it('strictly rejects the 4th free 200ml sample request for a customer', async () => {
      const sampleCust = await customersRepository.create({
        name: 'Sample Limit Test Customer',
        place: 'Madurai',
        phone: '+91 98888 22222',
        outstandingBalance: 0,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      // Record 3 samples
      await customersRepository.recordSampleAtomic({ customerId: sampleCust.id, sampleType: '200ml' });
      await customersRepository.recordSampleAtomic({ customerId: sampleCust.id, sampleType: '200ml' });
      await customersRepository.recordSampleAtomic({ customerId: sampleCust.id, sampleType: '200ml' });

      // 4th sample must throw error
      await expect(
        customersRepository.recordSampleAtomic({ customerId: sampleCust.id, sampleType: '200ml' })
      ).rejects.toThrow(/Lifetime free 200ml sample limit \(3\) reached|maximum limit/i);
    });
  });

  describe('3. Atomic Transaction Rollbacks on Insufficient Inventory', () => {
    it('rolls back order creation and customer balance updates if liquid stock pool is insufficient', async () => {
      const cust = await customersRepository.create({
        name: 'Stock Rollback Test Customer',
        place: 'Chennai',
        phone: '+91 97777 33333',
        outstandingBalance: 0,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      const allStocks = await inventoryRepository.getAll();
      const ecoStock = allStocks.find(s => s.quality === 'Eco');
      const crazyExcessiveQty = (ecoStock?.currentStock5L || 100) + 99999;

      // Attempt creating order exceeding available stock
      await expect(
        ordersRepository.createOrderAtomic({
          customerId: cust.id,
          customerName: cust.name,
          customerPlace: cust.place,
          items: [
            {
              productVariant: 'Room Freshener',
              quality: 'Eco',
              quantity: crazyExcessiveQty,
            },
          ],
        })
      ).rejects.toThrow(/Insufficient Eco stock|Insufficient stock/i);

      // Verify customer balance remained 0 (no partial updates applied)
      const updatedCust = await customersRepository.getById(cust.id);
      expect(updatedCust?.outstandingBalance).toBe(0);
    });
  });
});
