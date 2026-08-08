import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';

export interface CustomerDoc {
  id: string;
  name: string;
  businessName?: string;
  place: string;
  phone: string;
  outstandingBalance: number;
  free200mlSamplesUsed: number;
  totalOrdersCount: number;
  totalSpent: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const customersRepository = {
  async getAll(): Promise<CustomerDoc[]> {
    const snapshot = await getCollectionRef(COLLECTIONS.CUSTOMERS).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDoc));
  },

  async getById(id: string): Promise<CustomerDoc | null> {
    const doc = await getCollectionRef(COLLECTIONS.CUSTOMERS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as CustomerDoc;
  },

  async create(data: Omit<CustomerDoc, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<CustomerDoc> {
    if (!data.name || !data.phone) {
      throw new Error('Customer name and phone are required');
    }
    const docId = data.id || `cust-${Date.now()}`;
    const prepared = prepareDataForInsert({
      id: docId,
      name: data.name,
      businessName: data.businessName || data.name,
      place: data.place || 'Tamil Nadu',
      phone: data.phone,
      outstandingBalance: data.outstandingBalance || 0,
      free200mlSamplesUsed: data.free200mlSamplesUsed || 0,
      totalOrdersCount: data.totalOrdersCount || 0,
      totalSpent: data.totalSpent || 0,
      isArchived: Boolean(data.isArchived),
    });

    await getCollectionRef(COLLECTIONS.CUSTOMERS).doc(docId).set(prepared);
    return prepared;
  },

  async update(id: string, updates: Partial<CustomerDoc>): Promise<CustomerDoc> {
    const docRef = getCollectionRef(COLLECTIONS.CUSTOMERS).doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error(`Customer with ID ${id} not found`);
    }
    const prepared = prepareDataForUpdate(updates);
    await docRef.update(prepared);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as CustomerDoc;
  },

  async delete(id: string): Promise<void> {
    await getCollectionRef(COLLECTIONS.CUSTOMERS).doc(id).delete();
  }
};
