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

const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

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

  private getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  }

  private async getAuthHeaders(method: string = 'GET'): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      const csrfToken = this.getCookie('XSRF-TOKEN');
      if (csrfToken) {
        headers['X-XSRF-TOKEN'] = csrfToken;
        headers['X-CSRF-TOKEN'] = csrfToken;
      }
    }
    return headers;
  }

  public async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    const method = init.method || 'GET';
    const headers = await this.getAuthHeaders(method);
    const finalHeaders = {
      ...headers,
      ...(init.headers as Record<string, string>),
    };
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: finalHeaders,
    });
    if (res.status === 401) {
      localStorage.removeItem('kfos_role');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kfos-unauthorized'));
      }
    }
    return res;
  }

  public async syncWithFirestore() {
    try {
      // Fetch customers from Firestore
      const custRes = await this.fetchWithAuth('/api/firestore/customers').then((r) => r.json()).catch(() => ({}));
      if (custRes.success && Array.isArray(custRes.data)) {
        this.customers = custRes.data;
      }

      // Fetch orders from Firestore
      const ordRes = await this.fetchWithAuth('/api/firestore/orders').then((r) => r.json()).catch(() => ({}));
      if (ordRes.success && Array.isArray(ordRes.data)) {
        this.orders = ordRes.data;
      }

      // Fetch inventory from Firestore
      const invRes = await this.fetchWithAuth('/api/firestore/inventory').then((r) => r.json()).catch(() => ({}));
      if (invRes.success && Array.isArray(invRes.data) && invRes.data.length > 0) {
        this.stocks = invRes.data;
      }

      // Fetch expenses from Firestore
      const expRes = await this.fetchWithAuth('/api/firestore/expenses').then((r) => r.json()).catch(() => ({}));
      if (expRes.success && Array.isArray(expRes.data)) {
        this.expenses = expRes.data;
      }

      // Fetch payments
      const payRes = await this.fetchWithAuth('/api/firestore/collection/payments').then((r) => r.json()).catch(() => ({}));
      if (payRes.success && Array.isArray(payRes.data)) {
        this.payments = payRes.data;
      }

      // Fetch leads
      const leadRes = await this.fetchWithAuth('/api/firestore/collection/leads').then((r) => r.json()).catch(() => ({}));
      if (leadRes.success && Array.isArray(leadRes.data)) {
        this.leads = leadRes.data;
      }

      // Fetch campaigns
      const campRes = await this.fetchWithAuth('/api/firestore/collection/campaigns').then((r) => r.json()).catch(() => ({}));
      if (campRes.success && Array.isArray(campRes.data)) {
        this.campaigns = campRes.data;
      }

      // Fetch support tickets
      const ticketRes = await this.fetchWithAuth('/api/firestore/collection/supportTickets').then((r) => r.json()).catch(() => ({}));
      if (ticketRes.success && Array.isArray(ticketRes.data)) {
        this.supportTickets = ticketRes.data;
      }

      // Fetch tasks
      const taskRes = await this.fetchWithAuth('/api/firestore/collection/tasks').then((r) => r.json()).catch(() => ({}));
      if (taskRes.success && Array.isArray(taskRes.data)) {
        this.tasks = taskRes.data;
      }

      // Fetch notifications
      const notifRes = await this.fetchWithAuth('/api/firestore/collection/notifications').then((r) => r.json()).catch(() => ({}));
      if (notifRes.success && Array.isArray(notifRes.data)) {
        this.notifications = notifRes.data;
      }

      // Fetch telegram pending actions / updates
      const tgRes = await this.fetchWithAuth('/api/firestore/collection/telegramProcessedUpdates').then((r) => r.json()).catch(() => ({}));
      if (tgRes.success && Array.isArray(tgRes.data)) {
        this.telegramActivities = tgRes.data;
      }

      // Fetch audit logs / timeline
      const auditRes = await this.fetchWithAuth('/api/firestore/collection/auditLogs').then((r) => r.json()).catch(() => ({}));
      if (auditRes.success && Array.isArray(auditRes.data)) {
        this.timeline = auditRes.data;
      }

      // Fetch returns / reversed orders
      const retRes = await this.fetchWithAuth('/api/firestore/collection/returns').then((r) => r.json()).catch(() => ({}));
      if (retRes.success && Array.isArray(retRes.data)) {
        this.returns = retRes.data;
      }

      // Fetch samples
      const sampRes = await this.fetchWithAuth('/api/firestore/collection/samples').then((r) => r.json()).catch(() => ({}));
      if (sampRes.success && Array.isArray(sampRes.data)) {
        this.samples = sampRes.data;
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

  // Helper Timeline logger (Server-authoritative sync is handled on backend, local memory timeline here)
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
    const remainingFree = Math.max(0, 2 - (customer.free200mlSamplesUsed || 0));
    return {
      allowed: remainingFree > 0,
      remainingFree,
    };
  }

  // Server-Authoritative Adders
  public async addExpense(expense: Omit<ExpenseRecord, 'id'>): Promise<{ success: boolean; data?: ExpenseRecord; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify(expense),
      }).then((r) => r.json());
      if (res.success && res.data) {
        this.expenses.unshift(res.data);
        this.notify();
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error || 'Failed to create expense' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Expense creation error' };
    }
  }

  public async addLead(lead: Omit<Lead, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: Lead; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(lead),
      }).then((r) => r.json());
      if (res.success && res.data) {
        this.leads.unshift(res.data);
        this.notify();
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error || 'Failed to create lead' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Lead creation error' };
    }
  }

  public async updateLeadStatus(id: string, status: Lead['status']): Promise<boolean> {
    const item = this.leads.find((l) => l.id === id);
    if (!item) return false;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`/api/firestore/collection/leads/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (res.success && res.data) {
        item.status = status;
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async addCampaign(campaign: Omit<Campaign, 'id'>): Promise<{ success: boolean; data?: Campaign; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify(campaign),
      }).then((r) => r.json());
      if (res.success && res.data) {
        this.campaigns.unshift(res.data);
        this.notify();
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error || 'Failed to create campaign' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Campaign creation error' };
    }
  }

  public async addSupportTicket(ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt'>): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/supportTickets', {
        method: 'POST',
        headers,
        body: JSON.stringify(ticket),
      }).then((r) => r.json());
      if (res.success && res.data) {
        this.supportTickets.unshift(res.data);
        this.notify();
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error || 'Failed to create support ticket' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Support ticket creation error' };
    }
  }

  public async updateSupportTicketStatus(id: string, status: SupportTicket['status']): Promise<boolean> {
    const item = this.supportTickets.find((t) => t.id === id);
    if (!item) return false;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`/api/firestore/collection/supportTickets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (res.success && res.data) {
        item.status = status;
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async addTask(task: Omit<TaskItem, 'id'>): Promise<{ success: boolean; data?: TaskItem; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(task),
      }).then((r) => r.json());
      if (res.success && res.data) {
        this.tasks.unshift(res.data);
        this.notify();
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error || 'Failed to create task' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Task creation error' };
    }
  }

  public async updateTaskStatus(id: string, status: TaskItem['status']): Promise<boolean> {
    const item = this.tasks.find((t) => t.id === id);
    if (!item) return false;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`/api/firestore/collection/tasks/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (res.success && res.data) {
        item.status = status;
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Business Logic: Find/Create Customer (Server-Authoritative)
  public async findOrCreateCustomer(name: string, place: string, phone = ''): Promise<Customer> {
    const cleanName = name.trim();
    const cleanPlace = place.trim();
    const existing = this.customers.find(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase() && c.place.toLowerCase() === cleanPlace.toLowerCase()
    );

    if (existing) return existing;

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: cleanName,
          place: cleanPlace || 'Tamil Nadu',
          phone: phone || '+91 90000 00000',
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        const newCust: Customer = res.data;
        this.customers.unshift(newCust);
        this.logTimeline('Order Created', `New Customer Added: ${cleanName}`, `Location: ${cleanPlace}`, newCust.id, cleanName);
        this.notify();
        return newCust;
      }
      throw new Error(res.error || 'Failed to create customer');
    } catch (err: any) {
      console.warn('[Store] findOrCreateCustomer error:', err);
      // Fallback in-memory ONLY if API completely fails (to maintain operation under severe degradation)
      const fallbackCust: Customer = {
        id: 'cust-' + generateUUID(),
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
      this.customers.unshift(fallbackCust);
      this.notify();
      return fallbackCust;
    }
  }

  // Business Logic: Process New Order (Server-Authoritative)
  public async createOrder(data: {
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
  }): Promise<{ success: boolean; order?: Order; error?: string }> {
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

    // Check shared pool stock pool local check
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

    try {
      // Create Customer Authoritatively
      const customer = await this.findOrCreateCustomer(customerName, customerPlace);

      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/orders', {
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
              discountPerUnit,
            },
          ],
          paidAmount,
          source,
          notes,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        const order: Order = res.data;
        this.orders.unshift(order);

        // Deduct from local stock pool authoritatively using server-returned quantity
        const returnedQty = order.items[0]?.quantity || quantity;
        stockPool.currentStock5L = Math.max(0, stockPool.currentStock5L - returnedQty);

        // Sync Customer Stats to local memory using server values
        customer.totalOrdersCount += 1;
        customer.totalSpent += order.totalAmount;
        customer.outstandingBalance += (order.totalAmount - order.paidAmount);

        // Handle samples distribution authoritatively on the server side if returned
        if (order.samples && order.samples.length > 0) {
          order.samples.forEach((samp) => {
            this.samples.unshift(samp);
            if (samp.chargeAmount > 0) {
              customer.outstandingBalance += samp.chargeAmount;
            }
          });
        }

        // Log Timeline
        this.logTimeline(
          'Order Created',
          `Order ${order.orderNumber} - ₹${order.totalAmount.toLocaleString('en-IN')}`,
          `${returnedQty} Cans of ${quality} ${productVariant} delivered to ${customer.name} (${customer.place}). Realized Profit: ₹${order.totalProfit.toLocaleString('en-IN')}. Paid: ₹${order.paidAmount}.`,
          customer.id,
          customer.name,
          { orderId: order.id, totalProfit: order.totalProfit, paymentStatus: order.paymentStatus }
        );

        this.notify();
        return { success: true, order };
      }

      return { success: false, error: res.error || 'Failed to create order on server' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Order creation error' };
    }
  }

  // Public Direct Sample Distribution Method (Server-Authoritative)
  public async distributeSample(customerId: string, sampleType: '200ml' | '500ml', count = 1): Promise<{ success: boolean; message?: string; error?: string }> {
    const customer = this.getCustomerById(customerId);
    if (!customer) return { success: false, error: 'Customer not found' };

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/samples', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.name,
          sampleType,
          quantity: count,
          isFree: this.canGetFreeSample(customer.id).allowed && sampleType === '200ml',
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        const sample: SampleDistribution = res.data;
        this.samples.unshift(sample);

        if (sample.chargeAmount > 0) {
          customer.outstandingBalance += sample.chargeAmount;
        }
        if (sample.isFree && sampleType === '200ml') {
          customer.free200mlSamplesUsed = (customer.free200mlSamplesUsed || 0) + count;
        }

        this.logTimeline(
          'Sample Distributed',
          `Sample ${sampleType} (${sample.isFree ? 'FREE' : '₹' + sample.chargeAmount}) Issued`,
          `Issued to ${customer.name}. Mandatory ₹0 profit applied. Follow-up scheduled.`,
          customer.id,
          customer.name
        );

        this.notify();
        return {
          success: true,
          message: `Successfully distributed ${count}x ${sampleType} sample(s) to ${customer.name}. Follow-up reminder active for 3 days.`,
        };
      }
      return { success: false, error: res.error || 'Failed to distribute sample' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Sample distribution error' };
    }
  }

  // Complete Follow-Up
  public async completeFollowUp(sampleId: string, notes?: string): Promise<boolean> {
    const s = this.samples.find((samp) => samp.id === sampleId);
    if (!s) return false;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`/api/firestore/collection/samples/${sampleId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ followUpStatus: 'Completed', followUpNotes: notes }),
      }).then((r) => r.json());
      if (res.success && res.data) {
        s.followUpStatus = 'Completed';
        if (notes) s.followUpNotes = notes;
        this.logTimeline('FollowUp Scheduled', `Follow-up Completed for ${s.customerName}`, notes || 'Customer responded to sample trial.', s.customerId, s.customerName);
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Business Logic: Return & Profit Reversal Rules (Server-Authoritative)
  public async processReturn(orderId: string, reason: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.isReturned) return { success: false, error: 'Order has already been returned' };

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/collection/returns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
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
          totalReversedProfit: order.totalProfit,
          totalRefundAmount: order.totalAmount,
          reason,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        const returnRecord: ReturnRecord = res.data;
        this.returns.unshift(returnRecord);

        // Deduct/Restore inventory and customer state authoritatively
        order.isReturned = true;
        order.returnedAt = returnRecord.returnedAt;
        order.returnReason = reason;

        order.items.forEach((item) => {
          const stockPool = this.stocks.find((s) => s.quality === item.quality);
          if (stockPool) {
            stockPool.currentStock5L += item.quantity;
          }
        });

        const customer = this.getCustomerById(order.customerId);
        if (customer) {
          customer.outstandingBalance = Math.max(0, customer.outstandingBalance - (order.totalAmount - order.paidAmount));
          customer.totalSpent = Math.max(0, customer.totalSpent - order.totalAmount);
        }

        this.logTimeline(
          'Return Processed',
          `RETURN: Order ${order.orderNumber} - Stock Restored`,
          `Returned ${order.items.map((i) => `${i.quantity}x ${i.quality} ${i.productVariant}`).join(', ')}. Restored liquid stock pool. Reversed Profit: -₹${order.totalProfit.toLocaleString('en-IN')}. Reason: ${reason}`,
          order.customerId,
          order.customerName,
          { orderId, reversedProfit: order.totalProfit, refundAmount: order.totalAmount }
        );

        this.notify();
        return {
          success: true,
          message: `Return processed. ${order.items.map((i) => i.quantity).reduce((a, b) => a + b, 0)} Cans returned to Liquid Pool. Reversed Profit: -₹${order.totalProfit}`,
        };
      }

      return { success: false, error: res.error || 'Failed to process return on server' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Return processing error' };
    }
  }

  // Business Logic: Record Payment (Server-Authoritative)
  public async recordPayment(
    orderIdOrCustomer: string,
    customerIdOrAmount: string | number,
    amountOrMethod: number | PaymentRecord['paymentMethod'],
    methodOrNotes?: PaymentRecord['paymentMethod'] | string,
    notesParam?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    let orderId = orderIdOrCustomer;
    let customerId = typeof customerIdOrAmount === 'string' ? customerIdOrAmount : '';
    let amount = typeof customerIdOrAmount === 'number' ? customerIdOrAmount : (typeof amountOrMethod === 'number' ? amountOrMethod : 0);
    let method: PaymentRecord['paymentMethod'] = (typeof amountOrMethod === 'string' ? amountOrMethod : (typeof methodOrNotes === 'string' ? methodOrNotes as PaymentRecord['paymentMethod'] : 'UPI'));
    let notes = typeof methodOrNotes === 'string' && methodOrNotes !== 'UPI' && methodOrNotes !== 'Cash' && methodOrNotes !== 'Bank Transfer' ? methodOrNotes : notesParam;

    let order = this.orders.find((o) => o.id === orderId);
    if (!order && customerId) {
      order = this.orders.find((o) => o.customerId === customerId && o.paymentStatus !== 'Paid');
    }

    const custId = order ? order.customerId : (customerId || 'cust-1');

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/firestore/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerId: custId,
          orderId: order ? order.id : undefined,
          amount,
          paymentMethod: method,
          notes,
          idempotencyKey: 'pay-' + generateUUID(),
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        // Payment recording succeeded authoritatively!
        // Sync local memory state
        const payment: PaymentRecord = res.data.payment || res.data;
        this.payments.unshift(payment);

        if (order) {
          order.paidAmount += amount;
          if (order.paidAmount >= order.totalAmount) {
            order.paymentStatus = 'Paid';
          } else {
            order.paymentStatus = 'Partial';
          }
        }

        const customer = this.getCustomerById(custId);
        if (customer) {
          customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount);
        }

        this.logTimeline(
          'Payment Received',
          `Payment Received: ₹${amount.toLocaleString('en-IN')} (${method})`,
          `Received from ${customer ? customer.name : 'Customer'}. Balance remaining: ₹${customer ? customer.outstandingBalance.toLocaleString('en-IN') : 0}.`,
          custId,
          customer ? customer.name : 'Customer'
        );

        this.notify();
        return { success: true, message: `Payment of ₹${amount} recorded successfully.` };
      }

      return { success: false, error: res.error || 'Failed to record payment on server' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Payment recording error' };
    }
  }

  // Restock Liquid Stock Pool (Server-Authoritative)
  public async restockLiquidPool(quality: QualityGrade, addedCans: number): Promise<{ success: boolean; message: string }> {
    const pool = this.stocks.find((s) => s.quality === quality);
    if (!pool) return { success: false, message: 'Invalid stock pool' };

    try {
      const res = await this.fetchWithAuth('/api/firestore/inventory', {
        method: 'POST',
        body: JSON.stringify({
          quality,
          currentStock5L: addedCans,
          type: 'RESTOCK',
          reason: `Restocked ${addedCans} Cans`,
        }),
      }).then((r) => r.json());

      if (res.success) {
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
        return { success: true, message: `Added ${addedCans} Cans to ${quality} Pool. New total: ${pool.currentStock5L} Cans.` };
      }
      return { success: false, message: res.error || 'Failed to sync inventory restock' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Restock connection error' };
    }
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
