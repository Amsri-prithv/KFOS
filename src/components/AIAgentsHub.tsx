import React, { useState } from 'react';
import { Bot, Play, Sparkles, ShieldCheck, Terminal, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AIAgent } from '../types/kfos';

export const AIAgentsHub: React.FC = () => {
  const [agents, setAgents] = useState<AIAgent[]>([
    {
      id: 'agent_ceo',
      name: 'Founder / CEO Strategy Agent',
      role: 'CEO Agent',
      description: 'Analyzes macro sales metrics, credit risks, margin trends, and Tamil Nadu territory performance.',
      status: 'Active',
      allowedTools: ['KPI Aggregator', 'Cashflow Predictor', 'Credit Risk Scorer'],
    },
    {
      id: 'agent_sales',
      name: 'Field Sales & Conversion Agent',
      role: 'Sales Agent',
      description: 'Monitors rep daily routes, customer reorder cycles, and discount thresholds in Trichy/Madurai.',
      status: 'Active',
      allowedTools: ['Tanglish NLU Parser', 'Discount Policy Guard', 'Customer CRM Search'],
    },
    {
      id: 'agent_inventory',
      name: 'Shared Liquid Stock Pool Agent',
      role: 'Inventory Agent',
      description: 'Enforces equal physical stock deduction for 5L Cans and alerts on raw essence chemical reorder levels.',
      status: 'Active',
      allowedTools: ['Stock Meter Monitor', 'Can Reorder Trigger'],
    },
    {
      id: 'agent_support',
      name: 'Customer Support & Sample Agent',
      role: 'Support Agent',
      description: 'Enforces max 2 free 200ml lifetime sample limit and tracks 3-day follow-up conversion SLAs.',
      status: 'Active',
      allowedTools: ['Sample Scheduler', 'Follow-Up Dispatcher'],
    },
  ]);

  const [selectedAgent, setSelectedAgent] = useState<AIAgent>(agents[0]);
  const [taskPrompt, setTaskPrompt] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);

  const handleRunTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;

    setIsExecuting(true);
    setExecutionOutput(null);

    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentRole: selectedAgent.role,
          taskPrompt,
        }),
      });

      const json = await response.json();
      if (json.success) {
        setExecutionOutput(json.data.response);
      } else {
        setExecutionOutput(`Agent Error: ${json.error}`);
      }
    } catch (err: any) {
      setExecutionOutput(`Connection Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Agents Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <Bot className="w-6 h-6 text-amber-400 mr-2.5" />
            KFOS AI Agent Orchestration Hub
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Controlled multi-agent system powered by Gemini 3.6 Flash. Operates under strict role-based tool restrictions.
          </p>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full flex items-center">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          4 Agents Active
        </span>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedAgent.id === agent.id
                ? 'bg-neutral-800 border-amber-500/50 shadow-amber-500/10 shadow-lg'
                : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {agent.role}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">{agent.name}</h3>
            <p className="text-xs text-neutral-400 line-clamp-2">{agent.description}</p>
            <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-500">
              <span>{agent.allowedTools.length} Tools Restricted</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Agent Terminal */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-white">
              Agent Terminal: <span className="text-amber-400">{selectedAgent.name}</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-neutral-500" />
            <span className="text-xs text-neutral-400">Model: Gemini 2.5 Flash</span>
          </div>
        </div>

        <form onSubmit={handleRunTask} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Task Prompt for {selectedAgent.role}
            </label>
            <textarea
              rows={3}
              required
              placeholder={`Enter instructions for ${selectedAgent.name}... (e.g. "Analyze Trichy sales conversion vs Madurai or generate 3-day sample follow-up strategy")`}
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isExecuting}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-800 text-neutral-950 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center"
          >
            {isExecuting ? (
              <>
                <Cpu className="w-4 h-4 mr-2 animate-spin text-neutral-950" />
                Executing Agent Task...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 fill-neutral-950" />
                Dispatch Task to Agent
              </>
            )}
          </button>
        </form>

        {/* Output Console */}
        {executionOutput && (
          <div className="mt-6 p-4 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-xs text-neutral-300 space-y-2">
            <div className="flex items-center justify-between text-neutral-500 border-b border-neutral-800 pb-2">
              <span className="flex items-center text-amber-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Agent Output Received
              </span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{executionOutput}</div>
          </div>
        )}
      </div>
    </div>
  );
};
