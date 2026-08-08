import { Request, Response } from 'express';
import { processTelegramMessage } from '../services/telegram.service.js';

export const handleTelegramMessage = async (req: Request, res: Response) => {
  try {
    const { message, text } = req.body;
    const inputMessage = text || (message && message.text) || '';

    if (!inputMessage) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const botReply = await processTelegramMessage(inputMessage);
    res.json({ success: true, reply: botReply });
  } catch (err: any) {
    console.error('Telegram API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Telegram processing failed' });
  }
};
