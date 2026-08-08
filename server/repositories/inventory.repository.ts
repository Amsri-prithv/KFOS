import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate, firestoreDb } from '../firebase/firestore.js';
import { LiquidStockPool, QualityGrade } from '../../src/types/kfos.js';
import { randomUUID } from 'node:crypto';

export interface InventoryDoc extends LiquidStockPool {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransactionDoc {
  id: string;
  qualityGrade: QualityGrade;
  type: 'DEDUCTION' | 'RESTOCK' | 'RETURN_RESTOCK';
  deltaQuantity5L: number;
  newStockLevel5L: number;
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

  async updateStockAtomic(
    quality: QualityGrade,
    delta: number,
    transactionType: 'DEDUCTION' | 'RESTOCK' | 'RETURN_RESTOCK',
    reason?: string,
    orderId?: string
  ): Promise<{ inventory: InventoryDoc; transaction: InventoryTransactionDoc }> {
    return await firestoreDb.runTransaction(async (tx: any) => {
      const stockRef = getCollectionRef(COLLECTIONS.INVENTORY).doc(quality);
      const stockSnap = await tx.get(stockRef);

      let currentStock = 0;
      let lowStockThreshold = 20;

      if (stockSnap.exists) {
        const data = stockSnap.data();
        currentStock = data.currentStock5L || 0;
        lowStockThreshold = data.lowStockThreshold || 20;
      }

      const newStock = currentStock + delta;
      if (newStock < 0) {
        throw new Error(`Insufficient stock for ${quality}. Current stock: ${currentStock}, Requested delta: ${delta}`);
      }

      const now = new Date().toISOString();
      const updatedStockDoc = prepareDataForInsert({
        id: quality,
        quality,
        currentStock5L: newStock,
        lowStockThreshold,
        lastRestockedAt: transactionType === 'RESTOCK' ? now : (stockSnap.exists ? stockSnap.data()?.lastRestockedAt || now : now),
      });

      tx.set(stockRef, updatedStockDoc);

      const txId = `tx-${randomUUID()}`;
      const txRef = getCollectionRef(COLLECTIONS.INVENTORY_TRANSACTIONS).doc(txId);
      const txDoc = prepareDataForInsert({
        id: txId,
        qualityGrade: quality,
        type: transactionType,
        deltaQuantity5L: delta,
        newStockLevel5L: newStock,
        reason: reason || `${transactionType} operation`,
        orderId: orderId || '',
      });

      tx.set(txRef, txDoc);

      return { inventory: updatedStockDoc as InventoryDoc, transaction: txDoc as InventoryTransactionDoc };
    });
  },

  async updateStock(
    quality: QualityGrade,
    stockValueOrDelta: number,
    transactionType?: 'DEDUCTION' | 'RESTOCK' | 'RETURN_RESTOCK',
    reason?: string,
    orderId?: string,
    isDelta = false
  ): Promise<InventoryDoc> {
    if (isDelta || transactionType === 'DEDUCTION' || transactionType === 'RESTOCK' || transactionType === 'RETURN_RESTOCK') {
      let delta = stockValueOrDelta;
      if (transactionType === 'DEDUCTION' && delta > 0) {
        delta = -delta;
      }
      const res = await this.updateStockAtomic(quality, delta, transactionType || 'RESTOCK', reason, orderId);
      return res.inventory;
    }

    const docRef = getCollectionRef(COLLECTIONS.INVENTORY).doc(quality);
    const docSnap = await docRef.get();

    let docData: any;
    if (docSnap.exists) {
      docData = prepareDataForUpdate({
        currentStock5L: stockValueOrDelta,
        lastRestockedAt: transactionType === 'RESTOCK' ? new Date().toISOString() : (docSnap.data()?.lastRestockedAt || new Date().toISOString()),
      });
      await docRef.update(docData);
    } else {
      docData = prepareDataForInsert({
        id: quality,
        quality,
        currentStock5L: stockValueOrDelta,
        lowStockThreshold: 20,
        lastRestockedAt: new Date().toISOString(),
      });
      await docRef.set(docData);
    }

    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as InventoryDoc;
  }
};
