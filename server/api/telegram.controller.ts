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

    // KFOS-BUG-004: Acknowledge Telegram webhook immediately with HTTP 200
    res.status(200).json({ success: true, message: 'Processing started' });

    // Process asynchronously without blocking response
    processTelegramUpdate(update).catch((err) => {
      console.error('[Telegram Controller] Background Processing Error:', err);
    });
  } catch (err: any) {
    console.error('[Telegram Controller] Webhook Processing Error:', err.message, err.stack);
    
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Telegram update processing failed due to internal server error.',
      });
    }
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

