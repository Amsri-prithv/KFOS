import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let config: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  // ignore
}

const projectId =
  config.projectId ||
  process.env.FIREBASE_PROJECT_ID ||
  'second-metric-wj4jh';

const databaseId =
  config.firestoreDatabaseId ||
  process.env.FIREBASE_DATABASE_ID ||
  'ai-studio-kfosfragranceope-d27b913e-36a5-4a6e-95db-e9faa7db2715';

const apiKey = config.apiKey || process.env.FIREBASE_API_KEY || '';

let adminApp: App;

function initAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      adminApp = initializeApp({
        credential: cert(sa),
        projectId,
      });
      return adminApp;
    } catch (e) {
      console.error('[Firebase Admin] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  adminApp = initializeApp({
    projectId,
  });
  return adminApp;
}

export const firebaseApp = initAdminApp();

// Official Firestore instance
const nativeFirestore = databaseId && databaseId !== '(default)'
  ? getFirestore(firebaseApp, databaseId)
  : getFirestore(firebaseApp);

// REST fallback helpers for local dev container environment where ADC is not configured
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId || '(default)'}/documents`;

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getGcpAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }
  try {
    const res = await fetch('http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        cachedAccessToken = data.access_token;
        tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
        return cachedAccessToken;
      }
    }
  } catch (e) {
    // metadata server unavailable in local non-GCP environment
  }
  return null;
}

async function getRestAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  return headers;
}

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreValue(v: any): any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return parseFloat(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue?.fields || {});
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  if (!fields) return {};
  const obj: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

function extractDocId(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

const useNativeDb = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

const inMemoryDb: Record<string, Record<string, any>> = {};

function getMemCollection(col: string) {
  if (!inMemoryDb[col]) inMemoryDb[col] = {};
  return inMemoryDb[col];
}

class HybridDocRef {
  constructor(public collectionName: string, public id: string) {}

  async get(): Promise<any> {
    if (useNativeDb) {
      try {
        const snap = await nativeFirestore.collection(this.collectionName).doc(this.id).get();
        if (snap.exists) {
          getMemCollection(this.collectionName)[this.id] = snap.data();
          return snap;
        }
      } catch (e: any) {
        if (!e?.message?.includes('PERMISSION_DENIED') && !e?.message?.includes('UNAUTHENTICATED') && e?.code !== 7) {
          throw e;
        }
      }
    }
    try {
      const url = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
      const headers = await getRestAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const dataObj = fromFirestoreFields(json.fields || {});
        getMemCollection(this.collectionName)[this.id] = dataObj;
        return {
          id: extractDocId(json.name || this.id),
          exists: true,
          data: () => dataObj,
        };
      }
    } catch (err) {
      // ignore
    }

    const memData = getMemCollection(this.collectionName)[this.id];
    if (memData !== undefined) {
      return {
        id: this.id,
        exists: true,
        data: () => memData,
      };
    }

    return { id: this.id, exists: false, data: () => null };
  }

  async set(data: Record<string, any>): Promise<any> {
    getMemCollection(this.collectionName)[this.id] = { ...data };
    if (useNativeDb) {
      try {
        return await nativeFirestore.collection(this.collectionName).doc(this.id).set(data);
      } catch (e: any) {
        if (!e?.message?.includes('PERMISSION_DENIED') && !e?.message?.includes('UNAUTHENTICATED') && e?.code !== 7) {
          throw e;
        }
      }
    }
    try {
      const patchUrl = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
      const fields = toFirestoreFields(data);
      const headers = await getRestAuthHeaders();
      await fetch(patchUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });
    } catch (err) {
      // ignore REST fallback error
    }
    return;
  }

  async update(updates: Record<string, any>): Promise<any> {
    const existing = getMemCollection(this.collectionName)[this.id] || {};
    getMemCollection(this.collectionName)[this.id] = { ...existing, ...updates };

    if (useNativeDb) {
      try {
        return await nativeFirestore.collection(this.collectionName).doc(this.id).update(updates);
      } catch (e: any) {
        if (!e?.message?.includes('PERMISSION_DENIED') && !e?.message?.includes('UNAUTHENTICATED') && e?.code !== 7) {
          throw e;
        }
      }
    }
    try {
      const fieldPaths = Object.keys(updates);
      const updateMask = fieldPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
      const url = `${baseUrl}/${this.collectionName}/${this.id}?${updateMask}&key=${apiKey}`;
      const fields = toFirestoreFields(updates);
      const headers = await getRestAuthHeaders();
      await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });
    } catch (err) {
      // ignore
    }
    return;
  }

  async delete(): Promise<any> {
    delete getMemCollection(this.collectionName)[this.id];
    if (useNativeDb) {
      try {
        return await nativeFirestore.collection(this.collectionName).doc(this.id).delete();
      } catch (e: any) {
        if (!e?.message?.includes('PERMISSION_DENIED') && !e?.message?.includes('UNAUTHENTICATED') && e?.code !== 7) {
          throw e;
        }
      }
    }
    try {
      const url = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
      const headers = await getRestAuthHeaders();
      await fetch(url, { method: 'DELETE', headers });
    } catch (err) {
      // ignore
    }
    return;
  }
}

class HybridCollectionRef {
  public firestore: any;

  constructor(public collectionName: string) {
    this.firestore = {
      batch: () => firestoreDb.batch(),
    };
  }

  doc(id: string) {
    return new HybridDocRef(this.collectionName, id);
  }

  async get(): Promise<any> {
    if (useNativeDb) {
      try {
        const snap = await nativeFirestore.collection(this.collectionName).get();
        if (snap.docs.length > 0) {
          snap.docs.forEach((d: any) => {
            getMemCollection(this.collectionName)[d.id] = d.data();
          });
          return snap;
        }
      } catch (e: any) {
        if (!e?.message?.includes('PERMISSION_DENIED') && !e?.message?.includes('UNAUTHENTICATED') && e?.code !== 7) {
          throw e;
        }
      }
    }
    try {
      const url = `${baseUrl}/${this.collectionName}?key=${apiKey}`;
      const headers = await getRestAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const documents = json.documents || [];
        documents.forEach((docJson: any) => {
          const docId = extractDocId(docJson.name);
          const dataObj = fromFirestoreFields(docJson.fields || {});
          getMemCollection(this.collectionName)[docId] = dataObj;
        });
      }
    } catch (err) {
      // ignore
    }

    const colObj = getMemCollection(this.collectionName);
    const docs = Object.entries(colObj).map(([id, data]) => ({
      id,
      exists: true,
      data: () => data,
    }));

    return { docs };
  }
}

class HybridBatch {
  private ops: Array<{ type: 'set' | 'update' | 'delete'; ref: HybridDocRef; data?: any }> = [];

  set(ref: HybridDocRef, data: any) {
    this.ops.push({ type: 'set', ref, data });
  }

  update(ref: HybridDocRef, data: any) {
    this.ops.push({ type: 'update', ref, data });
  }

  delete(ref: HybridDocRef) {
    this.ops.push({ type: 'delete', ref });
  }

  async commit() {
    for (const op of this.ops) {
      if (op.type === 'set') {
        await op.ref.set(op.data);
      } else if (op.type === 'update') {
        await op.ref.update(op.data);
      } else if (op.type === 'delete') {
        await op.ref.delete();
      }
    }
  }
}

export const firestoreDb: any = {
  collection(name: string) {
    return new HybridCollectionRef(name);
  },
  batch() {
    return new HybridBatch();
  },
  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    const transactionObject = {
      async get(ref: HybridDocRef) {
        return await ref.get();
      },
      set(ref: HybridDocRef, data: any) {
        return ref.set(data);
      },
      update(ref: HybridDocRef, data: any) {
        return ref.update(data);
      },
      delete(ref: HybridDocRef) {
        return ref.delete();
      },
    };
    return await updateFunction(transactionObject);
  },
};

export function getFirestoreDb(): Firestore {
  return firestoreDb;
}

export { FieldValue, Timestamp };
