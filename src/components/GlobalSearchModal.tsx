import React, { useState } from 'react';
import { Search, X, Users, Package, Gift, Clock, ChevronRight } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';

interface GlobalSearchModalProps {
  onClose: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  onClose,
  onSelectCustomer,
}) => {
  const [query, setQuery] = useState('');
  const results = kfosStore.globalSearch(query);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Search Header Input */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950">
          <Search className="w-5 h-5 text-emerald-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type store name, location (Trichy, Madurai...), order #, or item..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1">
          {!query.trim() && (
            <div className="text-center py-12 text-zinc-500 text-xs">
              Type to search across Customers, Orders, Liquid Stock Pools, and Field Audit Trails...
            </div>
          )}

          {/* Customers Match */}
          {results.customers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                Customers ({results.customers.length})
              </h4>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCustomer(c.id);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-100">{c.name}</div>
                      <div className="text-[11px] text-zinc-400">{c.place} • {c.phone}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders Match */}
          {results.orders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-teal-400" />
                Orders ({results.orders.length})
              </h4>
              <div className="space-y-1">
                {results.orders.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between font-mono text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-200">{o.orderNumber}</span>
                      <span className="text-[11px] text-zinc-400 block font-sans">
                        {o.customerName} ({o.customerPlace})
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-100">₹{o.totalAmount.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-emerald-400">+₹{o.totalProfit} profit</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Samples Match */}
          {results.samples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-400" />
                Samples ({results.samples.length})
              </h4>
              <div className="space-y-1">
                {results.samples.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-200">{s.customerName}</span>
                      <span className="text-[11px] text-zinc-400 block">
                        {s.quantity}x {s.sampleType} Premium ({s.isFree ? 'FREE' : '₹' + s.chargeAmount})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[10px]">
                      Follow-up: {s.followUpStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
