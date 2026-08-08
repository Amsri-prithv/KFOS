import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';
import { ExpenseRecord } from '../../src/types/kfos.js';
import { randomUUID } from 'node:crypto';

export interface ExpenseDoc extends ExpenseRecord {
  createdAt: string;
  updatedAt: string;
}

export const expensesRepository = {
  async getAll(): Promise<ExpenseDoc[]> {
    const snapshot = await getCollectionRef(COLLECTIONS.EXPENSES).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseDoc));
  },

  async create(data: Omit<ExpenseDoc, 'createdAt' | 'updatedAt'>): Promise<ExpenseDoc> {
    if (!data.title || data.amount == null) {
      throw new Error('Expense title and amount are required');
    }
    const docId = data.id || `exp-${randomUUID()}`;
    const prepared = prepareDataForInsert({
      ...data,
      id: docId,
    });

    await getCollectionRef(COLLECTIONS.EXPENSES).doc(docId).set(prepared);
    return prepared;
  }
};
