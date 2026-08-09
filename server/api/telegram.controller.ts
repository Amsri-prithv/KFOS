import express from 'express';
import { processTelegramUpdate, processDirectMessage } from '../services/telegram.service.js';

export const handleTelegramWebhook = async (req: express.Request, res: express.Response) => {
  try {
    const update = req.body;
    console.log('[Telegram Webhook] Received update:', JSON.stringify(update));

    if (!update) {
      return res.status(400).json({ status: 'error', message: 'No update payload received' });
    }

    // Acknowledge Telegram webhook immediately (200 OK) to prevent timeouts
    res.status(200).json({ status: 'ok' });

    // Process Telegram update asynchronously in the background
    processTelegramUpdate(update).catch((err) => {
      console.error('[Telegram Webhook Processing Error]:', err);
    });
  } catch (error: any) {
    console.error('[Telegram Webhook Controller Error]:', error);
    if (!res.headersSent) {
      res.status(200).json({ status: 'ok' });
    }
  }
};

export const handleTelegramMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { message, chatId } = req.body;
    if (!message || !chatId) {
      return res.status(400).json({ success: false, error: 'Message and chatId are required' });
    }
    const response = await processDirectMessage(message, chatId);
    return res.json({ success: true, reply: response });
  } catch (error: any) {
    console.error('[Telegram Message Controller Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to process message' });
  }
};
