import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Gift,
  DollarSign,
  Calendar,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Archive,
  Droplets,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { Customer, Order, SampleDistribution } from '../types/kfos';

interface CustomerDirectoryProps {
  onSelectCustomer: (customerId: string) => void;
  isAdminUnlocked: boolean;
}

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({
  onSelectCustomer,
  isAdminUnlocked,
}) => {
  const [customers, setCustomers] = useState<Customer[]>(kfosStore.getCustomers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerSamples, setCustomerSamples] = useState<SampleDistribution[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPlace, setNewCustPlace] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const refresh = () => {
    setCustomers(kfosStore.getCustomers());
    if (selectedCustomer) {
      const updated = kfosStore.getCustomerById(selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      setCustomerOrders(kfosStore.getOrders().filter((o) => o.customerId === selectedCustomer.id));
      setCustomerSamples(kfosStore.getSamples().filter((s) => s.customerId === selectedCustomer.id));
    }
  };

  useEffect(() => {
    refresh();
    return kfosStore.subscribe(refresh);
  }, [selectedCustomer?.id]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPlace.trim()) return;

    kfosStore.findOrCreateCustomer(newCustName, newCustPlace, newCustPhone);
    setShowAddModal(false);
    setNewCustName('');
    setNewCustPlace('');
    setNewCustPhone('');
  };

  const handleIssueSample = (customerId: string, sampleType: '200ml' | '500ml') => {
    const res = kfosStore.distributeSample(customerId, sampleType, 1);
    if (res.success) {
      alert(res.message);
      refresh();
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, location, phone..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Field Customer
        </button>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const freeSamplesUsed = cust.free200mlSamplesUsed;
          const freeRemaining = Math.max(0, 2 - freeSamplesUsed);

          return (
            <div
              key={cust.id}
              className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{cust.name}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {cust.place}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {cust.phone}
                  </span>
                </div>

                {/* Lifetime Sample Allowance Badge */}
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Gift className="w-3 h-3 text-amber-400" />
                      Lifetime Free 200ml Samples:
                    </span>
                    <span className="font-mono font-bold text-zinc-200">
                      {freeSamplesUsed}/2 Used
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        freeSamplesUsed >= 2 ? 'bg-amber-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${(freeSamplesUsed / 2) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    {freeRemaining > 0
                      ? `Eligible for ${freeRemaining} more free sample(s)`
                      : 'Free limit reached. Additional samples are paid.'}
                  </p>
                </div>
              </div>

              {/* Financial Summary & Actions */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase">Outstanding</span>
                  <p
                    className={`font-bold ${
                      cust.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    ₹{cust.outstandingBalance.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIssueSample(cust.id, '200ml')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold border border-zinc-700"
                    title="Issue 200ml Sample (Follow-up auto scheduled after 3 days)"
                  >
                    +200ml Sample
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setCustomerOrders(kfosStore.getOrders().filter((o) => o.customerId === cust.id));
                      setCustomerSamples(kfosStore.getSamples().filter((s) => s.customerId === cust.id));
                    }}
                    className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-zinc-950 h-full border-l border-zinc-800 p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-100">{selectedCustomer.name}</h2>
                <p className="text-xs text-zinc-400">{selectedCustomer.place} • {selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Status & Record Payment */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Outstanding Balance:</span>
                <span className={`font-bold ${selectedCustomer.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ₹{selectedCustomer.outstandingBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <button
                onClick={async () => {
                  const amtStr = prompt(`Enter payment amount received for ${selectedCustomer.name}:`, '1000');
                  if (!amtStr) return;
                  const amt = parseFloat(amtStr);
                  if (isNaN(amt) || amt <= 0) return;
                  const targetOrd = customerOrders.find((o) => o.paymentStatus !== 'Paid')?.id || 'ord_direct';
                  await kfosStore.recordPayment(targetOrd, selectedCustomer.id, amt, 'UPI', 'Recorded from Customer Directory');
                  refresh();
                }}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" />
                Record Collection Payment
              </button>
            </div>

            {/* Quick Action Sample Buttons */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-400" />
                Issue Premium Sample (Auto 3-Day Follow-Up)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleIssueSample(selectedCustomer.id, '200ml')}
                  className="p-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left text-xs space-y-0.5"
                >
                  <div className="font-bold text-zinc-200">Issue 200ml Sample</div>
                  <div className="text-[10px] text-zinc-400">
                    {selectedCustomer.free200mlSamplesUsed < 2 ? 'Free (Limit 2/2)' : 'Paid ₹200 (₹0 Profit)'}
                  </div>
                </button>
                <button
                  onClick={() => handleIssueSample(selectedCustomer.id, '500ml')}
                  className="p-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left text-xs space-y-0.5"
                >
                  <div className="font-bold text-zinc-200">Issue 500ml Sample</div>
                  <div className="text-[10px] text-zinc-400">Paid ₹300 (₹0 Profit)</div>
                </button>
              </div>
            </div>

            {/* Order History */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Order History ({customerOrders.length})
              </h3>
              <div className="space-y-2">
                {customerOrders.map((ord) => (
                  <div key={ord.id} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-zinc-200">
                      <span>{ord.orderNumber}</span>
                      <span className="font-mono">₹{ord.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {ord.items[0]?.quantity}x {ord.items[0]?.quality} {ord.items[0]?.productVariant}
                    </p>
                    <div className="flex justify-between text-[10px] text-emerald-400 font-mono">
                      <span>Realized Profit: +₹{ord.totalProfit}</span>
                      <span className="text-zinc-400">{new Date(ord.orderDate).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-zinc-100">Add New Field Customer</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Customer / Store Name</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Trichy Fragrance Mart"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Location / City</label>
                <input
                  type="text"
                  required
                  value={newCustPlace}
                  onChange={(e) => setNewCustPlace(e.target.value)}
                  placeholder="e.g. Trichy Main Bazaar"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Save Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
