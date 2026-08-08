import { Request, Response } from 'express';
import crypto from 'crypto';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { PERMISSION_MATRIX, Role } from '../config/permissions.js';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// Map of hashed PINs to default system accounts
const VALID_PINS: Record<string, { id: string; name: string; role: Role }> = {
  // ADMIN_PIN or default 061224 / 6124
  [hashPin(process.env.ADMIN_PIN || '061224')]: {
    id: 'usr_founder',
    name: 'Amsri Prithvi (Founder)',
    role: 'Founder',
  },
  [hashPin('6124')]: {
    id: 'usr_founder',
    name: 'Amsri Prithvi (Founder)',
    role: 'Founder',
  },
  [hashPin('1111')]: {
    id: 'usr_admin',
    name: 'KFOS System Admin',
    role: 'Admin',
  },
  [hashPin('2222')]: {
    id: 'usr_sales',
    name: 'Field Sales Lead',
    role: 'Sales',
  },
  [hashPin('3333')]: {
    id: 'usr_ops',
    name: 'Inventory Operations Lead',
    role: 'Operations',
  },
  [hashPin('4444')]: {
    id: 'usr_finance',
    name: 'Finance & Accounts',
    role: 'Finance',
  },
  [hashPin('5555')]: {
    id: 'usr_support',
    name: 'Customer Support',
    role: 'Support',
  },
};

export const handleLogin = async (req: Request, res: Response) => {
  const { pin, requestedRole } = req.body;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ success: false, error: 'PIN is required' });
  }

  const hashedInput = hashPin(pin.trim());
  const account = VALID_PINS[hashedInput];

  if (!account) {
    return res.status(401).json({ success: false, error: 'Invalid PIN or credentials.' });
  }

  const role: Role = requestedRole && account.role === 'Founder' ? requestedRole : account.role;

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
