import crypto from 'crypto';
import { config } from '../config/env.js';
import { Role } from '../config/permissions.js';

export interface UserTokenPayload {
  id: string;
  name: string;
  role: Role;
  exp: number;
}

const VALID_ROLES = ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'];

function base64UrlEncode(str: string | Buffer): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function base64UrlDecodeToBuffer(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function safeCompare(buf1: Buffer, buf2: Buffer): boolean {
  // Hash both buffers with SHA-256 to ensure they are compared in constant-time with equal lengths
  const h1 = crypto.createHash('sha256').update(buf1).digest();
  const h2 = crypto.createHash('sha256').update(buf2).digest();
  const match = crypto.timingSafeEqual(h1, h2);
  return match && buf1.length === buf2.length;
}

export function generateToken(payload: { id: string; name: string; role: Role }, expiresInSeconds = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: UserTokenPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export function verifyToken(token: string): UserTokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Decode and validate Header
    const headerStr = base64UrlDecode(encodedHeader);
    const header = JSON.parse(headerStr);
    if (!header || typeof header !== 'object') return null;
    
    // Strict algorithm check (prevent algorithm confusion)
    if (header.alg !== 'HS256') {
      return null;
    }
    // Validate typ if present
    if (header.typ !== undefined && header.typ !== 'JWT') {
      return null;
    }

    // Verify signature using timing-safe comparison
    const expectedSignatureBuf = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

    const providedSignatureBuf = base64UrlDecodeToBuffer(encodedSignature);

    if (!safeCompare(expectedSignatureBuf, providedSignatureBuf)) {
      return null;
    }

    // Decode and validate Payload
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadStr);
    if (!payload || typeof payload !== 'object') return null;

    // Validate payload fields
    if (!payload.id || typeof payload.id !== 'string') return null;
    if (!payload.name || typeof payload.name !== 'string') return null;
    if (!payload.role || typeof payload.role !== 'string' || !VALID_ROLES.includes(payload.role)) return null;
    if (typeof payload.exp !== 'number') return null;

    // Validate expiration
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload as UserTokenPayload;
  } catch (e) {
    return null;
  }
}
