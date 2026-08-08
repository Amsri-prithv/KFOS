import { Request, Response } from 'express';
import { parseNluInput } from '../services/nlu.service.js';

export const handleNluParse = async (req: Request, res: Response) => {
  try {
    const { text, audioBase64, mimeType } = req.body;
    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'Either text or audioBase64 must be provided' });
    }

    const parsedResult = await parseNluInput({ text, audioBase64, mimeType });
    res.json({ success: true, data: parsedResult });
  } catch (err: any) {
    console.error('NLU API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'NLU Parsing failed' });
  }
};
