import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Plus,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { LiquidStockPool, QualityGrade, PRICING_MATRIX } from '../types/kfos';

export const InventoryPoolManager: React.FC = () => {
  const [stocks, setStocks] = useState<LiquidStockPool[]>(kfosStore.getLiquidStocks());
  const [selectedQualityForRestock, setSelectedQualityForRestock] = useState<QualityGrade | null>(null);
  const [addCans, setAddCans] = useState<number>(50);

  const refresh = () => setStocks([...kfosStore.getLiquidStocks()]);

  useEffect(() => {
    refresh();
    return kfosStore.subscribe(refresh);
  }, []);

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQualityForRestock || addCans <= 0) return;

    const res = kfosStore.restockLiquidPool(selectedQualityForRestock, addCans);
    alert(res.message);
    setSelectedQualityForRestock(null);
    setAddCans(50);
  };

  return (
    <div className="space-y-6">
      {/* Rule Notice Callout Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <h3 className="font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            Shared Liquid Inventory Pool Rule Enforced
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            Room Fresheners and Bathroom Fresheners are chemically identical and draw from the exact same raw liquid stock
            pool for each quality grade (Eco, Standard, Premium). Selling either 5L product automatically deducts from the
            corresponding shared physical stock pool.
          </p>
        </div>
      </div>

      {/* Shared Stock Pool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stocks.map((pool) => {
          const pricing = PRICING_MATRIX[pool.quality];
          const isLow = pool.currentStock5L <= pool.lowStockThreshold;
          const percentage = Math.min(100, Math.round((pool.currentStock5L / 150) * 100));

          return (
            <div
              key={pool.quality}
              className={`p-6 rounded-2xl bg-zinc-900/90 border transition-all flex flex-col justify-between space-y-5 ${
                isLow ? 'border-amber-500/50 shadow-lg shadow-amber-950/20' : 'border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Shared Liquid Pool</span>
                    <h3 className="text-xl font-extrabold text-zinc-100">{pool.quality} Grade</h3>
                  </div>

                  {isLow ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Low Stock
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Healthy
                    </span>
                  )}
                </div>

                {/* Meter Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">Physical Stock:</span>
                    <span className="font-bold text-zinc-100">{pool.currentStock5L} / 150 Cans</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Shared Product Variants List */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                    Shared By Products:
                  </span>
                  <div className="flex items-center justify-between font-medium text-zinc-300">
                    <span>1. Room Freshener (5L)</span>
                    <span className="font-mono text-emerald-400">₹{pricing.salePrice}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-zinc-300">
                    <span>2. Bathroom Freshener (5L)</span>
                    <span className="font-mono text-emerald-400">₹{pricing.salePrice}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400">
                  Last Restock: {new Date(pool.lastRestockedAt).toLocaleDateString('en-IN')}
                </span>

                <button
                  onClick={() => setSelectedQualityForRestock(pool.quality)}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Restock
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Restock Modal */}
      {selectedQualityForRestock && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-emerald-400" />
              Restock {selectedQualityForRestock} Liquid Pool
            </h3>

            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400">Number of 5L Cans to Add</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={addCans}
                  onChange={(e) => setAddCans(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1 font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Add Stock to Pool
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedQualityForRestock(null)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
