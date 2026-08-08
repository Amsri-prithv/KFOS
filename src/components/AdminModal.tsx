import React, { useState } from 'react';
import { Lock, Unlock, Key, ShieldCheck, X, RefreshCw } from 'lucide-react';

interface AdminModalProps {
  isAdminUnlocked: boolean;
  onUnlockSuccess: () => void;
  onLock: () => void;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isAdminUnlocked,
  onUnlockSuccess,
  onLock,
  onClose,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('kfos_token', data.token);
        if (data.user?.role) {
          localStorage.setItem('kfos_role', data.user.role);
        }
        onUnlockSuccess();
        setPinInput('');
        setErrorMsg('');
      } else {
        setErrorMsg(data.error || 'Incorrect Admin Password / PIN. Access Denied.');
      }
    } catch (err: any) {
      setErrorMsg('Authentication error. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            {isAdminUnlocked ? (
              <Unlock className="w-5 h-5 text-emerald-400" />
            ) : (
              <Lock className="w-5 h-5 text-amber-400" />
            )}
            <h3 className="text-base font-bold text-zinc-100">
              {isAdminUnlocked ? 'Admin Panel Unlocked' : 'Administrator Authentication'}
            </h3>
          </div>

          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAdminUnlocked ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Admin Session Privileges Active
              </div>
              <p className="text-emerald-400/80">
                You can soft-delete orders, archive customer records, and modify master pricing matrix configurations.
              </p>
            </div>

            <button
              onClick={onLock}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl transition-all"
            >
              Lock Admin Session
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            <p className="text-xs text-zinc-400">
              Enter Admin Password or PIN (6124) to unlock administrative privileges.
            </p>

            <div>
              <label className="text-xs font-medium text-zinc-400">Admin PIN / Password</label>
              <div className="relative mt-1">
                <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN (6124)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {errorMsg && <p className="text-xs font-semibold text-red-400">{errorMsg}</p>}

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/40 transition-all"
            >
              Unlock Privileges
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
