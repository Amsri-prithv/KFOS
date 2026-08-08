import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize GoogleGenAI server-side client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// NLU Voice & Text Parsing Endpoint using Gemini 3.6 Flash
app.post('/api/nlu/parse', async (req, res) => {
  try {
    const { input, audioBase64, mimeType } = req.body;

    if (!input && !audioBase64) {
      return res.status(400).json({ error: 'Please provide either text input or audio data' });
    }

    const systemInstruction = `
You are the Kashmeer Fragrances Operating System (KFOS) NLU Engine.
Kashmeer Fragrances sells 5L Cans of Liquid Fragrances in Tamil Nadu.

PRODUCT MATRIX & PRICING RULES:
1. Product Variants: "Room Freshener" or "Bathroom Freshener".
2. Quality Grades:
   - "Eco" (Buy ₹650, Sale ₹900, Profit ₹250)
   - "Standard" (Buy ₹750, Sale ₹1200, Profit ₹450)
   - "Premium" (Buy ₹950, Sale ₹1500, Profit ₹550)
3. Sample Rules: Only Premium quality samples exist. 200ml (Free up to 2 per customer lifetime, or ₹200 paid), 500ml (₹300 paid).
4. Discounts: Always absolute ₹ Amount (e.g. ₹50 off per can).
5. Input Language: Could be Tamil, Tanglish (Tamil written in English script e.g. "Ramesh traders trichy eco room freshener 5 cans thandhen 3000 vanginen"), or English.

Your Task: Parse the user's voice audio or text message and extract structured parameters.
If key information like Customer Name, Place, or Quantity is missing or ambiguous, set needsClarification = true and provide a helpful clarification question in simple Tamil/Tanglish/English.
`;

    let contentsPayload: any = [];

    if (audioBase64) {
      contentsPayload.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64,
        },
      });
      contentsPayload.push({
        text: 'Transcribe this voice note in Tamil/Tanglish/English and extract the field sales transaction details.',
      });
    } else {
      contentsPayload.push({
        text: `Parse this field sales note: "${input}"`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contentsPayload,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: 'Customer or store name' },
            place: { type: Type.STRING, description: 'City, area or location (e.g., Trichy, Madurai, Chennai)' },
            productVariant: {
              type: Type.STRING,
              description: 'Room Freshener or Bathroom Freshener',
            },
            quality: {
              type: Type.STRING,
              description: 'Eco, Standard, or Premium',
            },
            quantity: { type: Type.NUMBER, description: 'Number of 5L Cans sold or requested' },
            discount: { type: Type.NUMBER, description: 'Absolute discount amount per unit in rupees' },
            paymentAmount: { type: Type.NUMBER, description: 'Cash or payment received right now' },
            paymentStatus: {
              type: Type.STRING,
              description: 'Paid, Partial, or Unpaid',
            },
            samplesRequested: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sampleType: { type: Type.STRING, description: '200ml or 500ml' },
                  quantity: { type: Type.NUMBER, description: 'Number of sample bottles requested' },
                },
                required: ['sampleType', 'quantity'],
              },
            },
            isReturnRequest: { type: Type.BOOLEAN, description: 'True if this is a product return request' },
            rawTranscript: { type: Type.STRING, description: 'Transcribed text or input transcript' },
            confidenceScore: { type: Type.NUMBER, description: 'Confidence score from 0.0 to 1.0' },
            needsClarification: { type: Type.BOOLEAN, description: 'True if required fields are missing' },
            clarificationQuestion: { type: Type.STRING, description: 'Clarification text in Tamil/Tanglish if ambiguous' },
            suggestedAction: { type: Type.STRING, description: 'Summary action string' },
          },
          required: [
            'customerName',
            'place',
            'productVariant',
            'quality',
            'quantity',
            'discount',
            'paymentAmount',
            'paymentStatus',
            'rawTranscript',
            'needsClarification',
          ],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedJson });
  } catch (err: any) {
    console.error('NLU Parsing error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to parse voice/text note with Gemini AI',
    });
  }
});

// Telegram Bot Webhook / Simulator Endpoint
app.post('/api/telegram/message', async (req, res) => {
  try {
    const { text, sender } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are the Telegram Bot for KFOS (Kashmeer Fragrances Operating System).
A field salesperson sent this message: "${text}".
Acknowledge politely in Tamil/English, explain what action was extracted, or confirm order entry.
Keep response concise and formatted like a Telegram bot message with emojis.`,
    });

    return res.json({
      success: true,
      botReply: response.text,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Telegram API error:', err);
    return res.status(500).json({ success: false, error: 'Telegram bot processing error' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KFOS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
