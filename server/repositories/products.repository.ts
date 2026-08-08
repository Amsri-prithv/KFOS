import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';

export interface ProductDoc {
  id: string;
  name: string;
  category: string;
  qualityGrade: 'Eco' | 'Standard' | 'Premium';
  buyPrice: number;
  salePrice: number;
  baseProfit: number;
  createdAt: string;
  updatedAt: string;
}

export const productsRepository = {
  async getAll(): Promise<ProductDoc[]> {
    const snapshot = await getCollectionRef(COLLECTIONS.PRODUCTS).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDoc));
  },

  async create(data: Omit<ProductDoc, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ProductDoc> {
    if (!data.name || data.salePrice == null) {
      throw new Error('Product name and sale price are required');
    }
    const docId = data.id || `prod-${Date.now()}`;
    const prepared = prepareDataForInsert({
      id: docId,
      name: data.name,
      category: data.category || 'Fragrance',
      qualityGrade: data.qualityGrade || 'Standard',
      buyPrice: data.buyPrice || 0,
      salePrice: data.salePrice || 0,
      baseProfit: data.baseProfit || (data.salePrice - (data.buyPrice || 0)),
    });

    await getCollectionRef(COLLECTIONS.PRODUCTS).doc(docId).set(prepared);
    return prepared;
  },

  async update(id: string, updates: Partial<ProductDoc>): Promise<ProductDoc> {
    const docRef = getCollectionRef(COLLECTIONS.PRODUCTS).doc(id);
    const prepared = prepareDataForUpdate(updates);
    await docRef.update(prepared);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as ProductDoc;
  }
};
