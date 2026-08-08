import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';
import { Order } from '../../src/types/kfos.js';

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

  async create(data: Omit<OrderDoc, 'createdAt' | 'updatedAt'>): Promise<OrderDoc> {
    if (!data.customerId || !data.items || data.items.length === 0) {
      throw new Error('Order must have a customer and at least one item');
    }
    const docId = data.id || `ord-${Date.now()}`;
    const prepared = prepareDataForInsert({
      ...data,
      id: docId,
    });

    await getCollectionRef(COLLECTIONS.ORDERS).doc(docId).set(prepared);

    // Save individual items into orderItems collection
    const batch = getCollectionRef(COLLECTIONS.ORDER_ITEMS).firestore.batch();
    for (const item of data.items) {
      const itemId = item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const itemRef = getCollectionRef(COLLECTIONS.ORDER_ITEMS).doc(itemId);
      batch.set(itemRef, prepareDataForInsert({
        ...item,
        id: itemId,
        orderId: docId,
        customerId: data.customerId,
      }));
    }
    await batch.commit();

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
