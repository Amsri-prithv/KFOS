import { Request, Response } from 'express';
import crypto from 'crypto';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { PERMISSION_MATRIX, Role } from '../config/permissions.js';
import { config } from '../config/env.js';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// In-memory rate limiting map for login attempts
interface AttemptTracker {
  attempts: number;
  lockoutTimer: NodeJS.Timeout | null;
  lockedUntil: number;
}
export const loginAttempts = new Map<string, AttemptTracker>();

const LOCKOUT_DURATION = 60 * 1000; // 1 minute lockout
const MAX_ATTEMPTS = 5;

// Clean up expired rate limiting entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, tracker] of loginAttempts.entries()) {
    if (now > tracker.lockedUntil && tracker.attempts >= MAX_ATTEMPTS) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function getIpAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export function resolveRoleFromPin(pin: string, pinsConfig: {
  founderPin: string;
  adminPin: string;
  salesPin: string;
  opsPin: string;
  financePin: string;
  supportPin: string;
} = config): { id: string; name: string; role: Role } | null {
  const pinTrimmed = pin.trim();
  const hashedInput = crypto.createHash('sha256').update(pinTrimmed).digest();

  const roles = [
    { id: 'usr_founder', name: 'Amsri Prithvi (Founder)', role: 'Founder' as Role, pin: pinsConfig.founderPin },
    { id: 'usr_admin', name: 'KFOS System Admin', role: 'Admin' as Role, pin: pinsConfig.adminPin },
    { id: 'usr_sales', name: 'Field Sales Lead', role: 'Sales' as Role, pin: pinsConfig.salesPin },
    { id: 'usr_ops', name: 'Inventory Operations Lead', role: 'Operations' as Role, pin: pinsConfig.opsPin },
    { id: 'usr_finance', name: 'Finance & Accounts', role: 'Finance' as Role, pin: pinsConfig.financePin },
    { id: 'usr_support', name: 'Customer Support', role: 'Support' as Role, pin: pinsConfig.supportPin },
  ];

  const matches: { id: string; name: string; role: Role }[] = [];

  for (const r of roles) {
    const hashedRolePin = crypto.createHash('sha256').update(r.pin).digest();
    if (crypto.timingSafeEqual(hashedInput, hashedRolePin)) {
      matches.push({ id: r.id, name: r.name, role: r.role });
    }
  }

  if (matches.length > 1) {
    throw new Error('CRITICAL AUTH ERROR: Multiple roles matched the same PIN. Authentication rejected due to role collision.');
  }

  return matches[0] || null;
}

export const handleLogin = async (req: Request, res: Response) => {
  const ip = getIpAddress(req);
  const now = Date.now();

  let tracker = loginAttempts.get(ip);
  if (tracker && tracker.lockedUntil > now) {
    const timeLeft = Math.ceil((tracker.lockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please try again in ${timeLeft} seconds.`,
    });
  }

  const { pin } = req.body;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid login request' });
  }

  let account: { id: string; name: string; role: Role } | null = null;
  try {
    account = resolveRoleFromPin(pin);
  } catch (err: any) {
    console.error('[Auth] resolveRoleFromPin error:', err);
    return res.status(401).json({ success: false, error: 'Authentication rejected due to configuration error.' });
  }

  if (!account) {
    // Record failed attempt
    if (!tracker) {
      tracker = { attempts: 0, lockoutTimer: null, lockedUntil: 0 };
      loginAttempts.set(ip, tracker);
    }
    tracker.attempts += 1;

    if (tracker.attempts >= MAX_ATTEMPTS) {
      tracker.lockedUntil = now + LOCKOUT_DURATION;
      if (tracker.lockoutTimer) clearTimeout(tracker.lockoutTimer);
      tracker.lockoutTimer = setTimeout(() => {
        loginAttempts.delete(ip);
      }, LOCKOUT_DURATION);

      return res.status(429).json({
        success: false,
        error: 'Too many failed login attempts. Account locked for 1 minute.',
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid PIN or credentials.' });
  }

  // Success! Clear attempt tracking
  if (tracker) {
    if (tracker.lockoutTimer) clearTimeout(tracker.lockoutTimer);
    loginAttempts.delete(ip);
  }

  const role: Role = account.role;

  const token = generateToken({
    id: account.id,
    name: account.name,
    role,
  });

  return res.json({
    success: true,
    token,
    user: {
      id: account.id,
      name: account.name,
      role,
      permissions: PERMISSION_MATRIX[role],
    },
  });
};

export const handleVerify = async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'Missing authorization token' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ authenticated: false, error: 'Invalid or expired token' });
  }

  return res.json({
    authenticated: true,
    user: {
      id: payload.id,
      name: payload.name,
      role: payload.role,
      permissions: PERMISSION_MATRIX[payload.role],
    },
  });
};
