import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Fail fast in production if critical environment variables are missing
if (isProduction) {
  const missingSecrets: string[] = [];
  if (!process.env.ADMIN_PIN) missingSecrets.push('ADMIN_PIN');
  if (!process.env.FOUNDER_PIN) missingSecrets.push('FOUNDER_PIN');
  if (!process.env.SALES_PIN) missingSecrets.push('SALES_PIN');
  if (!process.env.OPS_PIN) missingSecrets.push('OPS_PIN');
  if (!process.env.FINANCE_PIN) missingSecrets.push('FINANCE_PIN');
  if (!process.env.SUPPORT_PIN) missingSecrets.push('SUPPORT_PIN');
  if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET');
  if (!process.env.TELEGRAM_BOT_TOKEN) missingSecrets.push('TELEGRAM_BOT_TOKEN');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) missingSecrets.push('TELEGRAM_WEBHOOK_SECRET');
  if (!process.env.GEMINI_API_KEY) missingSecrets.push('GEMINI_API_KEY');

  if (missingSecrets.length > 0) {
    console.error(`[FATAL] Missing required production environment variables: ${missingSecrets.join(', ')}`);
    // Fail fast in production environment
    throw new Error(`CRITICAL: Missing production secrets: ${missingSecrets.join(', ')}`);
  }

  // Reject default or weak JWT secrets in production
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret === 'kfos_jwt_secret_key_dev_only') {
    throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET cannot be set to the default development secret in production.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long in production.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  adminPin: process.env.ADMIN_PIN || '1111',
  founderPin: process.env.FOUNDER_PIN || '061224',
  salesPin: process.env.SALES_PIN || '2222',
  opsPin: process.env.OPS_PIN || '3333',
  financePin: process.env.FINANCE_PIN || '4444',
  supportPin: process.env.SUPPORT_PIN || '5555',
  jwtSecret: process.env.JWT_SECRET || 'kfos_jwt_secret_key_dev_only',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'kfos_telegram_webhook_secret_dev_only',
  allowedTelegramChatIds: process.env.ALLOWED_TELEGRAM_CHAT_IDS ? process.env.ALLOWED_TELEGRAM_CHAT_IDS.split(',').map(s => s.trim()) : [],
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction,
};

// Cryptographically secure validation function for PIN collisions
export function verifyNoPinCollisions(pinsObj: {
  founderPin: string;
  adminPin: string;
  salesPin: string;
  opsPin: string;
  financePin: string;
  supportPin: string;
}) {
  const pins = [
    { name: 'FOUNDER_PIN', val: pinsObj.founderPin },
    { name: 'ADMIN_PIN', val: pinsObj.adminPin },
    { name: 'SALES_PIN', val: pinsObj.salesPin },
    { name: 'OPS_PIN', val: pinsObj.opsPin },
    { name: 'FINANCE_PIN', val: pinsObj.financePin },
    { name: 'SUPPORT_PIN', val: pinsObj.supportPin },
  ];

  // Map to SHA-256 hash buffers for timing-safe comparison
  const hashedPins = pins.map((p) => ({
    name: p.name,
    hash: crypto.createHash('sha256').update(p.val).digest(),
  }));

  for (let i = 0; i < hashedPins.length; i++) {
    for (let j = i + 1; j < hashedPins.length; j++) {
      if (crypto.timingSafeEqual(hashedPins[i].hash, hashedPins[j].hash)) {
        throw new Error(`CRITICAL CONFIGURATION ERROR: PIN collision detected between role PINs (${hashedPins[i].name} and ${hashedPins[j].name}). Duplicate PINs are prohibited.`);
      }
    }
  }
}

// Perform PIN collision check immediately on startup in production
if (isProduction) {
  verifyNoPinCollisions(config);
}

