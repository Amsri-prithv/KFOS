import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: 'Founder' | 'Admin' | 'Sales' | 'Operations' | 'Finance' | 'Support';
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For local dev / default session fallback
    req.user = {
      id: 'usr_founder',
      name: 'Amsri Prithvi (Founder)',
      role: 'Founder',
    };
    return next();
  }

  // Simplified token check for demo/dev authentication
  if (token === 'kfos_admin_token' || token === config.adminPin) {
    req.user = {
      id: 'usr_founder',
      name: 'Amsri Prithvi (Founder)',
      role: 'Founder',
    };
    return next();
  }

  req.user = {
    id: 'usr_sales_field',
    name: 'Field Sales Officer',
    role: 'Sales',
  };
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied: Insufficient role permissions.',
        requiredRoles: allowedRoles,
      });
    }
    next();
  };
};
