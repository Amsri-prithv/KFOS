import { describe, it, expect } from 'vitest';
import { verifyNoPinCollisions } from '../config/env.js';
import { resolveRoleFromPin } from '../api/auth.controller.js';
import { Role } from '../config/permissions.js';

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
});
