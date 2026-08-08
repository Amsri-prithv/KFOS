import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  Package,
  Calendar,
  Mic,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Droplet,
  Percent,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { kfosStore } from '../services/kfosStore';
import { PRICING_MATRIX, QualityGrade } from '../types/kfos';

interface KpiDashboardProps {
  onOpenVoiceAssistant: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const KpiDashboard: React.FC<KpiDashboardProps> = ({
  onOpenVoiceAssistant,
  onSelectCustomer,
}) => {
  const [kpis, setKpis] = useState(kfosStore.getFinancialKPIs());
  const [recentOrders, setRecentOrders] = useState(kfosStore.getOrders().slice(0, 5));
  const [stocks, setStocks] = useState(kfosStore.getLiquidStocks());

  useEffect(() => {
    const update = () => {
      setKpis(kfosStore.getFinancialKPIs());
      setRecentOrders(kfosStore.getOrders().slice(0, 5));
      setStocks(kfosStore.getLiquidStocks());
    };
    update();
    return kfosStore.subscribe(update);
  }, []);

  // Real daily sales trend built from actual orders
  const allOrders = kfosStore.getOrders();
  const daysMap: Record<string, { revenue: number; profit: number }> = {};
  
  // Get past 7 days dates in Asia/Kolkata
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    daysMap[dateStr] = { revenue: 0, profit: 0 };
  }

  allOrders.forEach((o) => {
    if (o.isReturned) return;
    const dateStr = new Date(o.orderDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (daysMap[dateStr]) {
      daysMap[dateStr].revenue += o.totalAmount;
      daysMap[dateStr].profit += o.totalProfit;
    }
  });

  const chartData = Object.keys(daysMap).map((dateKey) => {
    const dayLabel = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short' });
    return {
      day: dayLabel,
      revenue: daysMap[dateKey].revenue,
      profit: daysMap[dateKey].profit,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Voice Callout */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/90 p-6 shadow-xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Field Voice Automation Active
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-zinc-100 tracking-tight">
              Kashmeer Fragrances Field Dashboard
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-xl">
              Automated 5L liquid inventory tracking, Tamil/English voice note parsing, and 3-day sample follow-up scheduling.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenVoiceAssistant}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2.5 transition-all active:scale-95"
            >
              <Mic className="w-5 h-5 animate-pulse text-zinc-950" />
              <span>Record Voice Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Profit */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Today's Net Profit
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              ₹{kpis.todayProfit.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">Realized profit</span> from {kpis.todayOrdersCount} orders today
            </p>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Total Revenue
            </span>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-100 font-mono tracking-tight">
              ₹{kpis.totalRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              Cumulative field sales volume
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Outstanding Credit
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              ₹{kpis.totalOutstanding.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              Due from field customer accounts
            </p>
          </div>
        </div>

        {/* Active Customers & Follow ups */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Follow-ups & Clients
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-zinc-100 font-mono tracking-tight">
                {kpis.totalCustomers}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Total active accounts</p>
            </div>
            <div className="text-right">
              <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                {kpis.pendingFollowUpsCount} 3-Day Reminders
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Matrix Reference Cards */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Droplet className="w-4 h-4 text-emerald-400" />
            Master 5L Can Pricing & Profit Matrix
          </h3>
          <span className="text-xs text-zinc-400 font-mono">Discounts reduce profit ₹ for ₹</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['Eco', 'Standard', 'Premium'] as QualityGrade[]).map((quality) => {
            const p = PRICING_MATRIX[quality];
            const stock = stocks.find((s) => s.quality === quality);
            return (
              <div
                key={quality}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-100">{quality} Quality</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Stock: {stock?.currentStock5L || 0} Cans
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center border-t border-zinc-800 pt-2">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Buy</span>
                    <p className="text-xs font-semibold text-zinc-300 font-mono">₹{p.buyPrice}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Sale</span>
                    <p className="text-xs font-semibold text-zinc-100 font-mono">₹{p.salePrice}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase">Base Profit</span>
                    <p className="text-xs font-bold text-emerald-400 font-mono">+₹{p.baseProfit}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics Charts & Recent Sales Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Revenue/Profit Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 tracking-wide">
                Sales Revenue & Realized Profit Trend
              </h3>
              <p className="text-xs text-zinc-400">Weekly performance summary in ₹ INR</p>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-zinc-800 rounded text-emerald-400 font-semibold">
              Live Realized Profit
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px' }}
                  labelStyle={{ color: '#f4f4f5' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" fillOpacity={1} fill="url(#colorRev)" name="Revenue (₹)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProf)" name="Profit (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Recent Orders Feed */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100 tracking-wide">Recent Field Transactions</h3>
            <span className="text-xs text-zinc-400">{recentOrders.length} latest</span>
          </div>

          <div className="space-y-3">
            {recentOrders.map((ord) => (
              <div
                key={ord.id}
                onClick={() => onSelectCustomer(ord.customerId)}
                className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">{ord.customerName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      {ord.customerPlace}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {ord.items[0]?.quantity}x {ord.items[0]?.quality} {ord.items[0]?.productVariant}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-zinc-100 font-mono">
                    ₹{ord.totalAmount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-medium text-emerald-400 font-mono">
                    +₹{ord.totalProfit.toLocaleString('en-IN')} profit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
