import { GoogleGenAI, Type } from '@google/genai';
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

export const parseNluInput = async ({
  text,
  audioBase64,
  mimeType,
}: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
}) => {
  const ai = getGenAI();

  const prompt = `
You are the Kashmeer Fragrances Operating System (KFOS) Voice & Text Parsing Engine.
Your task is to parse field sales notes in Tanglish, English, or Tamil into structured transaction JSON.

Key Business Constraints to Apply:
1. Product Variants: "Room Freshener" or "Bathroom Freshener". Default is "Room Freshener".
2. Quality Grades: "Eco" (Cost ₹650, Sale ₹900), "Standard" (Cost ₹750, Sale ₹1200), "Premium" (Cost ₹950, Sale ₹1500). Default is "Standard".
3. Unit Container: All bulk liquid orders are in 5-Litre Cans. Default quantity is 5 cans.
4. Samples Rule: Samples are always 200ml or 500ml of Premium Quality.
5. If the field staff requests a sample distribution, set issueSample = true and specify sampleType ("200ml" or "500ml").
6. Absolute Discount: Calculate total discount in Rupees (not percentage).
7. If return is mentioned (e.g. "product returned", "customer returned 2 cans"), set isReturn = true.

Respond ONLY with valid JSON conforming to the requested schema.
`;

  const contents: any[] = [];

  if (audioBase64) {
    contents.push({
      inlineData: {
        data: audioBase64,
        mimeType: mimeType || 'audio/webm',
      },
    });
  }

  if (text) {
    contents.push({ text });
  } else {
    contents.push({ text: 'Parse the audio field note into the structured KFOS order JSON.' });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [prompt, ...contents],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            description: 'Intent: CREATE_ORDER, ISSUE_SAMPLE, PROCESS_RETURN, CHECK_INVENTORY, CUSTOMER_QUERY',
          },
          customerName: { type: Type.STRING },
          customerPlace: { type: Type.STRING },
          productVariant: { type: Type.STRING, enum: ['Room Freshener', 'Bathroom Freshener'] },
          qualityGrade: { type: Type.STRING, enum: ['Eco', 'Standard', 'Premium'] },
          quantityCans: { type: Type.INTEGER, description: 'Quantity of 5L Cans' },
          discountPerUnit: { type: Type.NUMBER, description: 'Absolute discount in Rupees per 5L Can' },
          paidAmount: { type: Type.NUMBER, description: 'Amount paid in cash/UPI' },
          paymentStatus: { type: Type.STRING, enum: ['Paid', 'Partial', 'Unpaid'] },
          issueSample: { type: Type.BOOLEAN },
          sampleType: { type: Type.STRING, enum: ['200ml', '500ml'] },
          isReturn: { type: Type.BOOLEAN },
          returnReason: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER },
          clarificationNeeded: { type: Type.STRING },
        },
        required: [
          'intent',
          'customerName',
          'customerPlace',
          'productVariant',
          'qualityGrade',
          'quantityCans',
        ],
      },
    },
  });

  return JSON.parse(response.text || '{}');
};
