import React, { useState, useEffect } from 'react';
import {
  Gift,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Plus,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { SampleDistribution, Customer } from '../types/kfos';

export const SamplesTracker: React.FC = () => {
  const [samples, setSamples] = useState<SampleDistribution[]>(kfosStore.getSamples());
  const [customers, setCustomers] = useState<Customer[]>(kfosStore.getCustomers());
  const [searchQuery, setSearchQuery] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [sampleType, setSampleType] = useState<'200ml' | '500ml'>('200ml');
  const [sampleCount, setSampleCount] = useState(1);

  const refresh = () => {
    setSamples([...kfosStore.getSamples()]);
    setCustomers([...kfosStore.getCustomers()]);
  };

  useEffect(() => {
    refresh();
    return kfosStore.subscribe(refresh);
  }, []);

  const handleIssueSample = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const res = kfosStore.distributeSample(selectedCustomerId, sampleType, sampleCount);
    if (res.success) {
      alert(res.message);
      setShowIssueModal(false);
      setSelectedCustomerId('');
      setSampleCount(1);
    } else {
      alert(res.message);
    }
  };

  const handleCompleteFollowUp = (sampleId: string) => {
    const notes = prompt('Enter follow-up outcome notes (optional):', 'Customer trial feedback positive.');
    if (notes !== null) {
      kfosStore.completeFollowUp(sampleId, notes);
    }
  };

  const filteredSamples = samples.filter(
    (s) =>
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sampleType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sample Rules Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 mt-0.5">
          <Gift className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <h3 className="font-bold text-zinc-100 uppercase tracking-wider">
            Sample Distribution & 3-Day Follow-Up Rules
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            • Only <strong>Premium Quality</strong> samples are distributed.<br />
            • Lifetime free limit: <strong>Max 2 x 200ml free samples</strong> per customer.<br />
            • Extra 200ml samples are charged at ₹200. Any 500ml samples are charged at ₹300.<br />
            • <strong>Sample Profit Mandate:</strong> Sample sales (free and paid) generate <strong>exactly ₹0 profit</strong>.<br />
            • Every sample distribution automatically schedules a follow-up reminder after <strong>exactly 3 days</strong>.
          </p>
        </div>
      </div>

      {/* Search & Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sample recipient or size..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={() => setShowIssueModal(true)}
          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Issue Sample Bottle
        </button>
      </div>

      {/* Samples Table */}
      <div className="overflow-x-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Sample Bottle</th>
              <th className="py-3.5 px-4">Cost / Charge</th>
              <th className="py-3.5 px-4">Realized Profit</th>
              <th className="py-3.5 px-4">3-Day Follow-Up Due</th>
              <th className="py-3.5 px-4">Follow-Up Status</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {filteredSamples.map((s) => {
              const due = new Date(s.followUpDueDate);
              const now = new Date();
              const isOverdue = s.followUpStatus === 'Pending' && due < now;

              return (
                <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-100 font-sans">{s.customerName}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] font-sans">
                      {s.quantity}x {s.sampleType} Premium
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold">
                    {s.isFree ? (
                      <span className="text-emerald-400 font-sans font-bold">FREE (Limit 2/2)</span>
                    ) : (
                      `₹${s.chargeAmount}`
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-zinc-400">₹0 (Rule Enforced)</td>
                  <td className="py-3.5 px-4 font-sans text-zinc-300">
                    {due.toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    {s.followUpStatus === 'Completed' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    ) : isOverdue ? (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-fit animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        Overdue!
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />
                        Pending (3 Days)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    {s.followUpStatus === 'Pending' && (
                      <button
                        onClick={() => handleCompleteFollowUp(s.id)}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-semibold"
                      >
                        Mark Follow-Up Done
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Issue Sample Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              Distribute Premium Sample Bottle
            </h3>

            <form onSubmit={handleIssueSample} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Select Customer</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                >
                  <option value="">-- Choose Field Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.place}) - Free Used: {c.free200mlSamplesUsed}/2
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Bottle Size</label>
                  <select
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value as '200ml' | '500ml')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                  >
                    <option value="200ml">200ml Premium</option>
                    <option value="500ml">500ml Premium</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={sampleCount}
                    onChange={(e) => setSampleCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-zinc-400 font-mono">
                  <span>Mandatory Sample Profit:</span>
                  <span className="font-bold text-emerald-400">₹0 (Fixed Rule)</span>
                </div>
                <div className="flex justify-between text-zinc-400 font-mono">
                  <span>Auto Follow-Up Scheduled:</span>
                  <span>Exactly 3 Days (72 Hours)</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Issue Sample & Schedule Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
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
