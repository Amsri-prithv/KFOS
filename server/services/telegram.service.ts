import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return genAI;
}

export const processTelegramMessage = async (userMessage: string) => {
  const ai = getGenAI();

  const systemInstruction = `
You are KFOS-Bot, the official Kashmeer Fragrances Telegram Assistant for Tamil Nadu field sales officers.
You assist field reps in Trichy, Madurai, Salem, Coimbatore, Chennai with:
- Recording 5L Can orders for Room Freshener & Bathroom Freshener
- Checking shared liquid stock pools (Eco, Standard, Premium)
- Issuing 200ml / 500ml Premium samples with auto 3-day follow-ups
- Explaining the mandatory ₹0 sample profit rule
- Generating Morning Visit Plans and EOD Summaries

Be concise, helpful, clear, and respond in polite Tanglish / English appropriate for Tamil Nadu business conversations.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userMessage,
    config: {
      systemInstruction,
    },
  });

  return response.text || 'KFOS Bot processed your request.';
};
