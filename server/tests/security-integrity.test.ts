import { describe, it, expect } from 'vitest';
import { customersRepository } from '../repositories/customers.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';

describe('KFOS Security & Financial Integrity Regression Tests', () => {
  it('rejects payment exceeding customer outstanding balance', async () => {
    const cust = await customersRepository.create({
      name: 'Test Limit Customer',
      businessName: 'Test Limit Biz',
      phone: '9876543210',
      place: 'Chennai',
    });
    await expect(
      customersRepository.recordPaymentAtomic({
        customerId: cust.id,
        amount: 1000,
        recordedBy: 'Test Runner',
      })
    ).rejects.toThrow(/Payment amount cannot exceed customer outstanding balance/);
  });

  it('rejects invalid or negative payment amounts', async () => {
    const cust = await customersRepository.create({
      name: 'Test Amount Customer',
      businessName: 'Test Amount Biz',
      phone: '9876543211',
      place: 'Madurai',
    });

    await expect(
      customersRepository.recordPaymentAtomic({
        customerId: cust.id,
        amount: -50,
        recordedBy: 'Test Runner',
      })
    ).rejects.toThrow(/Payment amount must be a positive finite number/);

    await expect(
      customersRepository.recordPaymentAtomic({
        customerId: cust.id,
        amount: NaN,
        recordedBy: 'Test Runner',
      })
    ).rejects.toThrow(/Payment amount must be a positive finite number/);
  });

  it('ignores/rejects injected financial/system fields during customer creation (mass-assignment protection)', async () => {
    const maliciousPayload = {
      name: 'Injected Customer',
      businessName: 'Injected Biz',
      phone: '9999999999',
      place: 'Trichy',
      outstandingBalance: -999999,
      totalSpent: 500000,
      totalOrdersCount: 999,
      free200mlSamplesUsed: 10,
    } as any;

    const created = await customersRepository.create(maliciousPayload);
    expect(created.outstandingBalance).toBe(0);
    expect(created.totalSpent).toBe(0);
    expect(created.totalOrdersCount).toBe(0);
    expect(created.free200mlSamplesUsed).toBe(0);
  });

  it('rejects order creation with paidAmount exceeding order total or negative', async () => {
    const cust = await customersRepository.create({
      name: 'Order Test Customer',
      businessName: 'Order Test Biz',
      phone: '8888888888',
      place: 'Coimbatore',
    });

    // Ensure stock exists for Standard
    await inventoryRepository.updateStockAtomic('Standard', 50, 'RESTOCK', 'Test stock seeding');

    const orderData = {
      customerId: cust.id,
      customerName: cust.name,
      items: [
        {
          productVariant: 'Room Freshener' as const,
          quality: 'Standard' as const,
          quantity: 2,
          discountPerUnit: 0,
        },
      ],
      paidAmount: 50000, // Exceeds total
      paymentStatus: 'Paid' as const,
      orderStatus: 'Confirmed' as const,
      paymentMethod: 'Cash' as const,
      createdByUser: 'Test Runner',
    };

    await expect(ordersRepository.createOrderAtomic(orderData)).rejects.toThrow(
      /Paid amount cannot exceed total order amount/
    );

    const negativePaidData = {
      ...orderData,
      paidAmount: -100,
    };

    await expect(ordersRepository.createOrderAtomic(negativePaidData)).rejects.toThrow(
      /Paid amount cannot be negative/
    );
  });
});
