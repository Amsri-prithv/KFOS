import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserTokenPayload } from '../utils/jwt.js';
import { hasPermission, Role } from '../config/permissions.js';

export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Authorization token missing.',
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Invalid or expired token.',
    });
  }

  req.user = payload;
  next();
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated user.' });
    }

    if (req.user.role === 'Founder' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied: Insufficient role permissions.',
      userRole: req.user.role,
      requiredRoles: allowedRoles,
    });
  };
};

export const requireResourcePermission = (resource: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated user.' });
    }

    if (hasPermission(req.user.role, resource)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied: Role ${req.user.role} lacks permission for ${resource}.`,
    });
  };
};
