import { describe, it, expect } from 'vitest';
import { verifyNoPinCollisions } from '../config/env.js';
import { resolveRoleFromPin, handleLogin } from '../api/auth.controller.js';
import { Role } from '../config/permissions.js';
import { firestoreDb } from '../firebase/firestore.js';

describe('Role PIN Security & Collision Tests', () => {
  const uniqueConfig = {
    founderPin: '1000',
    adminPin: '2000',
    salesPin: '3000',
    opsPin: '4000',
    financePin: '5000',
    supportPin: '6000',
  };

  const duplicateConfig = {
    founderPin: '1000',
    adminPin: '1000', // Collision here
    salesPin: '3000',
    opsPin: '4000',
    financePin: '5000',
    supportPin: '6000',
  };

  describe('verifyNoPinCollisions', () => {
    it('successfully validates a configuration with unique PINs', () => {
      expect(() => verifyNoPinCollisions(uniqueConfig)).not.toThrow();
    });

    it('rejects duplicate role PIN configurations and fails fast with collision error', () => {
      expect(() => verifyNoPinCollisions(duplicateConfig)).toThrow(
        /CRITICAL CONFIGURATION ERROR: PIN collision detected/
      );
    });
  });

  describe('resolveRoleFromPin', () => {
    it('properly resolves every unique PIN to its exact intended role', () => {
      const rolesToVerify: { pin: string; expectedRole: Role; expectedUser: string }[] = [
        { pin: '1000', expectedRole: 'Founder', expectedUser: 'usr_founder' },
        { pin: '2000', expectedRole: 'Admin', expectedUser: 'usr_admin' },
        { pin: '3000', expectedRole: 'Sales', expectedUser: 'usr_sales' },
        { pin: '4000', expectedRole: 'Operations', expectedUser: 'usr_ops' },
        { pin: '5000', expectedRole: 'Finance', expectedUser: 'usr_finance' },
        { pin: '6000', expectedRole: 'Support', expectedUser: 'usr_support' },
      ];

      for (const t of rolesToVerify) {
        const result = resolveRoleFromPin(t.pin, uniqueConfig);
        expect(result).not.toBeNull();
        expect(result!.role).toBe(t.expectedRole);
        expect(result!.id).toBe(t.expectedUser);
      }
    });

    it('returns null for an invalid PIN that does not match any role', () => {
      const result = resolveRoleFromPin('9999', uniqueConfig);
      expect(result).toBeNull();
    });

    it('strictly throws and rejects authentication if a duplicate PIN is configured and used', () => {
      expect(() => resolveRoleFromPin('1000', duplicateConfig)).toThrow(
        /Multiple roles matched the same PIN. Authentication rejected/
      );
    });
  });

  describe('handleLogin Rate Limiting & Proxy Security Tests', () => {
    const mockRequest = (body: any, ip = '127.0.0.1', headers: Record<string, string> = {}) => {
      return {
        body,
        ip,
        headers,
        socket: { remoteAddress: ip },
      } as unknown as any;
    };

    const mockResponse = () => {
      const res: any = {};
      res.statusCode = 200;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        res.jsonData = data;
        return res;
      };
      res.cookie = (name: string, value: string, options: any) => {
        res.cookies = res.cookies || {};
        res.cookies[name] = { value, options };
        return res;
      };
      return res;
    };

    it('blocks login and returns 429 after 5 failed login attempts', async () => {
      const testIp = '101.102.103.104';
      
      // First 4 failed attempts should return 401
      for (let i = 0; i < 4; i++) {
        const req = mockRequest({ pin: '9999' }, testIp);
        const res = mockResponse();
        await handleLogin(req, res);
        expect(res.statusCode).toBe(401);
        expect(res.jsonData.success).toBe(false);
      }

      // 5th failed attempt must trigger 429 lockout
      const req5 = mockRequest({ pin: '9999' }, testIp);
      const res5 = mockResponse();
      await handleLogin(req5, res5);
      expect(res5.statusCode).toBe(429);
      expect(res5.jsonData.success).toBe(false);
      expect(res5.jsonData.error).toContain('Too many failed login attempts');

      // Subsequent attempt from same IP must be blocked
      const req6 = mockRequest({ pin: '9999' }, testIp);
      const res6 = mockResponse();
      await handleLogin(req6, res6);
      expect(res6.statusCode).toBe(429);
    }, 30000);

    it('allows retry and resets attempts after 1 minute lockout expires', async () => {
      const testIp = '105.106.107.108';
      
      // Trigger lockout with 5 failed attempts
      for (let i = 0; i < 5; i++) {
        const req = mockRequest({ pin: '9999' }, testIp);
        const res = mockResponse();
        await handleLogin(req, res);
      }

      // Verify currently locked
      const req6 = mockRequest({ pin: '9999' }, testIp);
      const res6 = mockResponse();
      await handleLogin(req6, res6);
      expect(res6.statusCode).toBe(429);

      // Mock time to bypass lockout (1 minute = 60000ms, add 5s buffer = 65000ms)
      const originalNow = Date.now;
      const futureTime = originalNow() + 65000;
      Date.now = () => futureTime;

      try {
        // Attempt login again - should reset lockout and return 401 instead of 429
        const reqAfter = mockRequest({ pin: '9999' }, testIp);
        const resAfter = mockResponse();
        await handleLogin(reqAfter, resAfter);
        expect(resAfter.statusCode).toBe(401);
        expect(resAfter.jsonData.error).toContain('Invalid PIN');
      } finally {
        Date.now = originalNow; // Restore original Date.now
      }
    }, 30000);

    it('clears failed attempt tracking upon successful login', async () => {
      const testIp = '109.110.111.112';

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const req = mockRequest({ pin: '9999' }, testIp);
        const res = mockResponse();
        await handleLogin(req, res);
        expect(res.statusCode).toBe(401);
      }

      // Successful login clears limiter
      const reqSuccess = mockRequest({ pin: '061224' }, testIp); // default founder pin
      const resSuccess = mockResponse();
      await handleLogin(reqSuccess, resSuccess);
      expect(resSuccess.statusCode).toBe(200);
      expect(resSuccess.jsonData.success).toBe(true);

      // Verify attempts are reset: another failed login should return 401 instead of being rate limited
      const reqFailedAgain = mockRequest({ pin: '9999' }, testIp);
      const resFailedAgain = mockResponse();
      await handleLogin(reqFailedAgain, resFailedAgain);
      expect(resFailedAgain.statusCode).toBe(401);
    }, 30000);

    it('ensures concurrent failed login requests are correctly serialized under a transaction', async () => {
      const testIp = '113.114.115.116';

      // Make 5 simultaneous failed login attempts
      const promises = Array.from({ length: 5 }).map(() => {
        const req = mockRequest({ pin: '9999' }, testIp);
        const res = mockResponse();
        return handleLogin(req, res).then(() => res);
      });

      const results = await Promise.all(promises);
      const statusCodes = results.map(r => r.statusCode);

      // Since the transactions are serialized, exactly 4 should get 401 and at least 1 must get 429
      const counts = statusCodes.reduce((acc, code) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      expect(counts[401]).toBe(4);
      expect(counts[429]).toBe(1);
    }, 30000);

    it('returns a fail-closed 503 status code in production/test environments if Firestore fails', async () => {
      const originalRunTransaction = firestoreDb.runTransaction;
      firestoreDb.runTransaction = async () => {
        throw new Error('Firestore read/write failure simulated for security testing');
      };

      try {
        const req = mockRequest({ pin: '9999' }, '117.118.119.120');
        const res = mockResponse();
        await handleLogin(req, res);

        expect(res.statusCode).toBe(503);
        expect(res.jsonData.success).toBe(false);
        expect(res.jsonData.error).toBe('Service temporarily unavailable. Please try again later.');
      } finally {
        firestoreDb.runTransaction = originalRunTransaction;
      }
    }, 30000);

    it('prevents X-Forwarded-For spoofing under trust proxy = 1', async () => {
      const expressApp = (await import('express')).default;
      const http = (await import('http')).default;

      const app = expressApp();
      app.set('trust proxy', 1);
      app.use(expressApp.json());
      
      let resolvedIp = '';
      app.post('/test-ip', (req, res) => {
        resolvedIp = req.ip || '';
        res.send({ ip: resolvedIp });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;

      try {
        // Scenario: Attacker spoofing '9.9.9.9' by sending 'X-Forwarded-For: 9.9.9.9'.
        // GFE (Google Front End / Cloud Run LB) appends the real socket caller IP ('127.0.0.1').
        // The final header received by our application is 'X-Forwarded-For: 9.9.9.9, 127.0.0.1'.
        const response = await fetch(`http://127.0.0.1:${port}/test-ip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '9.9.9.9, 127.0.0.1',
          },
        });
        const body = await response.json() as any;
        
        // Express must trust 1 hop (the GFE at 127.0.0.1) and correctly resolve
        // the client IP as the preceding one (which is 127.0.0.1 in the mock request loopback connection),
        // completely ignoring/normalizing the spoofed '9.9.9.9'.
        expect(body.ip).toBe('127.0.0.1');
        expect(body.ip).not.toBe('9.9.9.9');
      } finally {
        server.close();
      }
    }, 30000);
  });
});
