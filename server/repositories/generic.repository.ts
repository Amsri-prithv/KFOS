import { getCollectionRef, CollectionName, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';
import { randomUUID } from 'node:crypto';

export const genericRepository = {
  async getAll<T = any>(collectionName: CollectionName): Promise<T[]> {
    const snapshot = await getCollectionRef(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  },

  async getById<T = any>(collectionName: CollectionName, id: string): Promise<T | null> {
    const doc = await getCollectionRef(collectionName).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  },

  async create<T extends Record<string, any>>(collectionName: CollectionName, data: T): Promise<T> {
    const docId = data.id || `doc-${randomUUID()}`;
    const prepared = prepareDataForInsert({
      ...data,
      id: docId,
    });
    await getCollectionRef(collectionName).doc(docId).set(prepared);
    return prepared as T;
  },

  async update<T extends Record<string, any>>(collectionName: CollectionName, id: string, updates: Partial<T>): Promise<T> {
    const docRef = getCollectionRef(collectionName).doc(id);
    const prepared = prepareDataForUpdate(updates);
    await docRef.update(prepared);
    const updated = await docRef.get();
    return ({ id: updated.id, ...updated.data() } as unknown) as T;
  },

  async delete(collectionName: CollectionName, id: string): Promise<void> {
    await getCollectionRef(collectionName).doc(id).delete();
  }
};
