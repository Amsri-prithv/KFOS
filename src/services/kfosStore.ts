import {
  Customer,
  Order,
  OrderItem,
  SampleDistribution,
  LiquidStockPool,
  PaymentRecord,
  ReturnRecord,
  TimelineEvent,
  QualityGrade,
  ProductVariant,
  PRICING_MATRIX,
} from '../types/kfos';

const STORAGE_KEYS = {
  CUSTOMERS: 'kfos_customers_v1',
  ORDERS: 'kfos_orders_v1',
  STOCKS: 'kfos_stocks_v1',
  SAMPLES: 'kfos_samples_v1',
  PAYMENTS: 'kfos_payments_v1',
  RETURNS: 'kfos_returns_v1',
  TIMELINE: 'kfos_timeline_v1',
};

// Initial Seed Data for Kashmeer Fragrances field operations in Tamil Nadu
const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Ramesh Super Market',
    businessName: 'Ramesh Super Market',
    place: 'Trichy Main Road',
    phone: '+91 98424 12345',
    outstandingBalance: 1200,
    free200mlSamplesUsed: 1,
    totalOrdersCount: 4,
    totalSpent: 14800,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    isArchived: false,
  },
  {
    id: 'cust-2',
    name: 'Sri Murugan Traders',
    businessName: 'Sri Murugan Departmental',
    place: 'Madurai East',
    phone: '+91 97890 67890',
    outstandingBalance: 0,
    free200mlSamplesUsed: 2, // Lifetime limit reached!
    totalOrdersCount: 6,
    totalSpent: 28500,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    isArchived: false,
  },
  {
    id: 'cust-3',
    name: 'Annapoorna Hotel & Lodge',
    businessName: 'Annapoorna Hospitality',
    place: 'Chennai Anna Nagar',
    phone: '+91 94431 55432',
    outstandingBalance: 4500,
    free200mlSamplesUsed: 0,
    totalOrdersCount: 2,
    totalSpent: 9000,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    isArchived: false,
  },
  {
    id: 'cust-4',
    name: 'Kashmeer Fragrance Hub',
    businessName: 'Kashmeer Retail Outlet',
    place: 'Coimbatore RS Puram',
    phone: '+91 91234 56789',
    outstandingBalance: 0,
    free200mlSamplesUsed: 2,
    totalOrdersCount: 8,
    totalSpent: 42000,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    isArchived: false,
  },
];

const SEED_STOCKS: LiquidStockPool[] = [
  {
    quality: 'Eco',
    currentStock5L: 145, // Shared pool for Eco Room & Bathroom fresheners
    lowStockThreshold: 30,
    lastRestockedAt: new Date().toISOString(),
  },
  {
    quality: 'Standard',
    currentStock5L: 82, // Shared pool for Standard Room & Bathroom fresheners
    lowStockThreshold: 25,
    lastRestockedAt: new Date().toISOString(),
  },
  {
    quality: 'Premium',
    currentStock5L: 48, // Shared pool for Premium Room & Bathroom fresheners
    lowStockThreshold: 20,
    lastRestockedAt: new Date().toISOString(),
  },
];

const SEED_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: 'KF-2026-1001',
    customerId: 'cust-1',
    customerName: 'Ramesh Super Market',
    customerPlace: 'Trichy Main Road',
    items: [
      {
        id: 'item-1',
        productVariant: 'Room Freshener',
        quality: 'Eco',
        quantity: 5,
        buyPricePerUnit: 650,
        salePricePerUnit: 900,
        discountPerUnit: 0,
        realizedProfitPerUnit: 250,
        totalAmount: 4500,
        totalProfit: 1250,
      },
    ],
    totalAmount: 4500,
    totalDiscount: 0,
    totalProfit: 1250,
    paidAmount: 3300,
    paymentStatus: 'Partial',
    orderDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    isReturned: false,
    source: 'Telegram Voice',
    isArchived: false,
  },
  {
    id: 'ord-1002',
    orderNumber: 'KF-2026-1002',
    customerId: 'cust-2',
    customerName: 'Sri Murugan Traders',
    customerPlace: 'Madurai East',
    items: [
      {
        id: 'item-2',
        productVariant: 'Bathroom Freshener',
        quality: 'Standard',
        quantity: 10,
        buyPricePerUnit: 750,
        salePricePerUnit: 1200,
        discountPerUnit: 50, // ₹50 discount per unit
        realizedProfitPerUnit: 400, // 1200 - 750 - 50 = 400
        totalAmount: 11500, // 10 * 1150
        totalProfit: 4000,
      },
    ],
    totalAmount: 11500,
    totalDiscount: 500,
    totalProfit: 4000,
    paidAmount: 11500,
    paymentStatus: 'Paid',
    orderDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    isReturned: false,
    source: 'Telegram Text',
    isArchived: false,
  },
];

const SEED_SAMPLES: SampleDistribution[] = [
  {
    id: 'samp-1',
    customerId: 'cust-1',
    customerName: 'Ramesh Super Market',
    sampleType: '200ml',
    isFree: true,
    quantity: 1,
    chargeAmount: 0,
    profit: 0, // ₹0 profit mandate
    distributedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    followUpDueDate: new Date(Date.now() + 1 * 86400000).toISOString(), // due in 1 day
    followUpStatus: 'Pending',
    followUpNotes: 'Check if they liked the Premium Rose aroma for hotel lobby.',
  },
  {
    id: 'samp-2',
    customerId: 'cust-3',
    customerName: 'Annapoorna Hotel & Lodge',
    sampleType: '500ml',
    isFree: false,
    quantity: 1,
    chargeAmount: 300,
    profit: 0, // ₹0 profit mandate
    distributedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    followUpDueDate: new Date().toISOString(), // due today
    followUpStatus: 'Pending',
    followUpNotes: 'Follow up on 500ml test trial in 10 luxury suits.',
  },
];

const SEED_TIMELINE: TimelineEvent[] = [
  {
    id: 'time-1',
    timestamp: new Date().toISOString(),
    type: 'Order Created',
    title: 'Order #KF-2026-1002 Created',
    description: '10 Cans Standard Bathroom Freshener delivered to Sri Murugan Traders (Madurai). Profit ₹4,000.',
    customerId: 'cust-2',
    customerName: 'Sri Murugan Traders',
  },
  {
    id: 'time-2',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    type: 'Sample Distributed',
    title: '500ml Premium Sample Issued',
    description: '1x 500ml Sample issued to Annapoorna Hotel (Charged ₹300, Profit ₹0). Follow-up set for 3 days.',
    customerId: 'cust-3',
    customerName: 'Annapoorna Hotel & Lodge',
  },
];

class KFOSStore {
  private customers: Customer[] = [];
  private orders: Order[] = [];
  private stocks: LiquidStockPool[] = [];
  private samples: SampleDistribution[] = [];
  private payments: PaymentRecord[] = [];
  private returns: ReturnRecord[] = [];
  private timeline: TimelineEvent[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const c = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      this.customers = c ? JSON.parse(c) : SEED_CUSTOMERS;

      const o = localStorage.getItem(STORAGE_KEYS.ORDERS);
      this.orders = o ? JSON.parse(o) : SEED_ORDERS;

      const s = localStorage.getItem(STORAGE_KEYS.STOCKS);
      this.stocks = s ? JSON.parse(s) : SEED_STOCKS;

      const sm = localStorage.getItem(STORAGE_KEYS.SAMPLES);
      this.samples = sm ? JSON.parse(sm) : SEED_SAMPLES;

      const p = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      this.payments = p ? JSON.parse(p) : [];

      const r = localStorage.getItem(STORAGE_KEYS.RETURNS);
      this.returns = r ? JSON.parse(r) : [];

      const t = localStorage.getItem(STORAGE_KEYS.TIMELINE);
      this.timeline = t ? JSON.parse(t) : SEED_TIMELINE;
    } catch (e) {
      console.error('Error loading KFOS storage:', e);
      this.customers = SEED_CUSTOMERS;
      this.orders = SEED_ORDERS;
      this.stocks = SEED_STOCKS;
      this.samples = SEED_SAMPLES;
      this.timeline = SEED_TIMELINE;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(this.customers));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(this.stocks));
      localStorage.setItem(STORAGE_KEYS.SAMPLES, JSON.stringify(this.samples));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(this.payments));
      localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(this.returns));
      localStorage.setItem(STORAGE_KEYS.TIMELINE, JSON.stringify(this.timeline));
    } catch (e) {
      console.error('Failed to save KFOS state:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Helper Timeline logger
  public logTimeline(
    type: TimelineEvent['type'],
    title: string,
    description: string,
    customerId?: string,
    customerName?: string,
    metadata?: Record<string, any>
  ) {
    const event: TimelineEvent = {
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type,
      title,
      description,
      customerId,
      customerName,
      metadata,
    };
    this.timeline.unshift(event);
    this.saveToStorage();
  }

  // Getters
  public getCustomers(includeArchived = false): Customer[] {
    return includeArchived ? this.customers : this.customers.filter((c) => !c.isArchived);
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  public getOrders(includeArchived = false): Order[] {
    return includeArchived ? this.orders : this.orders.filter((o) => !o.isArchived);
  }

  public getLiquidStocks(): LiquidStockPool[] {
    return this.stocks;
  }

  public getSamples(): SampleDistribution[] {
    return this.samples;
  }

  public getPayments(): PaymentRecord[] {
    return this.payments;
  }

  public getReturns(): ReturnRecord[] {
    return this.returns;
  }

  public getTimeline(): TimelineEvent[] {
    return this.timeline;
  }

  // Business Logic: Check customer free 200ml sample allowance
  public canGetFreeSample(customerId: string): { allowed: boolean; remainingFree: number } {
    const customer = this.getCustomerById(customerId);
    if (!customer) return { allowed: false, remainingFree: 0 };
    const remainingFree = Math.max(0, 2 - customer.free200mlSamplesUsed);
    return {
      allowed: remainingFree > 0,
      remainingFree,
    };
  }

  // Business Logic: Add/Find Customer
  public findOrCreateCustomer(name: string, place: string, phone = ''): Customer {
    const cleanName = name.trim();
    const cleanPlace = place.trim();
    let existing = this.customers.find(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase() && c.place.toLowerCase() === cleanPlace.toLowerCase()
    );

    if (existing) return existing;

    const newCust: Customer = {
      id: 'cust-' + Date.now(),
      name: cleanName,
      place: cleanPlace || 'Tamil Nadu',
      phone: phone || '+91 90000 00000',
      outstandingBalance: 0,
      free200mlSamplesUsed: 0,
      totalOrdersCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };

    this.customers.unshift(newCust);
    this.logTimeline('Order Created', `New Customer Added: ${cleanName}`, `Location: ${cleanPlace}`, newCust.id, cleanName);
    this.saveToStorage();
    return newCust;
  }

  // Business Logic: Process New Order
  public createOrder(data: {
    customerName: string;
    customerPlace: string;
    productVariant: ProductVariant;
    quality: QualityGrade;
    quantity: number;
    discountPerUnit?: number;
    paidAmount?: number;
    source?: Order['source'];
    notes?: string;
    samplesRequested?: { sampleType: '200ml' | '500ml'; quantity: number }[];
  }): { success: boolean; order?: Order; error?: string } {
    const {
      customerName,
      customerPlace,
      productVariant,
      quality,
      quantity,
      discountPerUnit = 0,
      paidAmount = 0,
      source = 'Dashboard Manual',
      notes,
      samplesRequested = [],
    } = data;

    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be at least 1 unit' };
    }

    // 1. Check & Deduct Shared Liquid Inventory Pool
    const stockPool = this.stocks.find((s) => s.quality === quality);
    if (!stockPool) {
      return { success: false, error: `Invalid quality level ${quality}` };
    }

    if (stockPool.currentStock5L < quantity) {
      return {
        success: false,
        error: `Insufficient stock in ${quality} Liquid Stock Pool. Available: ${stockPool.currentStock5L} Cans, Required: ${quantity} Cans.`,
      };
    }

    // Deduct from shared pool
    stockPool.currentStock5L -= quantity;

    // 2. Pricing & Profit Matrix Calculations
    const pricing = PRICING_MATRIX[quality];
    const buyPrice = pricing.buyPrice;
    const salePrice = pricing.salePrice;
    const discount = Math.max(0, discountPerUnit);
    // Realized profit = salePrice - buyPrice - discount
    const realizedProfitPerUnit = salePrice - buyPrice - discount;
    const totalItemPrice = (salePrice - discount) * quantity;
    const totalItemProfit = realizedProfitPerUnit * quantity;

    // 3. Get or Create Customer
    const customer = this.findOrCreateCustomer(customerName, customerPlace);

    // 4. Create Order Object
    const orderNumber = `KF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderItem: OrderItem = {
      id: 'item-' + Date.now(),
      productVariant,
      quality,
      quantity,
      buyPricePerUnit: buyPrice,
      salePricePerUnit: salePrice,
      discountPerUnit: discount,
      realizedProfitPerUnit,
      totalAmount: totalItemPrice,
      totalProfit: totalItemProfit,
    };

    const actualPaid = Math.min(paidAmount, totalItemPrice);
    const unpaidBalance = totalItemPrice - actualPaid;

    let paymentStatus: Order['paymentStatus'] = 'Unpaid';
    if (actualPaid >= totalItemPrice) {
      paymentStatus = 'Paid';
    } else if (actualPaid > 0) {
      paymentStatus = 'Partial';
    }

    const order: Order = {
      id: 'ord-' + Date.now(),
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPlace: customer.place,
      items: [orderItem],
      totalAmount: totalItemPrice,
      totalDiscount: discount * quantity,
      totalProfit: totalItemProfit,
      paidAmount: actualPaid,
      paymentStatus,
      orderDate: new Date().toISOString(),
      isReturned: false,
      source,
      notes,
      isArchived: false,
    };

    this.orders.unshift(order);

    // Update Customer Statistics
    customer.totalOrdersCount += 1;
    customer.totalSpent += totalItemPrice;
    customer.outstandingBalance += unpaidBalance;

    // 5. Process Samples if any
    const processedSamples: SampleDistribution[] = [];
    for (const req of samplesRequested) {
      const sampleRes = this.distributeSampleInternal(customer, req.sampleType, req.quantity);
      if (sampleRes) {
        processedSamples.push(...sampleRes);
      }
    }
    if (processedSamples.length > 0) {
      order.samples = processedSamples;
    }

    // 6. Log Timeline
    this.logTimeline(
      'Order Created',
      `Order ${orderNumber} - ₹${totalItemPrice.toLocaleString('en-IN')}`,
      `${quantity} Cans of ${quality} ${productVariant} delivered to ${customer.name} (${customer.place}). Realized Profit: ₹${totalItemProfit.toLocaleString('en-IN')}. Paid: ₹${actualPaid}.`,
      customer.id,
      customer.name,
      { orderId: order.id, totalProfit: totalItemProfit, paymentStatus }
    );

    this.saveToStorage();
    return { success: true, order };
  }

  // Internal Sample Distribution Enforcement
  private distributeSampleInternal(
    customer: Customer,
    sampleType: '200ml' | '500ml',
    qty: number
  ): SampleDistribution[] {
    const list: SampleDistribution[] = [];
    const now = new Date();
    // Follow up in exactly 3 days (72 hours)
    const followUpDate = new Date(now.getTime() + 3 * 86400000).toISOString();

    for (let i = 0; i < qty; i++) {
      let isFree = false;
      let chargeAmount = 0;

      // Rule C: Only Premium Quality samples. Lifetime free limit: 2 x 200ml free per customer.
      if (sampleType === '200ml') {
        if (customer.free200mlSamplesUsed < 2) {
          isFree = true;
          chargeAmount = 0;
          customer.free200mlSamplesUsed += 1;
        } else {
          isFree = false;
          chargeAmount = 200; // Paid 200ml
        }
      } else {
        // 500ml is ALWAYS paid ₹300
        isFree = false;
        chargeAmount = 300;
      }

      const sample: SampleDistribution = {
        id: 'samp-' + Date.now() + '-' + i,
        customerId: customer.id,
        customerName: customer.name,
        sampleType,
        isFree,
        quantity: 1,
        chargeAmount,
        profit: 0, // CRITICAL MANDATE: ₹0 PROFIT FOR SAMPLES
        distributedAt: now.toISOString(),
        followUpDueDate: followUpDate,
        followUpStatus: 'Pending',
        followUpNotes: `Automated 3-day follow-up for ${sampleType} ${isFree ? 'Free' : 'Paid'} Premium Sample.`,
      };

      this.samples.unshift(sample);
      list.push(sample);

      if (chargeAmount > 0) {
        customer.outstandingBalance += chargeAmount;
      }

      this.logTimeline(
        'Sample Distributed',
        `Sample ${sampleType} (${isFree ? 'FREE' : '₹' + chargeAmount}) Issued`,
        `Issued to ${customer.name}. Mandatory ₹0 profit applied. Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString('en-IN')}.`,
        customer.id,
        customer.name
      );
    }
    return list;
  }

  // Public Direct Sample Distribution Method
  public distributeSample(customerId: string, sampleType: '200ml' | '500ml', count = 1): { success: boolean; message?: string } {
    const customer = this.getCustomerById(customerId);
    if (!customer) return { success: false, message: 'Customer not found' };

    const list = this.distributeSampleInternal(customer, sampleType, count);
    this.saveToStorage();
    return {
      success: true,
      message: `Successfully distributed ${count}x ${sampleType} sample(s) to ${customer.name}. Follow-up reminder active for 3 days.`,
    };
  }

  // Complete Follow-Up
  public completeFollowUp(sampleId: string, notes?: string) {
    const s = this.samples.find((samp) => samp.id === sampleId);
    if (s) {
      s.followUpStatus = 'Completed';
      if (notes) s.followUpNotes = notes;
      this.logTimeline('FollowUp Scheduled', `Follow-up Completed for ${s.customerName}`, notes || 'Customer responded to sample trial.', s.customerId, s.customerName);
      this.saveToStorage();
    }
  }

  // Business Logic: Return & Profit Reversal Rules
  public processReturn(orderId: string, reason: string): { success: boolean; message?: string } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };
    if (order.isReturned) return { success: false, message: 'Order has already been returned' };

    // 1. Restore Physical Inventory Stock Immediately
    order.items.forEach((item) => {
      const stockPool = this.stocks.find((s) => s.quality === item.quality);
      if (stockPool) {
        stockPool.currentStock5L += item.quantity;
      }
    });

    // 2. Automatically Reverse (Deduct) Per-Unit Profit from Net Metrics
    const reversedProfit = order.totalProfit;
    const refundAmount = order.totalAmount;

    order.isReturned = true;
    order.returnedAt = new Date().toISOString();
    order.returnReason = reason;

    // Update Customer records
    const customer = this.getCustomerById(order.customerId);
    if (customer) {
      customer.outstandingBalance = Math.max(0, customer.outstandingBalance - (order.totalAmount - order.paidAmount));
      customer.totalSpent = Math.max(0, customer.totalSpent - order.totalAmount);
    }

    // Record Return
    const returnRecord: ReturnRecord = {
      id: 'ret-' + Date.now(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      returnedItems: order.items.map((i) => ({
        productVariant: i.productVariant,
        quality: i.quality,
        quantity: i.quantity,
        reversedProfit: i.totalProfit,
      })),
      totalReversedProfit: reversedProfit,
      totalRefundAmount: refundAmount,
      returnedAt: new Date().toISOString(),
      reason,
    };

    this.returns.unshift(returnRecord);

    // 3. Log Return Event on Customer Timeline & Audit Log
    this.logTimeline(
      'Return Processed',
      `RETURN: Order ${order.orderNumber} - Stock Restored`,
      `Returned ${order.items.map((i) => `${i.quantity}x ${i.quality} ${i.productVariant}`).join(', ')}. Restored liquid stock pool. Reversed Profit: -₹${reversedProfit.toLocaleString('en-IN')}. Reason: ${reason}`,
      order.customerId,
      order.customerName,
      { orderId, reversedProfit, refundAmount }
    );

    this.saveToStorage();
    return {
      success: true,
      message: `Return processed. ${order.items.map((i) => i.quantity).reduce((a, b) => a + b, 0)} Cans returned to Liquid Pool. Reversed Profit: -₹${reversedProfit}`,
    };
  }

  // Business Logic: Record Payment
  public recordPayment(orderId: string, amount: number, method: PaymentRecord['paymentMethod'], notes?: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    order.paidAmount += amount;
    if (order.paidAmount >= order.totalAmount) {
      order.paymentStatus = 'Paid';
    } else {
      order.paymentStatus = 'Partial';
    }

    const customer = this.getCustomerById(order.customerId);
    if (customer) {
      customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount);
    }

    const payment: PaymentRecord = {
      id: 'pay-' + Date.now(),
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      amount,
      paymentMethod: method,
      receivedAt: new Date().toISOString(),
      notes,
    };

    this.payments.unshift(payment);

    this.logTimeline(
      'Payment Received',
      `Payment Received: ₹${amount.toLocaleString('en-IN')} (${method})`,
      `Received from ${order.customerName} for Order ${order.orderNumber}. Balance remaining: ₹${Math.max(0, order.totalAmount - order.paidAmount).toLocaleString('en-IN')}.`,
      order.customerId,
      order.customerName
    );

    this.saveToStorage();
    return { success: true, message: `Payment of ₹${amount} recorded for ${order.customerName}` };
  }

  // Restock Liquid Stock Pool
  public restockLiquidPool(quality: QualityGrade, addedCans: number): { success: boolean; message: string } {
    const pool = this.stocks.find((s) => s.quality === quality);
    if (!pool) return { success: false, message: 'Invalid stock pool' };

    pool.currentStock5L += addedCans;
    pool.lastRestockedAt = new Date().toISOString();

    this.logTimeline(
      'Stock Restocked',
      `Restocked ${addedCans} Cans to ${quality} Pool`,
      `Shared Liquid Pool (${quality}) now has ${pool.currentStock5L} Cans total.`,
      undefined,
      undefined,
      { quality, addedCans, total: pool.currentStock5L }
    );

    this.saveToStorage();
    return { success: true, message: `Added ${addedCans} Cans to ${quality} Pool. New total: ${pool.currentStock5L} Cans.` };
  }

  // Soft Delete with Undo Recovery Support
  public softDeleteOrder(orderId: string): { success: boolean; undoAction: () => void } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, undoAction: () => {} };

    order.isArchived = true;
    this.saveToStorage();

    const undoAction = () => {
      order.isArchived = false;
      this.saveToStorage();
      this.logTimeline('Order Created', `Restored Order ${order.orderNumber}`, `Un-archived order for ${order.customerName}`, order.customerId, order.customerName);
    };

    this.logTimeline('Return Processed', `Archived Order ${order.orderNumber}`, `Soft deleted order for ${order.customerName}`, order.customerId, order.customerName);
    return { success: true, undoAction };
  }

  public softDeleteCustomer(customerId: string): { success: boolean; undoAction: () => void } {
    const customer = this.getCustomerById(customerId);
    if (!customer) return { success: false, undoAction: () => {} };

    customer.isArchived = true;
    this.saveToStorage();

    const undoAction = () => {
      customer.isArchived = false;
      this.saveToStorage();
    };

    return { success: true, undoAction };
  }

  // Global Search Engine (<1 Second response across all modules)
  public globalSearch(query: string) {
    if (!query || query.trim().length === 0) {
      return { customers: [], orders: [], samples: [], timeline: [] };
    }

    const q = query.toLowerCase().trim();

    const matchedCustomers = this.getCustomers().filter(
      (c) => c.name.toLowerCase().includes(q) || c.place.toLowerCase().includes(q) || c.phone.includes(q)
    );

    const matchedOrders = this.getOrders().filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPlace.toLowerCase().includes(q) ||
        o.items.some((i) => i.quality.toLowerCase().includes(q) || i.productVariant.toLowerCase().includes(q))
    );

    const matchedSamples = this.samples.filter(
      (s) => s.customerName.toLowerCase().includes(q) || s.sampleType.toLowerCase().includes(q)
    );

    const matchedTimeline = this.timeline.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );

    return {
      customers: matchedCustomers,
      orders: matchedOrders,
      samples: matchedSamples,
      timeline: matchedTimeline,
    };
  }

  // Calculate System Financial KPIs
  public getFinancialKPIs() {
    const activeOrders = this.getOrders().filter((o) => !o.isReturned);
    const totalRevenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalProfit = activeOrders.reduce((sum, o) => sum + o.totalProfit, 0);

    // Today's Date String
    const todayISO = new Date().toISOString().split('T')[0];
    const todayOrders = activeOrders.filter((o) => o.orderDate.startsWith(todayISO));
    const todayProfit = todayOrders.reduce((sum, o) => sum + o.totalProfit, 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const totalOutstanding = this.getCustomers().reduce((sum, c) => sum + c.outstandingBalance, 0);
    const totalCustomers = this.getCustomers().length;

    const lowStockAlerts = this.stocks.filter((s) => s.currentStock5L <= s.lowStockThreshold);

    const pendingFollowUps = this.samples.filter((s) => s.followUpStatus === 'Pending');

    return {
      totalRevenue,
      totalProfit,
      todayProfit,
      todayRevenue,
      todayOrdersCount: todayOrders.length,
      totalOutstanding,
      totalCustomers,
      lowStockAlerts,
      pendingFollowUpsCount: pendingFollowUps.length,
    };
  }
}

export const kfosStore = new KFOSStore();
