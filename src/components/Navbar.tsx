import React, { useState, useEffect } from 'react';
import {
  Mic,
  Bot,
  Search,
  Lock,
  Unlock,
  Sun,
  Moon,
  Calendar,
  AlertTriangle,
  Droplet,
  Sparkles,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';

interface NavbarProps {
  onOpenVoiceAssistant: () => void;
  onOpenTelegramBot: () => void;
  onOpenGlobalSearch: () => void;
  onOpenAdminModal: () => void;
  onOpenPlannerModal: (type: 'morning' | 'night') => void;
  isAdminUnlocked: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenVoiceAssistant,
  onOpenTelegramBot,
  onOpenGlobalSearch,
  onOpenAdminModal,
  onOpenPlannerModal,
  isAdminUnlocked,
}) => {
  const [istTime, setIstTime] = useState<string>('');
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format time in Asia/Kolkata (IST)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setIstTime(new Intl.DateTimeFormat('en-IN', options).format(now));
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);

    const updateStockAlerts = () => {
      const stocks = kfosStore.getLiquidStocks();
      const low = stocks.filter((s) => s.currentStock5L <= s.lowStockThreshold).length;
      setLowStockCount(low);
    };

    updateStockAlerts();
    const unsubscribe = kfosStore.subscribe(updateStockAlerts);

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Droplet className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-wider text-zinc-100 flex items-center gap-1.5">
                KFOS
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                  v2.6 Voice
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-medium hidden sm:block">
              Kashmeer Fragrances Operating System
            </p>
          </div>
        </div>

        {/* Global Search Bar Trigger */}
        <button
          onClick={onOpenGlobalSearch}
          className="hidden md:flex items-center gap-3 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-sm transition-all shadow-inner w-64 justify-between"
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-500" />
            <span>Search all modules...</span>
          </span>
          <kbd className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-700 text-[10px] text-zinc-400 rounded font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Live IST Time & Action Buttons */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* IST Time Badge */}
          <div className="hidden lg:flex flex-col items-end pr-2 border-r border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              IST (Asia/Kolkata)
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-200">{istTime}</span>
          </div>

          {/* Low Stock Warning Pill */}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lowStockCount} Low Stock</span>
            </div>
          )}

          {/* Morning / Night Planner */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => onOpenPlannerModal('morning')}
              className="px-2.5 py-1 text-xs text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-1"
              title="09:00 AM Morning Visit Planning"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">09:00 AM</span>
            </button>
            <button
              onClick={() => onOpenPlannerModal('night')}
              className="px-2.5 py-1 text-xs text-zinc-300 hover:text-indigo-400 hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-1"
              title="08:30 PM Night EOD Summary"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">08:30 PM</span>
            </button>
          </div>

          {/* Quick Voice Note Input Button */}
          <button
            onClick={onOpenVoiceAssistant}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Mic className="w-4 h-4 animate-bounce" />
            <span className="hidden md:inline">Voice Note</span>
          </button>

          {/* Telegram Bot Simulator Toggle */}
          <button
            onClick={onOpenTelegramBot}
            className="p-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
            title="Open Telegram Bot Simulator"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Bot Simulator</span>
          </button>

          {/* Admin PIN Lock Status Button */}
          <button
            onClick={onOpenAdminModal}
            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
              isAdminUnlocked
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title={isAdminUnlocked ? 'Admin Unlocked (PIN 6124)' : 'Admin Locked (Click to enter PIN 6124)'}
          >
            {isAdminUnlocked ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
