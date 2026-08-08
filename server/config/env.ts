import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Fail fast in production if critical environment variables are missing
if (isProduction) {
  const missingSecrets: string[] = [];
  if (!process.env.ADMIN_PIN) missingSecrets.push('ADMIN_PIN');
  if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET');
  if (!process.env.TELEGRAM_BOT_TOKEN) missingSecrets.push('TELEGRAM_BOT_TOKEN');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) missingSecrets.push('TELEGRAM_WEBHOOK_SECRET');
  if (!process.env.GEMINI_API_KEY) missingSecrets.push('GEMINI_API_KEY');

  if (missingSecrets.length > 0) {
    console.error(`[FATAL] Missing required production environment variables: ${missingSecrets.join(', ')}`);
    // Fail fast in production environment
    throw new Error(`CRITICAL: Missing production secrets: ${missingSecrets.join(', ')}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  adminPin: process.env.ADMIN_PIN || '6124',
  jwtSecret: process.env.JWT_SECRET || 'kfos_jwt_secret_key_dev_only',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'kfos_telegram_webhook_secret_dev_only',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction,
};

