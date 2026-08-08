import React, { useState } from 'react';
import { Sun, Moon, Copy, Check, X, Send, Calendar } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';

interface PlannerModalProps {
  type: 'morning' | 'night';
  onClose: () => void;
}

export const PlannerModal: React.FC<PlannerModalProps> = ({ type, onClose }) => {
  const [copied, setCopied] = useState(false);
  const kpis = kfosStore.getFinancialKPIs();
  const stocks = kfosStore.getLiquidStocks();
  const customers = kfosStore.getCustomers();

  const isMorning = type === 'morning';

  // Generate WhatsApp / Telegram Formatted Text
  const generateFormattedSummary = () => {
    const todayStr = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (isMorning) {
      const lowStocks = stocks.filter((s) => s.currentStock5L <= s.lowStockThreshold);
      const pendingFollows = kfosStore.getSamples().filter((s) => s.followUpStatus === 'Pending');

      return `🌅 *KASHMEER FRAGRANCES - MORNING FIELD PLAN*
📅 Date: ${todayStr} (09:00 AM IST)

⚠️ *LIQUID STOCK POOL ALERT:*
${lowStocks.length > 0 ? lowStocks.map((s) => `• ${s.quality} Pool: ${s.currentStock5L} Cans remaining!`).join('\n') : '• All Liquid Stock Pools healthy (>30 Cans).'}

🔔 *PLANNED 3-DAY SAMPLE FOLLOW-UPS TODAY:*
${pendingFollows.length > 0 ? pendingFollows.map((sf) => `• ${sf.customerName}: Check ${sf.sampleType} sample trial feedback`).join('\n') : '• No sample follow-ups due today.'}

📋 *KEY FIELD ACCOUNTS TO VISIT:*
${customers.slice(0, 4).map((c) => `• ${c.name} (${c.place}) - Outstanding: ₹${c.outstandingBalance}`).join('\n')}

Good luck with field sales today! 🚀`;
    } else {
      return `🌙 *KASHMEER FRAGRANCES - NIGHT EOD OPERATIONAL SUMMARY*
📅 Date: ${todayStr} (08:30 PM IST)

📊 *TODAY'S FINANCIAL SUMMARY:*
• Net Realized Profit: ₹${kpis.todayProfit.toLocaleString('en-IN')}
• Total Revenue: ₹${kpis.todayRevenue.toLocaleString('en-IN')}
• Orders Processed: ${kpis.todayOrdersCount} orders

💰 *FIELD ACCOUNTS STATUS:*
• Total Outstanding Credit: ₹${kpis.totalOutstanding.toLocaleString('en-IN')}
• Active Customer Accounts: ${kpis.totalCustomers}

💧 *SHARED LIQUID POOL LEVELS:*
${stocks.map((s) => `• ${s.quality} Grade Pool: ${s.currentStock5L} Cans`).join('\n')}

EOD Report Verified & Recorded in KFOS. Good night! 😴`;
    }
  };

  const textSummary = generateFormattedSummary();

  const handleCopy = () => {
    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            {isMorning ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-400" />
            )}
            <h3 className="text-base font-bold text-zinc-100">
              {isMorning ? '09:00 AM Morning Visit Plan' : '08:30 PM Night EOD Summary'}
            </h3>
          </div>

          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-line max-h-80 overflow-y-auto">
          {textSummary}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Formatted Text for Telegram/WhatsApp'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
