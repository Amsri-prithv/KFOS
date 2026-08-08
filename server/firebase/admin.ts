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

const projectId = config.projectId || 'second-metric-wj4jh';
const databaseId = config.firestoreDatabaseId || '(default)';
const apiKey = config.apiKey || '';

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

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

class RestDocRef {
  constructor(private collectionName: string, private docId: string) {}

  async get() {
    const url = `${baseUrl}/${this.collectionName}/${this.docId}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        id: this.docId,
        exists: false,
        data: () => null,
      };
    }
    const json = await res.json();
    const dataObj = fromFirestoreFields(json.fields || {});
    return {
      id: extractDocId(json.name || this.docId),
      exists: true,
      data: () => dataObj,
    };
  }

  async set(data: Record<string, any>) {
    const url = `${baseUrl}/${this.collectionName}?documentId=${this.docId}&key=${apiKey}`;
    const fields = toFirestoreFields(data);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const patchUrl = `${baseUrl}/${this.collectionName}/${this.docId}?key=${apiKey}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Firestore set failed: ${patchRes.status} ${errText}`);
      }
    }
  }

  async update(updates: Record<string, any>) {
    const fieldPaths = Object.keys(updates);
    const updateMask = fieldPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
    const url = `${baseUrl}/${this.collectionName}/${this.docId}?${updateMask}&key=${apiKey}`;
    const fields = toFirestoreFields(updates);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore update failed: ${res.status} ${errText}`);
    }
  }

  async delete() {
    const url = `${baseUrl}/${this.collectionName}/${this.docId}?key=${apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`Firestore delete failed: ${res.status} ${errText}`);
    }
  }
}

class RestCollectionRef {
  constructor(private collectionName: string) {}

  doc(id: string) {
    return new RestDocRef(this.collectionName, id);
  }

  async get() {
    const url = `${baseUrl}/${this.collectionName}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { docs: [] };
    }
    const json = await res.json();
    const documents = json.documents || [];
    const docs = documents.map((docJson: any) => {
      const docId = extractDocId(docJson.name);
      const dataObj = fromFirestoreFields(docJson.fields || {});
      return {
        id: docId,
        exists: true,
        data: () => dataObj,
      };
    });
    return { docs };
  }
}

export const firestoreDb: any = {
  collection(name: string) {
    return new RestCollectionRef(name);
  },
};

export const firebaseApp: any = {};
export function getFirestoreDb(): any {
  return firestoreDb;
}
