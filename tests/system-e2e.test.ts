import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
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
    }, 30000);
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

  describe('4. Concurrent Inventory Deduction', () => {
    it('only allows one of two simultaneous orders to succeed when total stock is exceeded, and properly rolls back the other', async () => {
      // Set initial Standard stock to 10
      await inventoryRepository.updateStock('Standard', 10);

      const cust = await customersRepository.create({
        name: 'Concurrent Stock Test Customer',
        place: 'Coimbatore',
        phone: `+91 95555 ${Math.floor(10000 + Math.random() * 90000)}`,
        outstandingBalance: 0,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      // Run Order A and Order B simultaneously, each requesting 7 Standard items
      const orderParams = {
        customerId: cust.id,
        customerName: cust.name,
        customerPlace: cust.place,
        items: [
          {
            productVariant: 'Room Freshener' as const,
            quality: 'Standard' as const,
            quantity: 7,
          },
        ],
      };

      const [resA, resB] = await Promise.allSettled([
        ordersRepository.createOrderAtomic(orderParams),
        ordersRepository.createOrderAtomic(orderParams),
      ]);

      console.log('CONCURRENT INVENTORY TEST DEBUG:', JSON.stringify({ resA, resB }, null, 2));

      const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
      const rejected = [resA, resB].filter((r) => r.status === 'rejected');

      // Exactly one must succeed, exactly one must fail
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify final stock is exactly 3
      const allStocks = await inventoryRepository.getAll();
      const standardStock = allStocks.find((s) => s.quality === 'Standard');
      expect(standardStock?.currentStock5L).toBe(3);

      // Verify customer balance matches only the successful order
      const updatedCust = await customersRepository.getById(cust.id);
      const successfulOrder = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      const unpaidBalance = successfulOrder.totalAmount - (successfulOrder.paidAmount || 0);
      expect(updatedCust?.outstandingBalance).toBe(unpaidBalance);
      expect(updatedCust?.totalOrdersCount).toBe(1);
    });
  });

  describe('5. Concurrent Payment Processing and Idempotency', () => {
    it('serializes two simultaneous different payments correctly without any lost update', async () => {
      const cust = await customersRepository.create({
        name: 'Concurrent Payment Test Customer',
        place: 'Erode',
        phone: `+91 94444 ${Math.floor(10000 + Math.random() * 90000)}`,
        outstandingBalance: 10000,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      // Send ₹4000 and ₹3000 payments simultaneously
      const [res1, res2] = await Promise.allSettled([
        customersRepository.recordPaymentAtomic({
          customerId: cust.id,
          amount: 4000,
          recordedBy: 'Terminal A',
        }),
        customersRepository.recordPaymentAtomic({
          customerId: cust.id,
          amount: 3000,
          recordedBy: 'Terminal B',
        }),
      ]);

      expect(res1.status).toBe('fulfilled');
      expect(res2.status).toBe('fulfilled');

      // Outstanding balance should be exactly 10000 - 4000 - 3000 = 3000
      const updatedCust = await customersRepository.getById(cust.id);
      expect(updatedCust?.outstandingBalance).toBe(3000);
    });

    it('processes same-key idempotent payments exactly once', async () => {
      const cust = await customersRepository.create({
        name: 'Idempotency Test Customer',
        place: 'Salem',
        phone: `+91 93333 ${Math.floor(10000 + Math.random() * 90000)}`,
        outstandingBalance: 5000,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      const key = `key-${randomUUID()}`;

      // Call twice with the same idempotencyKey concurrently
      const [res1, res2] = await Promise.allSettled([
        customersRepository.recordPaymentAtomic({
          customerId: cust.id,
          amount: 2000,
          idempotencyKey: key,
          recordedBy: 'API client',
        }),
        customersRepository.recordPaymentAtomic({
          customerId: cust.id,
          amount: 2000,
          idempotencyKey: key,
          recordedBy: 'API client',
        }),
      ]);

      expect(res1.status).toBe('fulfilled');
      expect(res2.status).toBe('fulfilled');

      // Outstanding balance should only be reduced once (5000 - 2000 = 3000)
      const updatedCust = await customersRepository.getById(cust.id);
      expect(updatedCust?.outstandingBalance).toBe(3000);
    });
  });

  describe('6. Same-quality Multi-item Order Processing', () => {
    it('aggregates stock needs and processes successfully when multiple items have the same quality grade', async () => {
      await inventoryRepository.updateStock('Premium', 10);

      const cust = await customersRepository.create({
        name: 'Multi Item Test Customer',
        place: 'Kanyakumari',
        phone: `+91 92222 ${Math.floor(10000 + Math.random() * 90000)}`,
        outstandingBalance: 0,
        free200mlSamplesUsed: 0,
        totalOrdersCount: 0,
        totalSpent: 0,
        isArchived: false,
      });

      // Create order with 2 different Premium products (quantities 2 and 3, total 5)
      const order = await ordersRepository.createOrderAtomic({
        customerId: cust.id,
        customerName: cust.name,
        customerPlace: cust.place,
        items: [
          {
            productVariant: 'Room Freshener' as const,
            quality: 'Premium' as const,
            quantity: 2,
          },
          {
            productVariant: 'Bathroom Freshener' as const,
            quality: 'Premium' as const,
            quantity: 3,
          },
        ],
      });

      expect(order.id).toBeDefined();
      expect(order.items.length).toBe(2);

      // Standard stock should be reduced by 5 (10 - 5 = 5)
      const allStocks = await inventoryRepository.getAll();
      const premiumStock = allStocks.find((s) => s.quality === 'Premium');
      expect(premiumStock?.currentStock5L).toBe(5);
    });
  });
});
