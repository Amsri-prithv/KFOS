import { getCollectionRef, COLLECTIONS, prepareDataForInsert, prepareDataForUpdate, firestoreDb } from '../firebase/firestore.js';
import { randomUUID } from 'node:crypto';

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

  async create(data: {
    id?: string;
    name: string;
    businessName?: string;
    place: string;
    phone: string;
    outstandingBalance?: number;
    free200mlSamplesUsed?: number;
    totalOrdersCount?: number;
    totalSpent?: number;
    isArchived?: boolean;
  }): Promise<CustomerDoc> {
    if (!data.name || !data.name.trim()) {
      throw new Error('Customer name is required');
    }
    if (!data.place || !data.place.trim()) {
      throw new Error('Customer place is required');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('Customer phone number is required');
    }
    const docId = data.id || `cust-${randomUUID()}`;
    const prepared = prepareDataForInsert({
      id: docId,
      name: data.name.trim(),
      businessName: data.businessName?.trim() || data.name.trim(),
      place: data.place.trim(),
      phone: data.phone.trim(),
      outstandingBalance: 0,
      free200mlSamplesUsed: 0,
      totalOrdersCount: 0,
      totalSpent: 0,
      isArchived: false,
    });

    await getCollectionRef(COLLECTIONS.CUSTOMERS).doc(docId).set(prepared);
    return prepared;
  },

  async recordPaymentAtomic(params: {
    customerId: string;
    amount: number;
    idempotencyKey?: string;
    recordedBy?: string;
    notes?: string;
  }): Promise<{ payment: any; customer: CustomerDoc }> {
    return await firestoreDb.runTransaction(async (tx) => {
      // B. Validate payment amount strictly
      if (typeof params.amount !== 'number' || Number.isNaN(params.amount) || !Number.isFinite(params.amount) || params.amount <= 0 || params.amount > 1e9) {
        throw new Error('Payment amount must be a positive finite number less than 1,000,000,000');
      }

      // C. Validate idempotencyKey
      if (params.idempotencyKey !== undefined) {
        if (typeof params.idempotencyKey !== 'string' || params.idempotencyKey.length < 1 || params.idempotencyKey.length > 100 || !/^[a-zA-Z0-9_\-]+$/.test(params.idempotencyKey)) {
          throw new Error('Invalid idempotency key format. Must be an alphanumeric string up to 100 characters.');
        }
      }

      // Check Idempotency if key provided
      const paymentDocId = params.idempotencyKey
        ? `pay_${params.idempotencyKey}`
        : `pay_${randomUUID()}`;
      const paymentRef = getCollectionRef(COLLECTIONS.PAYMENTS).doc(paymentDocId);
      const existingPaySnap = await tx.get(paymentRef);

      if (existingPaySnap.exists) {
        console.log(`[Payment] Idempotency match found for key: ${params.idempotencyKey}`);
        const existingPayment = existingPaySnap.data();
        const custRef = getCollectionRef(COLLECTIONS.CUSTOMERS).doc(params.customerId);
        const custSnap = await tx.get(custRef);
        return {
          payment: { id: existingPaySnap.id, ...existingPayment },
          customer: { id: custSnap.id, ...custSnap.data() } as CustomerDoc,
        };
      }

      // Read Customer
      const custRef = getCollectionRef(COLLECTIONS.CUSTOMERS).doc(params.customerId);
      const custSnap = await tx.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID ${params.customerId} not found`);
      }
      const customer = custSnap.data() as CustomerDoc;

      // A. A payment must NEVER make outstandingBalance negative
      if (params.amount > customer.outstandingBalance) {
        throw new Error('Payment amount cannot exceed customer outstanding balance');
      }

      // Compute exact mathematical balance (no silent clamping)
      const newBalance = customer.outstandingBalance - params.amount;

      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const nowIso = new Date().toISOString();

      const paymentData = {
        id: paymentDocId,
        customerId: customer.id,
        customerName: customer.name,
        amount: params.amount,
        paymentDate: dateStr,
        paymentMethod: 'Cash / UPI',
        notes: params.notes || 'Recorded via KFOS',
        recordedBy: params.recordedBy || 'System',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const auditData = {
        id: `audit_${randomUUID()}`,
        timestamp: nowIso,
        type: 'Payment Recorded',
        title: `Payment Recorded - ₹${params.amount}`,
        description: `Payment of ₹${params.amount} recorded for ${customer.name}. New Balance: ₹${newBalance}`,
        customerId: customer.id,
        customerName: customer.name,
        amount: params.amount,
        recordedBy: params.recordedBy || 'System',
      };

      const auditRef = getCollectionRef(COLLECTIONS.AUDIT_LOGS).doc(auditData.id);

      // Execute all updates together in transaction
      tx.set(paymentRef, paymentData);
      tx.update(custRef, prepareDataForUpdate({ outstandingBalance: newBalance }));
      tx.set(auditRef, auditData);

      const updatedCustomer = {
        ...customer,
        outstandingBalance: newBalance,
        updatedAt: nowIso,
      };

      return { payment: paymentData, customer: updatedCustomer };
    });
  },

  async recordSampleAtomic(params: {
    customerId: string;
    sampleType?: string;
    quantity?: number;
    recordedBy?: string;
  }): Promise<{ sampleRecord: any; customer: CustomerDoc }> {
    return await firestoreDb.runTransaction(async (tx) => {
      const custRef = getCollectionRef(COLLECTIONS.CUSTOMERS).doc(params.customerId);
      const custSnap = await tx.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID ${params.customerId} not found`);
      }
      const customer = custSnap.data() as CustomerDoc;

      const currentUsed = customer.free200mlSamplesUsed || 0;
      const MAX_FREE_SAMPLES = 3;

      if (currentUsed >= MAX_FREE_SAMPLES) {
        throw new Error(`Customer '${customer.name}' has already reached the maximum limit of ${MAX_FREE_SAMPLES} free samples.`);
      }

      const newUsed = currentUsed + 1;
      const sampleId = `sample_${randomUUID()}`;
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const nowIso = new Date().toISOString();

      const sampleData = {
        id: sampleId,
        customerId: customer.id,
        customerName: customer.name,
        sampleType: params.sampleType || '200ml Free Sample',
        quantity: params.quantity || 1,
        dispatchDate: dateStr,
        recordedBy: params.recordedBy || 'System',
        createdAt: nowIso,
      };

      const auditData = {
        id: `audit_${randomUUID()}`,
        timestamp: nowIso,
        type: 'Sample Dispatched',
        title: `Free Sample Dispatched - ${customer.name}`,
        description: `Dispatched ${sampleData.sampleType} to ${customer.name}. Lifetime used: ${newUsed}/${MAX_FREE_SAMPLES}`,
        customerId: customer.id,
        customerName: customer.name,
        recordedBy: params.recordedBy || 'System',
      };

      const sampleRef = getCollectionRef(COLLECTIONS.SAMPLES).doc(sampleId);
      const auditRef = getCollectionRef(COLLECTIONS.AUDIT_LOGS).doc(auditData.id);

      tx.set(sampleRef, sampleData);
      tx.update(custRef, prepareDataForUpdate({ free200mlSamplesUsed: newUsed }));
      tx.set(auditRef, auditData);

      const updatedCustomer = {
        ...customer,
        free200mlSamplesUsed: newUsed,
        updatedAt: nowIso,
      };

      return { sampleRecord: sampleData, customer: updatedCustomer };
    });
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

