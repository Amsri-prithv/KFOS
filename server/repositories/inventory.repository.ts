import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate } from '../firebase/firestore.js';
import { LiquidStockPool, QualityGrade } from '../../src/types/kfos.js';

export interface InventoryDoc extends LiquidStockPool {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransactionDoc {
  id: string;
  qualityGrade: QualityGrade;
  type: 'DEDUCTION' | 'RESTOCK' | 'RETURN_RESTOCK';
  quantity5L: number;
  reason: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

export const inventoryRepository = {
  async getAll(): Promise<InventoryDoc[]> {
    const snapshot = await getCollectionRef(COLLECTIONS.INVENTORY).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryDoc));
  },

  async updateStock(
    quality: QualityGrade,
    newStock: number,
    transactionType?: 'DEDUCTION' | 'RESTOCK' | 'RETURN_RESTOCK',
    reason?: string,
    orderId?: string
  ): Promise<InventoryDoc> {
    const docRef = getCollectionRef(COLLECTIONS.INVENTORY).doc(quality);
    const docSnap = await docRef.get();

    let docData: any;
    if (docSnap.exists) {
      docData = prepareDataForUpdate({
        currentStock5L: newStock,
        lastRestockedAt: transactionType === 'RESTOCK' ? new Date().toISOString() : (docSnap.data()?.lastRestockedAt || new Date().toISOString()),
      });
      await docRef.update(docData);
    } else {
      docData = prepareDataForInsert({
        id: quality,
        quality,
        currentStock5L: newStock,
        lowStockThreshold: 20,
        lastRestockedAt: new Date().toISOString(),
      });
      await docRef.set(docData);
    }

    if (transactionType) {
      const txId = `tx-${Date.now()}`;
      const txRef = getCollectionRef(COLLECTIONS.INVENTORY_TRANSACTIONS).doc(txId);
      await txRef.set(prepareDataForInsert({
        id: txId,
        qualityGrade: quality,
        type: transactionType,
        quantity5L: newStock,
        reason: reason || `${transactionType} operation`,
        orderId: orderId || '',
      }));
    }

    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as InventoryDoc;
  }
};
