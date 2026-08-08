import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Bot,
  Users,
  Package,
  Droplets,
  Gift,
  Clock,
  IndianRupee,
  Cpu,
  Settings,
  ShoppingBag,
  Target,
  Receipt,
  LifeBuoy,
  CheckSquare,
  Bell,
  Megaphone,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { KpiDashboard } from './components/KpiDashboard';
import { TelegramBotSimulator } from './components/TelegramBotSimulator';
import { CustomerDirectory } from './components/CustomerDirectory';
import { OrderManager } from './components/OrderManager';
import { InventoryPoolManager } from './components/InventoryPoolManager';
import { SamplesTracker } from './components/SamplesTracker';
import { TimelineAuditFeed } from './components/TimelineAuditFeed';
import { FinanceLedger } from './components/FinanceLedger';
import { AIAgentsHub } from './components/AIAgentsHub';
import { SystemSettings } from './components/SystemSettings';
import { ProductsCatalog } from './components/ProductsCatalog';
import { LeadsManager } from './components/LeadsManager';
import { ExpensesManager } from './components/ExpensesManager';
import { SupportTicketsManager } from './components/SupportTicketsManager';
import { TasksManager } from './components/TasksManager';
import { NotificationsManager } from './components/NotificationsManager';
import { CampaignsManager } from './components/CampaignsManager';
import { PlannerModal } from './components/PlannerModal';
import { AdminModal } from './components/AdminModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { kfosStore } from './services/kfosStore';

type ActiveTab =
  | 'overview'
  | 'telegram'
  | 'customers'
  | 'orders'
  | 'inventory'
  | 'products'
  | 'leads'
  | 'expenses'
  | 'finance'
  | 'tickets'
  | 'tasks'
  | 'notifications'
  | 'campaigns'
  | 'samples'
  | 'agents'
  | 'settings'
  | 'timeline';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  // Store subscription state
  const [customers, setCustomers] = useState(kfosStore.getCustomers());
  const [orders, setOrders] = useState(kfosStore.getOrders());

  useEffect(() => {
    // 1. Verify active session on start
    kfosStore.fetchWithAuth('/api/auth/verify')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated) {
          setIsAdminUnlocked(true);
          if (data.user?.role) {
            localStorage.setItem('kfos_role', data.user.role);
          }
        } else {
          setIsAdminUnlocked(false);
          localStorage.removeItem('kfos_role');
        }
      })
      .catch(() => {
        setIsAdminUnlocked(false);
        localStorage.removeItem('kfos_role');
      });

    // 2. Subscribe to kfosStore changes
    const unsubscribe = kfosStore.subscribe(() => {
      setCustomers(kfosStore.getCustomers());
      setOrders(kfosStore.getOrders());
    });

    // 3. Listen for global unauthorized events
    const handleUnauthorized = () => {
      setIsAdminUnlocked(false);
      localStorage.removeItem('kfos_role');
    };
    window.addEventListener('kfos-unauthorized', handleUnauthorized);

    return () => {
      unsubscribe();
      window.removeEventListener('kfos-unauthorized', handleUnauthorized);
    };
  }, []);

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-neutral-950 flex flex-col">
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
      <div className="bg-neutral-900/90 border-b border-neutral-800/80 px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>KPI Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'telegram'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Voice & Telegram Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customer Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Sales Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Shared Liquid Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Products Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'leads'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Leads CRM</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Expenses</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'finance'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Finance & Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'tickets'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support Tickets</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'campaigns'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Campaigns</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'samples'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Samples Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'agents'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Agents Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>System Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
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

        {activeTab === 'products' && <ProductsCatalog />}

        {activeTab === 'leads' && <LeadsManager />}

        {activeTab === 'expenses' && <ExpensesManager userRole={isAdminUnlocked ? 'Founder' : 'Sales'} />}

        {activeTab === 'tickets' && <SupportTicketsManager userRole={isAdminUnlocked ? 'Founder' : 'Support'} />}

        {activeTab === 'tasks' && <TasksManager userRole={isAdminUnlocked ? 'Founder' : 'Operations'} />}

        {activeTab === 'notifications' && <NotificationsManager />}

        {activeTab === 'campaigns' && <CampaignsManager />}

        {activeTab === 'samples' && <SamplesTracker />}

        {activeTab === 'finance' && (
          <FinanceLedger
            customers={customers}
            orders={orders}
            onPaymentRecorded={() => {
              setCustomers(kfosStore.getCustomers());
              setOrders(kfosStore.getOrders());
            }}
          />
        )}

        {activeTab === 'agents' && <AIAgentsHub />}

        {activeTab === 'settings' && <SystemSettings />}

        {activeTab === 'timeline' && <TimelineAuditFeed />}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-4 text-center text-xs text-neutral-500 font-mono">
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
