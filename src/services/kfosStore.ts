import {
  Customer,
  Order,
  OrderItem,
  SampleDistribution,
  LiquidStockPool,
  PaymentRecord,
  ExpenseRecord,
  ReturnRecord,
  TimelineEvent,
  QualityGrade,
  ProductVariant,
  PRICING_MATRIX,
  Lead,
  Campaign,
  SupportTicket,
  TaskItem,
  NotificationItem,
} from '../types/kfos';

class KFOSStore {
  private customers: Customer[] = [];
  private orders: Order[] = [];
  private stocks: LiquidStockPool[] = [
    { quality: 'Eco', currentStock5L: 0, lowStockThreshold: 30, lastRestockedAt: new Date().toISOString() },
    { quality: 'Standard', currentStock5L: 0, lowStockThreshold: 25, lastRestockedAt: new Date().toISOString() },
    { quality: 'Premium', currentStock5L: 0, lowStockThreshold: 20, lastRestockedAt: new Date().toISOString() },
  ];
  private samples: SampleDistribution[] = [];
  private payments: PaymentRecord[] = [];
  private expenses: ExpenseRecord[] = [];
  private leads: Lead[] = [];
  private campaigns: Campaign[] = [];
  private supportTickets: SupportTicket[] = [];
  private tasks: TaskItem[] = [];
  private notifications: NotificationItem[] = [];
  private telegramActivities: any[] = [];
  private returns: ReturnRecord[] = [];
  private timeline: TimelineEvent[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.syncWithFirestore();
  }

  private async ensureAuthToken(): Promise<string> {
    const token = localStorage.getItem('kfos_token') || localStorage.getItem('token') || '';
    return token;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async syncWithFirestore() {
    try {
      const headers = await this.getAuthHeaders();

      // Fetch customers from Firestore
      const custRes = await fetch('/api/firestore/customers', { headers }).then((r) => r.json()).catch(() => ({}));
      if (custRes.success && Array.isArray(custRes.data)) {
        this.customers = custRes.data;
      }

      // Fetch orders from Firestore
      const ordRes = await fetch('/api/firestore/orders', { headers }).then((r) => r.json()).catch(() => ({}));
      if (ordRes.success && Array.isArray(ordRes.data)) {
        this.orders = ordRes.data;
      }

      // Fetch inventory from Firestore
      const invRes = await fetch('/api/firestore/inventory', { headers }).then((r) => r.json()).catch(() => ({}));
      if (invRes.success && Array.isArray(invRes.data) && invRes.data.length > 0) {
        this.stocks = invRes.data;
      }

      // Fetch expenses from Firestore
      const expRes = await fetch('/api/firestore/expenses', { headers }).then((r) => r.json()).catch(() => ({}));
      if (expRes.success && Array.isArray(expRes.data)) {
        this.expenses = expRes.data;
      }

      // Fetch payments
      const payRes = await fetch('/api/firestore/collection/payments', { headers }).then((r) => r.json()).catch(() => ({}));
      if (payRes.success && Array.isArray(payRes.data)) {
        this.payments = payRes.data;
      }

      // Fetch leads
      const leadRes = await fetch('/api/firestore/collection/leads', { headers }).then((r) => r.json()).catch(() => ({}));
      if (leadRes.success && Array.isArray(leadRes.data)) {
        this.leads = leadRes.data;
      }

      // Fetch campaigns
      const campRes = await fetch('/api/firestore/collection/campaigns', { headers }).then((r) => r.json()).catch(() => ({}));
      if (campRes.success && Array.isArray(campRes.data)) {
        this.campaigns = campRes.data;
      }

      // Fetch support tickets
      const ticketRes = await fetch('/api/firestore/collection/supportTickets', { headers }).then((r) => r.json()).catch(() => ({}));
      if (ticketRes.success && Array.isArray(ticketRes.data)) {
        this.supportTickets = ticketRes.data;
      }

      // Fetch tasks
      const taskRes = await fetch('/api/firestore/collection/tasks', { headers }).then((r) => r.json()).catch(() => ({}));
      if (taskRes.success && Array.isArray(taskRes.data)) {
        this.tasks = taskRes.data;
      }

      // Fetch notifications
      const notifRes = await fetch('/api/firestore/collection/notifications', { headers }).then((r) => r.json()).catch(() => ({}));
      if (notifRes.success && Array.isArray(notifRes.data)) {
        this.notifications = notifRes.data;
      }

      // Fetch telegram pending actions / updates
      const tgRes = await fetch('/api/firestore/collection/telegramProcessedUpdates', { headers }).then((r) => r.json()).catch(() => ({}));
      if (tgRes.success && Array.isArray(tgRes.data)) {
        this.telegramActivities = tgRes.data;
      }

      // Fetch audit logs / timeline
      const auditRes = await fetch('/api/firestore/collection/auditLogs', { headers }).then((r) => r.json()).catch(() => ({}));
      if (auditRes.success && Array.isArray(auditRes.data)) {
        this.timeline = auditRes.data;
      }

      this.notify();
    } catch (err) {
      console.warn('[KFOSStore] Firestore sync error:', err);
    }
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
  public async logTimeline(
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
    this.notify();

    try {
      const headers = await this.getAuthHeaders();
      await fetch('/api/firestore/collection/auditLogs', {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
    } catch (e) {
      console.warn('[Firestore] Sync audit log error:', e);
    }
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

  public getExpenses(): ExpenseRecord[] {
    return this.expenses;
  }

  public getLeads(): Lead[] {
    return this.leads;
  }

  public getCampaigns(): Campaign[] {
    return this.campaigns;
  }

  public getSupportTickets(): SupportTicket[] {
    return this.supportTickets;
  }

  public getTasks(): TaskItem[] {
    return this.tasks;
  }

  public getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  public getTelegramActivities(): any[] {
    return this.telegramActivities;
  }

  public async addExpense(expense: Omit<ExpenseRecord, 'id'>): Promise<{ success: boolean; data?: ExpenseRecord; error?: string }> {
    const newDoc: ExpenseRecord = {
      ...expense,
      id: 'exp-' + Date.now(),
    };
    this.expenses.unshift(newDoc);
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDoc),
      }).then((r) => r.json());
      if (res.success) {
        return { success: true, data: newDoc };
      }
      return { success: false, error: res.error || 'Failed to create expense' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Expense creation error' };
    }
  }

  public async addLead(lead: Omit<Lead, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: Lead; error?: string }> {
    const newDoc: Lead = {
      ...lead,
      id: 'lead-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    this.leads.unshift(newDoc);
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDoc),
      }).then((r) => r.json());
      return { success: res.success, data: newDoc, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async updateLeadStatus(id: string, status: Lead['status']): Promise<boolean> {
    const item = this.leads.find((l) => l.id === id);
    if (!item) return false;
    item.status = status;
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      await fetch('/api/firestore/collection/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(item),
      });
      return true;
    } catch {
      return false;
    }
  }

  public async addCampaign(campaign: Omit<Campaign, 'id'>): Promise<{ success: boolean; data?: Campaign; error?: string }> {
    const newDoc: Campaign = {
      ...campaign,
      id: 'camp-' + Date.now(),
    };
    this.campaigns.unshift(newDoc);
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDoc),
      }).then((r) => r.json());
      return { success: res.success, data: newDoc, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async addSupportTicket(ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt'>): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
    const newDoc: SupportTicket = {
      ...ticket,
      id: 'tick-' + Date.now(),
      ticketNumber: 'TICK-' + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date().toISOString(),
    };
    this.supportTickets.unshift(newDoc);
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/supportTickets', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDoc),
      }).then((r) => r.json());
      return { success: res.success, data: newDoc, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async updateSupportTicketStatus(id: string, status: SupportTicket['status']): Promise<boolean> {
    const item = this.supportTickets.find((t) => t.id === id);
    if (!item) return false;
    item.status = status;
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      await fetch('/api/firestore/collection/supportTickets', {
        method: 'POST',
        headers,
        body: JSON.stringify(item),
      });
      return true;
    } catch {
      return false;
    }
  }

  public async addTask(task: Omit<TaskItem, 'id'>): Promise<{ success: boolean; data?: TaskItem; error?: string }> {
    const newDoc: TaskItem = {
      ...task,
      id: 'task-' + Date.now(),
    };
    this.tasks.unshift(newDoc);
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(newDoc),
      }).then((r) => r.json());
      return { success: res.success, data: newDoc, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async updateTaskStatus(id: string, status: TaskItem['status']): Promise<boolean> {
    const item = this.tasks.find((t) => t.id === id);
    if (!item) return false;
    item.status = status;
    this.notify();
    try {
      const headers = await this.getAuthHeaders();
      await fetch('/api/firestore/collection/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(item),
      });
      return true;
    } catch {
      return false;
    }
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
    this.notify();

    this.getAuthHeaders().then((headers) => {
      fetch('/api/firestore/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify(newCust),
      }).catch((e) => console.warn('[Firestore] Sync customer error:', e));
    });

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

    this.notify();

    this.getAuthHeaders().then((headers) => {
      fetch('/api/firestore/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.name,
          customerPlace: customer.place,
          items: [
            {
              productVariant,
              quality,
              quantity,
              discountPerUnit: discount,
            },
          ],
          paidAmount: actualPaid,
          source,
          notes,
        }),
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          this.syncWithFirestore();
        }
      })
      .catch((e) => console.warn('[Firestore] Sync order error:', e));
    });

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
    this.notify();
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
      this.notify();
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

    this.notify();

    this.getAuthHeaders().then((headers) => {
      fetch('/api/firestore/collection/returns', {
        method: 'POST',
        headers,
        body: JSON.stringify(returnRecord),
      }).catch((e) => console.warn('[Firestore] Sync return error:', e));
    });

    return {
      success: true,
      message: `Return processed. ${order.items.map((i) => i.quantity).reduce((a, b) => a + b, 0)} Cans returned to Liquid Pool. Reversed Profit: -₹${reversedProfit}`,
    };
  }

  // Business Logic: Record Payment
  public recordPayment(
    orderIdOrCustomer: string,
    customerIdOrAmount: string | number,
    amountOrMethod: number | PaymentRecord['paymentMethod'],
    methodOrNotes?: PaymentRecord['paymentMethod'] | string,
    notesParam?: string
  ) {
    let orderId = orderIdOrCustomer;
    let customerId = typeof customerIdOrAmount === 'string' ? customerIdOrAmount : '';
    let amount = typeof customerIdOrAmount === 'number' ? customerIdOrAmount : (typeof amountOrMethod === 'number' ? amountOrMethod : 0);
    let method: PaymentRecord['paymentMethod'] = (typeof amountOrMethod === 'string' ? amountOrMethod : (typeof methodOrNotes === 'string' ? methodOrNotes as PaymentRecord['paymentMethod'] : 'UPI'));
    let notes = typeof methodOrNotes === 'string' && methodOrNotes !== 'UPI' && methodOrNotes !== 'Cash' && methodOrNotes !== 'Bank Transfer' ? methodOrNotes : notesParam;

    let order = this.orders.find((o) => o.id === orderId);
    if (!order && customerId) {
      order = this.orders.find((o) => o.customerId === customerId && o.paymentStatus !== 'Paid');
    }

    if (order) {
      order.paidAmount += amount;
      if (order.paidAmount >= order.totalAmount) {
        order.paymentStatus = 'Paid';
      } else {
        order.paymentStatus = 'Partial';
      }
    }

    const custId = order ? order.customerId : (customerId || 'cust-1');
    const customer = this.getCustomerById(custId);
    if (customer) {
      customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount);
    }

    const payment: PaymentRecord = {
      id: 'pay-' + Date.now(),
      orderId: order ? order.id : 'direct-credit-receipt',
      customerId: custId,
      customerName: customer ? customer.name : 'Field Customer',
      amount,
      paymentMethod: method,
      receivedAt: new Date().toISOString(),
      notes,
    };

    this.payments.unshift(payment);

    this.logTimeline(
      'Payment Received',
      `Payment Received: ₹${amount.toLocaleString('en-IN')} (${method})`,
      `Received from ${customer ? customer.name : 'Customer'}. Balance remaining: ₹${customer ? customer.outstandingBalance.toLocaleString('en-IN') : 0}.`,
      custId,
      customer ? customer.name : 'Customer'
    );

    this.notify();

    this.getAuthHeaders().then((headers) => {
      fetch('/api/firestore/collection/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify(payment),
      }).catch((e) => console.warn('[Firestore] Sync payment error:', e));
    });

    return { success: true, message: `Payment of ₹${amount} recorded successfully.` };
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

    this.notify();

    this.getAuthHeaders().then((headers) => {
      fetch('/api/firestore/inventory', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quality,
          currentStock5L: addedCans,
          type: 'RESTOCK',
          reason: `Restocked ${addedCans} Cans`,
        }),
      }).catch((e) => console.warn('[Firestore] Sync inventory error:', e));
    });

    return { success: true, message: `Added ${addedCans} Cans to ${quality} Pool. New total: ${pool.currentStock5L} Cans.` };
  }

  // Soft Delete with Undo Recovery Support
  public softDeleteOrder(orderId: string): { success: boolean; undoAction: () => void } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, undoAction: () => {} };

    order.isArchived = true;
    this.notify();

    const undoAction = () => {
      order.isArchived = false;
      this.notify();
      this.logTimeline('Order Created', `Restored Order ${order.orderNumber}`, `Un-archived order for ${order.customerName}`, order.customerId, order.customerName);
    };

    this.logTimeline('Return Processed', `Archived Order ${order.orderNumber}`, `Soft deleted order for ${order.customerName}`, order.customerId, order.customerName);
    return { success: true, undoAction };
  }

  public softDeleteCustomer(customerId: string): { success: boolean; undoAction: () => void } {
    const customer = this.getCustomerById(customerId);
    if (!customer) return { success: false, undoAction: () => {} };

    customer.isArchived = true;
    this.notify();

    const undoAction = () => {
      customer.isArchived = false;
      this.notify();
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

    // Today's Date String in Asia/Kolkata timezone
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayOrders = activeOrders.filter((o) => {
      const dateStr = new Date(o.orderDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return dateStr === todayISO;
    });
    const todayProfit = todayOrders.reduce((sum, o) => sum + o.totalProfit, 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const totalOutstanding = this.getCustomers().reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalCustomers = this.getCustomers().length;

    const stockMap = {
      Eco: this.stocks.find((s) => s.quality === 'Eco')?.currentStock5L || 0,
      Standard: this.stocks.find((s) => s.quality === 'Standard')?.currentStock5L || 0,
      Premium: this.stocks.find((s) => s.quality === 'Premium')?.currentStock5L || 0,
    };

    const lowStockAlerts = this.stocks.filter((s) => s.currentStock5L <= s.lowStockThreshold);

    const pendingOrdersCount = activeOrders.filter((o) => o.paymentStatus !== 'Paid').length;
    const pendingFollowUps = this.samples.filter((s) => s.followUpStatus === 'Pending');
    const openLeadsCount = this.leads.filter((l) => l.status !== 'Converted' && l.status !== 'Lost').length;
    const openTicketsCount = this.supportTickets.filter((t) => t.status !== 'Closed' && t.status !== 'Resolved').length;
    const pendingTasksCount = this.tasks.filter((t) => t.status !== 'Completed').length;

    const totalExpenses = this.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netRealizedProfit = Math.max(0, totalProfit - totalExpenses);

    return {
      totalRevenue,
      totalProfit,
      todayProfit,
      todayRevenue,
      todayOrdersCount: todayOrders.length,
      totalOutstanding,
      totalCustomers,
      stockMap,
      lowStockAlerts,
      pendingOrdersCount,
      pendingFollowUpsCount: pendingFollowUps.length,
      openLeadsCount,
      openTicketsCount,
      pendingTasksCount,
      totalExpenses,
      netRealizedProfit,
    };
  }
}

export const kfosStore = new KFOSStore();
