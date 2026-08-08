import { Request, Response } from 'express';
import { executeAgentTask, AIAgentRole } from '../services/aiAgent.service.js';

export const handleAgentExecution = async (req: Request, res: Response) => {
  try {
    const { agentRole, taskPrompt, contextData } = req.body;
    if (!agentRole || !taskPrompt) {
      return res.status(400).json({ error: 'agentRole and taskPrompt are required' });
    }

    const result = await executeAgentTask({
      agentRole: agentRole as AIAgentRole,
      taskPrompt,
      contextData,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Agent Execution API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Agent execution failed' });
  }
};
