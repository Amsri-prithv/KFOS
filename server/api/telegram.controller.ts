import { Request, Response } from 'express';
import { processTelegramUpdate } from '../services/telegram.service.js';

export const handleTelegramWebhook = async (req: Request, res: Response) => {
  try {
    const update = req.body;

    if (!update || (typeof update !== 'object')) {
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
    console.error('[Telegram Controller] Webhook Error:', err);
    // Always return 200 OK to Telegram so it doesn't endlessly retry bad updates,
    // but include error details in JSON response
    return res.status(200).json({
      success: false,
      error: 'Telegram webhook processing error',
      details: err.message,
    });
  }
};

export const handleTelegramMessage = handleTelegramWebhook;
