import { Request, Response } from 'express';
import { processTelegramUpdate } from '../services/telegram.service.js';
import { config } from '../config/env.js';

export const handleTelegramWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Verify Telegram Webhook Secret Header
    const secretHeader = (req.headers['x-telegram-bot-api-secret-token'] || req.headers['X-Telegram-Bot-Api-Secret-Token']) as string | undefined;

    if (config.telegramWebhookSecret && secretHeader !== config.telegramWebhookSecret) {
      console.warn('[Telegram Controller] Webhook authorization failed. Missing or invalid secret header.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid webhook secret token',
      });
    }

    const update = req.body;
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid update body' });
    }

    const result = await processTelegramUpdate(update);

    return res.status(200).json({
      success: result.success,
      duplicate: result.duplicate || false,
      intent: result.intent,
      reply: result.reply,
      pendingActionCreated: result.pendingActionCreated || false,
      actionExecuted: result.actionExecuted || false,
    });
  } catch (err: any) {
    console.error('[Telegram Controller] Webhook Processing Error:', err);
    // Sanitize error output - do not leak internal stack traces or internal errors to client
    return res.status(200).json({
      success: false,
      error: 'Telegram update processing failed',
      reply: '❌ An error occurred while processing your message. Please try again.',
    });
  }
};

export const handleTelegramMessage = async (req: Request, res: Response) => {
  // Production protection: disable direct message endpoint in production
  if (config.isProduction) {
    return res.status(403).json({
      success: false,
      error: 'Direct message endpoint is disabled in production. Use secure Telegram webhook.',
    });
  }

  // In non-production/test environments, verify secret or dev header
  const secretHeader = (req.headers['x-telegram-bot-api-secret-token'] || req.headers['X-Telegram-Bot-Api-Secret-Token']) as string | undefined;
  if (config.telegramWebhookSecret && secretHeader && secretHeader !== config.telegramWebhookSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid secret token' });
  }

  return handleTelegramWebhook(req, res);
};

