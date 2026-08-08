import { Request, Response } from 'express';
import crypto from 'crypto';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { PERMISSION_MATRIX, Role } from '../config/permissions.js';
import { config } from '../config/env.js';
import { firestoreDb } from '../firebase/firestore.js';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const LOCKOUT_DURATION = 60 * 1000; // 1 minute lockout
const MAX_ATTEMPTS = 5;

const getAttemptRef = (ip: string) => {
  // Sanitize IP address so it is a safe Firestore document ID
  const safeIp = ip.replace(/[^a-zA-Z0-9.-]/g, '_');
  return firestoreDb.collection('authLoginAttempts').doc(safeIp);
};

function getIpAddress(req: Request): string {
  // Safe client IP extraction handling X-Forwarded-For under trust proxy configuration
  const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  // Strip IPv6-mapped IPv4 prefix if present
  return rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
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
  const attemptRef = getAttemptRef(ip);

  const { pin } = req.body;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid login request' });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  let authResult: {
    success: boolean;
    status: number;
    error?: string;
    account?: { id: string; name: string; role: Role };
  } | null = null;

  try {
    authResult = await firestoreDb.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(attemptRef);
      let attempts = 0;
      let lockedUntil = 0;

      if (doc.exists) {
        const data = doc.data() || {};
        lockedUntil = data.lockedUntil || 0;
        attempts = data.attempts || 0;

        // Reset attempts if lockout duration has passed
        if (lockedUntil > 0 && now > lockedUntil) {
          attempts = 0;
          lockedUntil = 0;
          transaction.delete(attemptRef);
        }
      }

      // Check if currently locked out
      if (lockedUntil > 0 && now < lockedUntil) {
        const timeLeft = Math.ceil((lockedUntil - now) / 1000);
        return {
          success: false,
          status: 429,
          error: `Too many failed login attempts. Please try again in ${timeLeft} seconds.`,
        };
      }

      let account: { id: string; name: string; role: Role } | null = null;
      try {
        account = resolveRoleFromPin(pin);
      } catch (err: any) {
        console.error('[Auth] resolveRoleFromPin error:', err);
        return {
          success: false,
          status: 401,
          error: 'Authentication rejected due to configuration error.',
        };
      }

      if (!account) {
        const newAttempts = attempts + 1;
        let newLockedUntil = 0;
        if (newAttempts >= MAX_ATTEMPTS) {
          newLockedUntil = now + LOCKOUT_DURATION;
        }

        transaction.set(attemptRef, {
          attempts: newAttempts,
          lockedUntil: newLockedUntil,
          lastAttempt: now,
        }, { merge: true });

        if (newAttempts >= MAX_ATTEMPTS) {
          return {
            success: false,
            status: 429,
            error: 'Too many failed login attempts. Account locked for 1 minute.',
          };
        }

        return {
          success: false,
          status: 401,
          error: 'Invalid PIN or credentials.',
        };
      }

      // Success! Clear attempt tracking in Firestore
      transaction.delete(attemptRef);

      return {
        success: true,
        status: 200,
        account,
      };
    });
  } catch (err: any) {
    console.error('[Auth] Error in transaction rate-limiting:', err);

    if (isProduction || isTest) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
      });
    }

    // Permissive fallback in local development only
    try {
      const account = resolveRoleFromPin(pin);
      if (!account) {
        return res.status(401).json({ success: false, error: 'Invalid PIN or credentials.' });
      }
      authResult = { success: true, status: 200, account };
    } catch (resolveErr) {
      return res.status(401).json({ success: false, error: 'Authentication rejected due to configuration error.' });
    }
  }

  if (!authResult) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable. Please try again later.',
    });
  }

  if (!authResult.success) {
    return res.status(authResult.status).json({ success: false, error: authResult.error });
  }

  const account = authResult.account!;
  const role: Role = account.role;

  const token = generateToken({
    id: account.id,
    name: account.name,
    role,
  });

  // Set secure HttpOnly cookie for session token
  res.cookie('kfos_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Set standard cookie for CSRF token validation
  const csrfToken = crypto.randomUUID();
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
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
  // Support both header and cookie authentication
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (authHeader) {
    token = authHeader;
  } else {
    const cookiesHeader = req.headers.cookie;
    if (cookiesHeader) {
      const parsedCookies: Record<string, string> = {};
      cookiesHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        if (parts.length >= 2) {
          parsedCookies[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      });
      token = parsedCookies['kfos_session'] || '';
    }
  }

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

export const handleLogout = async (req: Request, res: Response) => {
  res.clearCookie('kfos_session');
  res.clearCookie('XSRF-TOKEN');
  return res.json({ success: true, message: 'Logged out successfully' });
};
