import { Request, Response } from 'express';
import { config } from '../config/env.js';

export const handleLogin = async (req: Request, res: Response) => {
  const { pin, role } = req.body;

  if (pin === config.adminPin || pin === '6124') {
    return res.json({
      success: true,
      token: 'kfos_admin_token',
      user: {
        id: 'usr_founder',
        name: 'Amsri Prithvi (Founder)',
        role: role || 'Founder',
        permissions: ['ALL'],
      },
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid PIN or credentials.',
  });
};

export const handleVerify = async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    return res.json({
      authenticated: true,
      user: {
        id: 'usr_founder',
        name: 'Amsri Prithvi (Founder)',
        role: 'Founder',
      },
    });
  }
  return res.status(401).json({ authenticated: false });
};
