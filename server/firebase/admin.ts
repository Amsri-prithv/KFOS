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

const isProduction = process.env.NODE_ENV === 'production';

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
    } catch (e: any) {
      console.error('[Firebase Admin] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e);
      if (isProduction) {
        throw new Error(`CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY in production: ${e.message}`);
      }
    }
  }

  if (isProduction) {
    try {
      adminApp = initializeApp({
        projectId,
      });
      return adminApp;
    } catch (e: any) {
      console.error('[Firebase Admin] Failed to initialize default credentials in production:', e);
      throw new Error(`CRITICAL: Firebase Admin initialization failed: ${e.message}`);
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

// Use native database if in production or if a Service Account Key is explicitly set
const useNativeDb = isProduction || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// ============================================================================
// PRODUCTION Architecture: Pure, unmodified Firebase Admin SDK
// ============================================================================
//
// When useNativeDb is true (always in production), firestoreDb is strictly 
// nativeFirestore. No mock adapters, no in-memory fallbacks, no REST wrappers.
//
// ============================================================================
// TEST/DEVELOPMENT Architecture: Local Mock Adapter & REST Fallback
// ============================================================================

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId || '(default)'}/documents`;
let commitMutex = Promise.resolve();

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

function createMockFirestoreDb() {
  const inMemoryDb: Record<string, Record<string, { data: any, version: number }>> = {};

  function getMemCollection(col: string) {
    if (!inMemoryDb[col]) inMemoryDb[col] = {};
    return inMemoryDb[col];
  }

  class HybridDocRef {
    constructor(public collectionName: string, public id: string) {}

    async get(): Promise<any> {
      try {
        const url = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
        const headers = await getRestAuthHeaders();
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          const dataObj = fromFirestoreFields(json.fields || {});
          const existing = getMemCollection(this.collectionName)[this.id];
          getMemCollection(this.collectionName)[this.id] = { data: dataObj, version: existing?.version || 0 };
          return {
            id: extractDocId(json.name || this.id),
            exists: true,
            data: () => dataObj,
          };
        }
      } catch (err) {
        // ignore in mock mode
      }

      const memEntry = getMemCollection(this.collectionName)[this.id];
      if (memEntry !== undefined) {
        return {
          id: this.id,
          exists: true,
          data: () => memEntry.data,
        };
      }

      return { id: this.id, exists: false, data: () => null };
    }

    async set(data: Record<string, any>): Promise<any> {
      const existing = getMemCollection(this.collectionName)[this.id];
      getMemCollection(this.collectionName)[this.id] = { data: { ...data }, version: (existing?.version || 0) + 1 };
      
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || !apiKey;
      try {
        const patchUrl = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
        const fields = toFirestoreFields(data);
        const headers = await getRestAuthHeaders();
        const res = await fetch(patchUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) {
          if (isTestEnv) {
            console.warn(`[Firestore Hybrid REST Warning] REST fallback returned ${res.status} in test environment. Ignoring error.`);
          } else {
            throw new Error(`REST fallback failed with status ${res.status}`);
          }
        }
      } catch (err: any) {
        if (isTestEnv) {
          console.warn(`[Firestore Hybrid REST Warning] REST fallback fetch error: ${err.message || err}. Ignoring error.`);
        } else {
          console.error(`[Firestore Hybrid REST] set error for ${this.collectionName}/${this.id}:`, err);
          throw err;
        }
      }
    }

    async update(updates: Record<string, any>): Promise<any> {
      const existing = getMemCollection(this.collectionName)[this.id] || { data: {}, version: 0 };
      getMemCollection(this.collectionName)[this.id] = { data: { ...existing.data, ...updates }, version: existing.version + 1 };

      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || !apiKey;
      try {
        const fieldPaths = Object.keys(updates);
        const updateMask = fieldPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
        const url = `${baseUrl}/${this.collectionName}/${this.id}?${updateMask}&key=${apiKey}`;
        const fields = toFirestoreFields(updates);
        const headers = await getRestAuthHeaders();
        const res = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) {
          if (isTestEnv) {
            console.warn(`[Firestore Hybrid REST Warning] REST fallback returned ${res.status} in test environment. Ignoring error.`);
          } else {
            throw new Error(`REST fallback failed with status ${res.status}`);
          }
        }
      } catch (err: any) {
        if (isTestEnv) {
          console.warn(`[Firestore Hybrid REST Warning] REST fallback fetch error: ${err.message || err}. Ignoring error.`);
        } else {
          console.error(`[Firestore Hybrid REST] update error for ${this.collectionName}/${this.id}:`, err);
          throw err;
        }
      }
    }

    async delete(): Promise<any> {
      const existing = getMemCollection(this.collectionName)[this.id];
      if (existing) {
        getMemCollection(this.collectionName)[this.id] = { data: null, version: existing.version + 1 };
      }
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || !apiKey;
      try {
        const url = `${baseUrl}/${this.collectionName}/${this.id}?key=${apiKey}`;
        const headers = await getRestAuthHeaders();
        const res = await fetch(url, { method: 'DELETE', headers });
        if (!res.ok && res.status !== 404) {
          if (isTestEnv) {
            console.warn(`[Firestore Hybrid REST Warning] REST fallback returned ${res.status} in test environment. Ignoring error.`);
          } else {
            throw new Error(`REST fallback failed with status ${res.status}`);
          }
        }
      } catch (err: any) {
        if (isTestEnv) {
          console.warn(`[Firestore Hybrid REST Warning] REST fallback fetch error: ${err.message || err}. Ignoring error.`);
        } else {
          console.error(`[Firestore Hybrid REST] delete error for ${this.collectionName}/${this.id}:`, err);
          throw err;
        }
      }
    }
  }

  class HybridCollectionRef {
    public firestore: any;

    constructor(public collectionName: string) {
      this.firestore = {
        batch: () => db.batch(),
      };
    }

    doc(id: string) {
      return new HybridDocRef(this.collectionName, id);
    }

    async get(): Promise<any> {
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
            const existing = getMemCollection(this.collectionName)[docId];
            getMemCollection(this.collectionName)[docId] = { data: dataObj, version: (existing?.version || 0) + 1 };
          });
        }
      } catch (err) {
        // ignore in mock mode
      }

      const colObj = getMemCollection(this.collectionName);
      const docs = Object.entries(colObj).map(([id, entry]) => ({
        id,
        exists: true,
        data: () => entry.data,
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

  const db = {
    commitMutex: Promise.resolve(),
    reset() {
      for (const key in inMemoryDb) {
        delete inMemoryDb[key];
      }
      this.commitMutex = Promise.resolve();
    },
    collection(name: string) {
      return new HybridCollectionRef(name);
    },
    batch() {
      return new HybridBatch();
    },
    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      let attempts = 0;
      while (attempts < 50) {
        const snapshot = JSON.parse(JSON.stringify(inMemoryDb));
        const txWrites: Array<{ type: 'set' | 'update' | 'delete'; ref: HybridDocRef; data?: any }> = [];
        const txReads: Map<string, { exists: boolean, version: number, data: any }> = new Map();

        const transactionObject = {
          async get(ref: HybridDocRef) {
            const key = `${ref.collectionName}/${ref.id}`;
            const pendingWrite = [...txWrites].reverse().find(w => w.ref.collectionName === ref.collectionName && w.ref.id === ref.id);
            if (pendingWrite) {
              if (pendingWrite.type === 'delete') return { exists: false, data: () => null };
              return { exists: true, data: () => pendingWrite.data };
            }
            
            if (!txReads.has(key)) {
              const entry = snapshot[ref.collectionName]?.[ref.id];
              txReads.set(key, { exists: !!entry, version: entry?.version || 0, data: entry?.data || null });
            }
            
            const readEntry = txReads.get(key)!;
            return { exists: readEntry.exists, data: () => readEntry.data };
          },
          set(ref: HybridDocRef, data: any) {
            txWrites.push({ type: 'set', ref, data });
          },
          update(ref: HybridDocRef, data: any) {
            const existing = [...txWrites].reverse().find(w => w.ref.collectionName === ref.collectionName && w.ref.id === ref.id);
            if (existing && existing.type !== 'delete') {
              existing.data = { ...existing.data, ...data };
            } else {
              const entry = snapshot[ref.collectionName]?.[ref.id] || { data: {}, version: 0 };
              txWrites.push({ type: 'update', ref, data: { ...entry.data, ...data } });
            }
          },
          delete(ref: HybridDocRef) {
            txWrites.push({ type: 'delete', ref });
          },
        };

        try {
          const result = await updateFunction(transactionObject);

          let commitResult: any;
          let commitError: any = null;
          
          this.commitMutex = this.commitMutex.then(async () => {
            try {
              // Atomic commit with conflict check: check all reads
              for (const [key, readSnap] of txReads.entries()) {
                const [col, id] = key.split('/');
                const currentEntry = inMemoryDb[col]?.[id];
                const currentVersion = currentEntry?.version || 0;
                
                if (currentVersion !== readSnap.version) {
                  throw new Error('Conflict');
                }
              }

              // Apply writes
              for (const write of txWrites) {
                const col = write.ref.collectionName;
                const id = write.ref.id;
                if (!inMemoryDb[col]) inMemoryDb[col] = {};
                
                const existing = inMemoryDb[col][id] || { data: {}, version: 0 };
                
                if (write.type === 'delete') {
                  inMemoryDb[col][id] = { data: null, version: existing.version + 1 };
                } else {
                  inMemoryDb[col][id] = { data: write.data, version: existing.version + 1 };
                }
              }
              commitResult = result;
            } catch (err) {
              commitError = err;
            }
          });
          
          await this.commitMutex;
          
          if (commitError) {
            throw commitError;
          }

          return commitResult;
        } catch (err: any) {
          if (err.message === 'Conflict') {
            attempts++;
            continue;
          }
          throw err;
        }
      }
      throw new Error('Transaction failed after max retries');
    }
  };


  return db;
}


// Strictly export the database instance.
export const firestoreDb: any = useNativeDb
  ? nativeFirestore
  : createMockFirestoreDb();

export function getFirestoreDb(): Firestore {
  if (isProduction || useNativeDb) {
    return nativeFirestore;
  }
  return firestoreDb;
}

export { FieldValue, Timestamp };
