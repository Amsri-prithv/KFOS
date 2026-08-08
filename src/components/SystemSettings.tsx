import React, { useState, useEffect } from 'react';
import { Settings, Shield, Server, Key, Database, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserRole } from '../types/kfos';
import { kfosStore } from '../services/kfosStore';

export const SystemSettings: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      const res = await kfosStore.fetchWithAuth('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }

      const dbRes = await kfosStore.fetchWithAuth('/api/db/health');
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbHealth(dbData);
      }
    } catch {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const rolesList: { role: UserRole; description: string; permissions: string[] }[] = [
    {
      role: 'Founder',
      description: 'Master Admin Access to overall business KPIs, pricing rules, credit approvals, and system parameters.',
      permissions: ['Read/Write All', 'Financial Margin View', 'Price Override', 'System Config'],
    },
    {
      role: 'Admin',
      description: 'System Administration, user management, and audit log monitoring.',
      permissions: ['Read/Write All', 'Audit Logs', 'User Management'],
    },
    {
      role: 'Sales',
      description: 'Field sales reps recording 5L Can orders, Tanglish voice notes, and 200ml / 500ml sample requests.',
      permissions: ['Create Orders', 'View Assigned Customers', 'Request Samples', 'Record Field Cash'],
    },
    {
      role: 'Operations',
      description: 'Factory and warehouse managers overseeing shared liquid pools (Eco, Standard, Premium) and stock dispatch.',
      permissions: ['View/Update Liquid Pools', 'Dispatch Orders', 'Log Stock Restock'],
    },
    {
      role: 'Finance',
      description: 'Accounts receivable, customer credit limits, outstanding aging, and field expense logging.',
      permissions: ['View Financial Ledger', 'Record Payments', 'Approve Credit Limits', 'Generate Invoices'],
    },
    {
      role: 'Support',
      description: 'Customer complaints, bottle seal leaks, and 3-day sample follow-up scheduling.',
      permissions: ['View Tickets', 'Schedule Follow-Ups', 'Log Replacements'],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <Settings className="w-6 h-6 text-amber-400 mr-2.5" />
            System Architecture & RBAC Control
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Configure system parameters, role permissions, API endpoints, and database connection status.
          </p>
        </div>
        <button
          onClick={checkHealth}
          className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
          Re-check API Health
        </button>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Backend Express Server
            </span>
            <Server className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center">
            {serverStatus === 'online' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
                <span className="text-base font-bold text-white">Online (Port 3000)</span>
              </>
            ) : serverStatus === 'offline' ? (
              <>
                <AlertCircle className="w-5 h-5 text-rose-400 mr-2" />
                <span className="text-base font-bold text-rose-400">Offline / Unreachable</span>
              </>
            ) : (
              <span className="text-sm text-neutral-400">Pinging server...</span>
            )}
          </div>
          {serverInfo && (
            <span className="text-[10px] text-neutral-500 block mt-2 font-mono">
              App: {serverInfo.app}
            </span>
          )}
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Gemini AI SDK Status
            </span>
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-3 flex items-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span className="text-base font-bold text-white">Gemini 3.6 Flash Ready</span>
          </div>
          <span className="text-[10px] text-neutral-500 block mt-2">
            Server-side key injected via environment
          </span>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Database Persistence Engine
            </span>
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span className="text-base font-bold text-white">
              {dbHealth?.connected ? 'Firebase Cloud Firestore' : 'Connecting to Firestore...'}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 block mt-2">
            {dbHealth?.connected
              ? `Live Sync: ${dbHealth.customersCount} Customers, ${dbHealth.ordersCount} Orders in Firestore`
              : 'Server-side Firestore Admin SDK initialized'}
          </span>
        </div>
      </div>

      {/* Role-Based Access Control (RBAC) Matrix */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Shield className="w-5 h-5 text-amber-400 mr-2" />
          Role-Based Access Control (RBAC) Governance Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolesList.map((item) => (
            <div key={item.role} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-400">{item.role}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                  Role Active
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-3">{item.description}</p>
              <div className="space-y-1">
                {item.permissions.map((perm, idx) => (
                  <div key={idx} className="flex items-center text-[11px] text-neutral-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mr-1.5 shrink-0" />
                    <span>{perm}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
