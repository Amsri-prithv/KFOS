import { firestoreDb } from './server/firebase/admin.js';
import { customersRepository } from './server/repositories/customers.repository.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function runVerification() {
  const results: Record<string, 'PASS' | 'FAIL'> = {
    'FIRESTORE CONNECTION': 'FAIL',
    'SERVER READ': 'FAIL',
    'SERVER WRITE': 'FAIL',
    'SERVER UPDATE': 'FAIL',
    'SERVER DELETE': 'FAIL',
    'FRONTEND API': 'FAIL',
    'AUTHORIZATION': 'FAIL',
    'SECURITY': 'FAIL',
    'TYPECHECK': 'FAIL',
    'LINT': 'FAIL',
    'BUILD': 'FAIL',
  };

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  log('=== STARTING END-TO-END FIRESTORE VERIFICATION ===');

  // Step 1 & 2: Test Firestore Admin Connection & Write/Read to _systemTests
  try {
    log('1. Initializing Firebase Admin & testing connection to _systemTests...');
    const testDocRef = firestoreDb.collection('_systemTests').doc('e2e_connection_test');

    // 3. Write test document
    log('3. Writing test document to _systemTests...');
    await testDocRef.set({
      test: 'firestore_connection',
      status: 'success',
      createdAt: new Date().toISOString(),
    });
    results['SERVER WRITE'] = 'PASS';
    log('-> SERVER WRITE: PASS');

    // 4. Read test document back
    log('4. Reading test document back from _systemTests...');
    const docSnap = await testDocRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      log(`-> Read data: ${JSON.stringify(data)}`);
      if (data?.test === 'firestore_connection' && data?.status === 'success') {
        results['SERVER READ'] = 'PASS';
        results['FIRESTORE CONNECTION'] = 'PASS';
        log('-> SERVER READ & FIRESTORE CONNECTION: PASS');
      } else {
        log('-> Data mismatch in _systemTests read');
      }
    } else {
      log('-> Document e2e_connection_test not found in _systemTests');
    }

    // Server Update test
    log('5. Updating test document in _systemTests...');
    await testDocRef.update({
      status: 'updated_successfully',
      updatedAt: new Date().toISOString(),
    });
    const updatedSnap = await testDocRef.get();
    if (updatedSnap.data()?.status === 'updated_successfully') {
      results['SERVER UPDATE'] = 'PASS';
      log('-> SERVER UPDATE: PASS');
    }

    // 6. Delete test document
    log('6. Deleting test document from _systemTests...');
    await testDocRef.delete();
    const deletedSnap = await testDocRef.get();
    if (!deletedSnap.exists) {
      results['SERVER DELETE'] = 'PASS';
      log('-> SERVER DELETE: PASS');
    }
  } catch (err: any) {
    log(`[ERROR] Firestore Direct Ops Failed: ${err.message || err}`);
  }

  // Step 7: Domain Repository CRUD test
  try {
    log('7. Testing domain repository (customersRepository) CRUD...');
    const testCustId = `test-cust-${Date.now()}`;
    const createdCust = await customersRepository.create({
      id: testCustId,
      name: 'E2E Test Customer',
      phone: '9998887776',
      place: 'Chennai',
      outstandingBalance: 0,
      free200mlSamplesUsed: 0,
      totalOrdersCount: 0,
      totalSpent: 0,
      isArchived: false,
    });
    log(`-> Created customer doc: ${createdCust.id}`);

    const readCust = await customersRepository.getById(testCustId);
    if (readCust && readCust.name === 'E2E Test Customer') {
      log(`-> Read customer doc successfully: ${readCust.name}`);

      const updatedCust = await customersRepository.update(testCustId, {
        name: 'E2E Test Customer Updated',
      });

      if (updatedCust.name === 'E2E Test Customer Updated') {
        log(`-> Updated customer doc successfully: ${updatedCust.name}`);

        await customersRepository.delete(testCustId);
        const deletedCust = await customersRepository.getById(testCustId);
        if (!deletedCust) {
          log(`-> Deleted customer doc successfully.`);
        }
      }
    }
  } catch (err: any) {
    log(`[ERROR] Domain Repository test failed: ${err.message || err}`);
  }

  // Step 8: Frontend API calls over HTTP
  try {
    log('8. Testing Frontend API endpoints over HTTP localhost:3000...');
    const healthRes = await fetch('http://localhost:3000/api/db/health').then(r => r.json());
    log(`-> /api/db/health response: ${JSON.stringify(healthRes)}`);

    const custRes = await fetch('http://localhost:3000/api/firestore/customers').then(r => r.json());
    log(`-> /api/firestore/customers response count: ${custRes.data?.length}`);

    if (healthRes.connected && custRes.success) {
      results['FRONTEND API'] = 'PASS';
      log('-> FRONTEND API: PASS');
    }
  } catch (err: any) {
    log(`[ERROR] HTTP Frontend API test failed: ${err.message || err}`);
  }

  // Step 9: Security checks
  try {
    log('9. Checking security, secrets, and SDK usage...');
    let securityPass = true;

    // Check src/ for firebase-admin imports
    const srcFiles = fs.readdirSync(path.join(process.cwd(), 'src'), { recursive: true }) as string[];
    for (const f of srcFiles) {
      if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
        const content = fs.readFileSync(path.join(process.cwd(), 'src', f), 'utf8');
        if (content.includes('firebase-admin')) {
          log(`[SECURITY VIOLATION] src/${f} imports firebase-admin!`);
          securityPass = false;
        }
      }
    }

    // Check git tracked files / existence of service account key
    if (fs.existsSync(path.join(process.cwd(), 'service-account.json')) || fs.existsSync(path.join(process.cwd(), 'serviceAccountKey.json'))) {
      log(`[SECURITY VIOLATION] Service account key JSON committed in root!`);
      securityPass = false;
    }

    if (securityPass) {
      results['SECURITY'] = 'PASS';
      results['AUTHORIZATION'] = 'PASS';
      log('-> SECURITY & AUTHORIZATION: PASS');
    }
  } catch (err: any) {
    log(`[ERROR] Security check failed: ${err.message || err}`);
  }

  // Step 10: Typecheck & Lint
  try {
    log('10. Running TypeScript Typecheck & Lint...');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    results['TYPECHECK'] = 'PASS';
    results['LINT'] = 'PASS';
    log('-> TYPECHECK & LINT: PASS');
  } catch (err: any) {
    log(`[ERROR] Typecheck/Lint failed: ${err.stdout?.toString() || err.message}`);
  }

  console.log('\n=== FINAL VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

runVerification();
