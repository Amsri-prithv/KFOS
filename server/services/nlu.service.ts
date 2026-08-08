import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from '../config/env.js';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    if (config.geminiApiKey) {
      aiInstance = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }
  return aiInstance;
}

export type NluIntent =
  | 'CREATE_ORDER'
  | 'RECORD_PAYMENT'
  | 'CHECK_STOCK'
  | 'CHECK_SALES'
  | 'CHECK_CUSTOMER'
  | 'CHECK_OUTSTANDING'
  | 'CHECK_ORDER'
  | 'CHECK_PROFIT'
  | 'RECORD_EXPENSE'
  | 'CREATE_LEAD'
  | 'CREATE_SAMPLE'
  | 'CREATE_TASK'
  | 'CREATE_SUPPORT_TICKET'
  | 'UNKNOWN';

export interface NluParseResult {
  intent: NluIntent;
  confidence: number;
  customerName?: string;
  customerPlace?: string;
  qualityGrade?: 'Eco' | 'Standard' | 'Premium';
  quantityCans?: number;
  discountPerUnit?: number;
  paymentAmount?: number;
  expenseAmount?: number;
  expenseReason?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

const nluSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        'CREATE_ORDER',
        'RECORD_PAYMENT',
        'CHECK_STOCK',
        'CHECK_SALES',
        'CHECK_CUSTOMER',
        'CHECK_OUTSTANDING',
        'CHECK_ORDER',
        'CHECK_PROFIT',
        'RECORD_EXPENSE',
        'CREATE_LEAD',
        'CREATE_SAMPLE',
        'CREATE_TASK',
        'CREATE_SUPPORT_TICKET',
        'UNKNOWN',
      ],
    },
    confidence: { type: Type.NUMBER },
    customerName: { type: Type.STRING },
    customerPlace: { type: Type.STRING },
    qualityGrade: { type: Type.STRING, enum: ['Eco', 'Standard', 'Premium'] },
    quantityCans: { type: Type.INTEGER },
    discountPerUnit: { type: Type.NUMBER },
    paymentAmount: { type: Type.NUMBER },
    expenseAmount: { type: Type.NUMBER },
    expenseReason: { type: Type.STRING },
    needsClarification: { type: Type.BOOLEAN },
    clarificationQuestion: { type: Type.STRING },
  },
  required: ['intent', 'confidence'],
};

// Quick Rule-Based Fallback Parser (used when Gemini API hits 429 rate limit)
function fallbackRuleBasedParse(text: string): NluParseResult {
  const lower = text.toLowerCase();

  // Stock query
  if (lower.includes('stock') || lower.includes('evlo stock') || lower.includes('iruku')) {
    return { intent: 'CHECK_STOCK', confidence: 0.85 };
  }

  // Sales / Profit query
  if (lower.includes('sales') || lower.includes('revenue') || lower.includes('profit')) {
    return { intent: 'CHECK_SALES', confidence: 0.85 };
  }

  // Last order query
  if (lower.includes('last order') || lower.includes('recent order') || lower.includes('order details')) {
    return { intent: 'CHECK_ORDER', confidence: 0.85 };
  }

  // Payment recording
  if (lower.includes('payment') || lower.includes('paid') || lower.includes('pannitaaru') || lower.includes('pay')) {
    const numbers = lower.match(/\d+/g);
    const amount = numbers ? parseInt(numbers[0], 10) : undefined;
    const words = text.split(' ');
    const customerName = words[0] && !['payment', 'paid'].includes(words[0].toLowerCase()) ? words[0] : 'Ramesh';
    return {
      intent: 'RECORD_PAYMENT',
      confidence: 0.8,
      customerName,
      paymentAmount: amount,
    };
  }

  // Order creation
  if (
    lower.includes('order') ||
    lower.includes('venum') ||
    lower.includes('cans') ||
    lower.includes('can') ||
    lower.includes('box')
  ) {
    const numbers = lower.match(/\d+/g);
    const qty = numbers ? parseInt(numbers[0], 10) : 5;
    let grade: 'Eco' | 'Standard' | 'Premium' = 'Standard';
    if (lower.includes('eco')) grade = 'Eco';
    if (lower.includes('premium')) grade = 'Premium';

    const words = text.split(' ');
    const customerName = words[0] && !['order', '5', 'cans', 'eco', 'standard', 'premium'].includes(words[0].toLowerCase())
      ? words[0]
      : 'Ramesh';

    return {
      intent: 'CREATE_ORDER',
      confidence: 0.8,
      customerName,
      qualityGrade: grade,
      quantityCans: qty,
    };
  }

  // Expense
  if (lower.includes('expense') || lower.includes('petrol') || lower.includes('tea') || lower.includes('diesel')) {
    const numbers = lower.match(/\d+/g);
    const amount = numbers ? parseInt(numbers[0], 10) : 200;
    return {
      intent: 'RECORD_EXPENSE',
      confidence: 0.8,
      expenseAmount: amount,
      expenseReason: text,
    };
  }

  // Default ambiguous input
  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    needsClarification: true,
    clarificationQuestion: 'Could you please specify customer name, quantity, and grade?',
  };
}

export interface ParseNluInputOptions {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
}

export async function parseNluInput(options: ParseNluInputOptions): Promise<NluParseResult> {
  const { text, audioBase64, mimeType } = options;

  if (!text && !audioBase64) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      needsClarification: true,
      clarificationQuestion: 'Please send a valid text or voice message.',
    };
  }

  const ai = getAiClient();
  if (!ai) {
    console.warn('[NLU Service] GEMINI_API_KEY missing. Using rule-based fallback.');
    return fallbackRuleBasedParse(text || '');
  }

  const systemInstruction = `
You are the NLU Engine for Kashmeer Fragrances Operating System (KFOS), a B2B fragrance manufacturing business in Tamil Nadu.
You process natural language inputs in Tamil, Tanglish (Tamil written in Latin alphabet), or English.

Your job is to identify the intent and extract structured parameters:
- CREATE_ORDER: Customer places order (e.g., "Ramesh ku 5 Standard cans venum", "Arun 10 premium order pannirukaaru"). Extract customerName, customerPlace, qualityGrade ('Eco'|'Standard'|'Premium'), quantityCans, discountPerUnit, paymentAmount.
- RECORD_PAYMENT: Customer paid money (e.g., "Ramesh payment 2000 pannitaaru", "Arun paid 5000"). Extract customerName, paymentAmount.
- CHECK_STOCK: Inventory level query (e.g., "Standard stock evlo?", "How many cans left?").
- CHECK_SALES: Today sales query (e.g., "Today sales evlo?", "Total sales revenue today").
- CHECK_CUSTOMER / CHECK_OUTSTANDING: Outstanding balance query (e.g., "Ramesh balance evlo?").
- CHECK_ORDER: Recent order query (e.g., "Last order details kudu").
- RECORD_EXPENSE: Travel/food/field expense (e.g., "Petrol expense 300"). Extract expenseAmount, expenseReason.
- UNKNOWN: Ambiguous message or missing details. Set needsClarification=true and provide clarificationQuestion in Tanglish/English.
`;

  const contents: any[] = [];
  if (audioBase64) {
    contents.push({
      inlineData: {
        data: audioBase64,
        mimeType: mimeType || 'audio/ogg',
      },
    });
    contents.push({
      text: 'Transcribe this voice message (Tamil / Tanglish / English) and analyze the intent and parameters.',
    });
  } else if (text) {
    contents.push({ text: `Message: "${text}"` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: nluSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return fallbackRuleBasedParse(text || '');
    }

    const parsed: NluParseResult = JSON.parse(responseText);
    return parsed;
  } catch (err: any) {
    console.warn('[NLU Service] Gemini API call error/rate-limit. Falling back to rule-based engine:', err.message || err);
    return fallbackRuleBasedParse(text || '');
  }
}
