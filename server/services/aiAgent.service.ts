import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

export type AIAgentRole =
  | 'CEO Agent'
  | 'Sales Agent'
  | 'Marketing Agent'
  | 'Support Agent'
  | 'Inventory Agent'
  | 'Finance Agent';

export interface AgentTaskRequest {
  agentRole: AIAgentRole;
  taskPrompt: string;
  contextData?: any;
}

export const executeAgentTask = async ({
  agentRole,
  taskPrompt,
  contextData,
}: AgentTaskRequest) => {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const roleInstructions: Record<AIAgentRole, string> = {
    'CEO Agent':
      'You are the Founder & CEO Strategic AI Advisor for Kashmeer Fragrances. Analyze company financial KPIs, cash flow, outstanding credit, and field expansion strategy in Tamil Nadu.',
    'Sales Agent':
      'You are the Field Sales Operations AI. Focus on order conversion, absolute discount control, customer repeat purchases, and follow-ups in Trichy, Madurai, Salem, etc.',
    'Marketing Agent':
      'You are the Marketing Campaign AI. Plan sample distributions, promotional campaigns, and B2B fragrance trial strategy.',
    'Support Agent':
      'You are the B2B Customer Support AI. Manage customer complaints, fragrance batch replacements, seal leaks, and SLA resolution.',
    'Inventory Agent':
      'You are the Liquid Stock Pool AI. Monitor 5L Can inventory levels across Eco, Standard, and Premium grades, low stock thresholds, and raw chemical restocking.',
    'Finance Agent':
      'You are the Financial Controller AI. Manage accounts receivable, profit margins, expense logs, and credit limits.',
  };

  const systemInstruction = roleInstructions[agentRole] || roleInstructions['CEO Agent'];

  const prompt = `
[Agent Role: ${agentRole}]
Task: ${taskPrompt}
${contextData ? `Context Data: ${JSON.stringify(contextData, null, 2)}` : ''}

Provide a structured, action-oriented response with clear business recommendations and execution steps.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  return {
    agentRole,
    executedAt: new Date().toISOString(),
    response: response.text || 'Agent completed task.',
  };
};
