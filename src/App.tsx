import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Bot,
  Users,
  Package,
  Droplets,
  Gift,
  Clock,
  Search,
  Lock,
  Unlock,
  Sun,
  Moon,
  Mic,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { KpiDashboard } from './components/KpiDashboard';
import { TelegramBotSimulator } from './components/TelegramBotSimulator';
import { CustomerDirectory } from './components/CustomerDirectory';
import { OrderManager } from './components/OrderManager';
import { InventoryPoolManager } from './components/InventoryPoolManager';
import { SamplesTracker } from './components/SamplesTracker';
import { TimelineAuditFeed } from './components/TimelineAuditFeed';
import { PlannerModal } from './components/PlannerModal';
import { AdminModal } from './components/AdminModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';

type ActiveTab =
  | 'overview'
  | 'telegram'
  | 'customers'
  | 'orders'
  | 'inventory'
  | 'samples'
  | 'timeline';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  // Modals state
  const [showTelegramBotModal, setShowTelegramBotModal] = useState<boolean>(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [plannerModalType, setPlannerModalType] = useState<'morning' | 'night' | null>(null);

  // Keyboard shortcut Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-zinc-950 flex flex-col">
      {/* Navbar Header */}
      <Navbar
        onOpenVoiceAssistant={() => setActiveTab('telegram')}
        onOpenTelegramBot={() => setShowTelegramBotModal(true)}
        onOpenGlobalSearch={() => setShowGlobalSearch(true)}
        onOpenAdminModal={() => setShowAdminModal(true)}
        onOpenPlannerModal={(type) => setPlannerModalType(type)}
        isAdminUnlocked={isAdminUnlocked}
      />

      {/* Primary Navigation Tabs Bar */}
      <div className="bg-zinc-900/90 border-b border-zinc-800/80 px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>KPI Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'telegram'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Voice & Telegram Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Sales Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>Shared Liquid Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'samples'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Samples & 3-Day Followup</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Audit Timeline</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <KpiDashboard
            onOpenVoiceAssistant={() => setActiveTab('telegram')}
            onSelectCustomer={() => setActiveTab('customers')}
          />
        )}

        {activeTab === 'telegram' && (
          <div className="py-4">
            <TelegramBotSimulator />
          </div>
        )}

        {activeTab === 'customers' && (
          <CustomerDirectory
            onSelectCustomer={() => {}}
            isAdminUnlocked={isAdminUnlocked}
          />
        )}

        {activeTab === 'orders' && <OrderManager isAdminUnlocked={isAdminUnlocked} />}

        {activeTab === 'inventory' && <InventoryPoolManager />}

        {activeTab === 'samples' && <SamplesTracker />}

        {activeTab === 'timeline' && <TimelineAuditFeed />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-4 text-center text-xs text-zinc-500 font-mono">
        KFOS (Kashmeer Fragrances Operating System) • Field Sales Voice Automation & Shared Stock Management
      </footer>

      {/* Modal Overlay Windows */}
      {showTelegramBotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <TelegramBotSimulator onClose={() => setShowTelegramBotModal(false)} />
          </div>
        </div>
      )}

      {showGlobalSearch && (
        <GlobalSearchModal
          onClose={() => setShowGlobalSearch(false)}
          onSelectCustomer={() => setActiveTab('customers')}
        />
      )}

      {showAdminModal && (
        <AdminModal
          isAdminUnlocked={isAdminUnlocked}
          onUnlockSuccess={() => setIsAdminUnlocked(true)}
          onLock={() => setIsAdminUnlocked(false)}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {plannerModalType && (
        <PlannerModal type={plannerModalType} onClose={() => setPlannerModalType(null)} />
      )}
    </div>
  );
}
