import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate, firestoreDb } from '../firebase/firestore.js';
import { Order, PRICING_MATRIX, QualityGrade } from '../../src/types/kfos.js';

export interface OrderDoc extends Order {
  createdAt: string;
  updatedAt: string;
}

export const ordersRepository = {
  async getAll(): Promise<OrderDoc[]> {
    const snapshot = await getCollectionRef(COLLECTIONS.ORDERS).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDoc));
  },

  async getById(id: string): Promise<OrderDoc | null> {
    const doc = await getCollectionRef(COLLECTIONS.ORDERS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as OrderDoc;
  },

  async createOrderAtomic(data: {
    customerId: string;
    customerName?: string;
    customerPlace?: string;
    items: Array<{
      productVariant: 'Room Freshener' | 'Bathroom Freshener';
      quality: QualityGrade;
      quantity: number;
      discountPerUnit?: number;
    }>;
    paidAmount?: number;
    source?: Order['source'];
    notes?: string;
  }): Promise<OrderDoc> {
    return await firestoreDb.runTransaction(async (tx: any) => {
      // 1. Validate Customer
      const custRef = getCollectionRef(COLLECTIONS.CUSTOMERS).doc(data.customerId);
      const custSnap = await tx.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID ${data.customerId} not found`);
      }
      const customerData = custSnap.data();

      if (!data.items || data.items.length === 0) {
        throw new Error('Order must contain at least one product item');
      }

      const docId = `ord-${Date.now()}`;
      const orderNumber = `KF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let orderTotalAmount = 0;
      let orderTotalDiscount = 0;
      let orderTotalProfit = 0;
      const processedItems: any[] = [];

      // 2. Process items & enforce authoritative pricing & stock
      for (const itemInput of data.items) {
        const quality = itemInput.quality;
        const qty = itemInput.quantity;
        if (qty <= 0) {
          throw new Error('Quantity must be greater than 0');
        }

        const stockRef = getCollectionRef(COLLECTIONS.INVENTORY).doc(quality);
        const stockSnap = await tx.get(stockRef);
        const currentStock = stockSnap.exists ? (stockSnap.data()?.currentStock5L || 0) : 0;
        if (currentStock < qty) {
          throw new Error(`Insufficient stock for ${quality}. Available: ${currentStock}, Required: ${qty}`);
        }

        const pricing = PRICING_MATRIX[quality];
        if (!pricing) {
          throw new Error(`Invalid quality grade: ${quality}`);
        }

        const buyPrice = pricing.buyPrice;
        const salePrice = pricing.salePrice;
        const discount = Math.max(0, itemInput.discountPerUnit || 0);

        if (discount > (salePrice - buyPrice)) {
          throw new Error(`Discount ₹${discount} per unit exceeds maximum allowable margin for ${quality}`);
        }

        const realizedProfitPerUnit = salePrice - buyPrice - discount;
        const itemTotalAmount = (salePrice - discount) * qty;
        const itemTotalProfit = realizedProfitPerUnit * qty;

        orderTotalAmount += itemTotalAmount;
        orderTotalDiscount += discount * qty;
        orderTotalProfit += itemTotalProfit;

        const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const processedItem = {
          id: itemId,
          productVariant: itemInput.productVariant,
          quality,
          quantity: qty,
          buyPricePerUnit: buyPrice,
          salePricePerUnit: salePrice,
          discountPerUnit: discount,
          realizedProfitPerUnit,
          totalAmount: itemTotalAmount,
          totalProfit: itemTotalProfit,
          orderId: docId,
          customerId: data.customerId,
        };
        processedItems.push(processedItem);

        // Deduct inventory stock
        const newStock = currentStock - qty;
        tx.set(stockRef, prepareDataForUpdate({
          id: quality,
          quality,
          currentStock5L: newStock,
          updatedAt: new Date().toISOString(),
        }));

        // Log inventory transaction with delta quantity
        const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const txRef = getCollectionRef(COLLECTIONS.INVENTORY_TRANSACTIONS).doc(txId);
        tx.set(txRef, prepareDataForInsert({
          id: txId,
          qualityGrade: quality,
          type: 'DEDUCTION',
          deltaQuantity5L: -qty,
          newStockLevel5L: newStock,
          reason: `Order ${orderNumber}`,
          orderId: docId,
        }));
      }

      const paidAmount = Math.min(Math.max(0, data.paidAmount || 0), orderTotalAmount);
      const unpaidBalance = orderTotalAmount - paidAmount;

      let paymentStatus: Order['paymentStatus'] = 'Unpaid';
      if (paidAmount >= orderTotalAmount) paymentStatus = 'Paid';
      else if (paidAmount > 0) paymentStatus = 'Partial';

      const orderDoc: OrderDoc = prepareDataForInsert({
        id: docId,
        orderNumber,
        customerId: data.customerId,
        customerName: customerData.name || data.customerName || 'Field Customer',
        customerPlace: customerData.place || data.customerPlace || 'Tamil Nadu',
        items: processedItems,
        totalAmount: orderTotalAmount,
        totalDiscount: orderTotalDiscount,
        totalProfit: orderTotalProfit,
        paidAmount,
        paymentStatus,
        orderDate: new Date().toISOString(),
        isReturned: false,
        source: data.source || 'Dashboard Manual',
        notes: data.notes || '',
        isArchived: false,
      });

      const orderRef = getCollectionRef(COLLECTIONS.ORDERS).doc(docId);
      tx.set(orderRef, orderDoc);

      for (const item of processedItems) {
        const itemRef = getCollectionRef(COLLECTIONS.ORDER_ITEMS).doc(item.id);
        tx.set(itemRef, prepareDataForInsert(item));
      }

      // Update customer balance & stats
      const updatedCustomer = prepareDataForUpdate({
        totalOrdersCount: (customerData.totalOrdersCount || 0) + 1,
        totalSpent: (customerData.totalSpent || 0) + orderTotalAmount,
        outstandingBalance: (customerData.outstandingBalance || 0) + unpaidBalance,
      });
      tx.set(custRef, updatedCustomer);

      // Log audit event
      const auditId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const auditRef = getCollectionRef(COLLECTIONS.AUDIT_LOGS).doc(auditId);
      tx.set(auditRef, prepareDataForInsert({
        id: auditId,
        timestamp: new Date().toISOString(),
        type: 'Order Created',
        title: `Order ${orderNumber} - ₹${orderTotalAmount}`,
        description: `Order created atomically with ${processedItems.length} item(s). Profit: ₹${orderTotalProfit}`,
        customerId: data.customerId,
        customerName: customerData.name,
      }));

      return orderDoc;
    });
  },

  async create(data: Omit<OrderDoc, 'createdAt' | 'updatedAt'>): Promise<OrderDoc> {
    if (data.customerId && data.items && data.items.length > 0) {
      return await this.createOrderAtomic({
        customerId: data.customerId,
        customerName: data.customerName,
        customerPlace: data.customerPlace,
        items: data.items.map((i) => ({
          productVariant: i.productVariant,
          quality: i.quality,
          quantity: i.quantity,
          discountPerUnit: i.discountPerUnit,
        })),
        paidAmount: data.paidAmount,
        source: data.source,
        notes: data.notes,
      });
    }
    const docId = data.id || `ord-${Date.now()}`;
    const prepared = prepareDataForInsert({ ...data, id: docId });
    await getCollectionRef(COLLECTIONS.ORDERS).doc(docId).set(prepared);
    return prepared;
  },

  async update(id: string, updates: Partial<OrderDoc>): Promise<OrderDoc> {
    const docRef = getCollectionRef(COLLECTIONS.ORDERS).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error(`Order ${id} not found`);
    }
    const prepared = prepareDataForUpdate(updates);
    await docRef.update(prepared);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as OrderDoc;
  }
};
