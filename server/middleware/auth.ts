import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserTokenPayload } from '../utils/jwt.js';
import { hasPermission, Role } from '../config/permissions.js';

export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
}

// Simple, lightweight cookie parsing utility
const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return cookies;
};

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  let token = '';
  let isCookieAuth = false;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (authHeader) {
    token = authHeader;
  } else {
    // Attempt to extract from kfos_session cookie
    const cookiesHeader = req.headers.cookie;
    if (cookiesHeader) {
      const parsedCookies = parseCookies(cookiesHeader);
      token = parsedCookies['kfos_session'] || '';
      if (token) {
        isCookieAuth = true;
      }
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Session token is missing.',
    });
  }

  // If cookie auth is used, apply strict CSRF validation for mutating methods
  if (isCookieAuth && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const parsedCookies = parseCookies(req.headers.cookie);
    const csrfCookie = parsedCookies['XSRF-TOKEN'];
    const csrfHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        success: false,
        error: 'Security alert: CSRF token verification failed.',
      });
    }
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
