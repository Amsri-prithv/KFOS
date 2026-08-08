import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[KFOS Server Error]:', err);
  const statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sanitize 500 error messages in production to prevent leakage
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected server error occurred. Please contact the administrator.';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
};
