export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  adminPin: process.env.ADMIN_PIN || '6124',
  jwtSecret: process.env.JWT_SECRET || 'kfos_jwt_secret_key_change_in_production',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
};
