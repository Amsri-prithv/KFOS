import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Filter,
  DollarSign,
  Search,
  X,
  Undo2,
  Droplet,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { Order, ProductVariant, QualityGrade, PRICING_MATRIX } from '../types/kfos';

interface OrderManagerProps {
  isAdminUnlocked: boolean;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ isAdminUnlocked }) => {
  const [orders, setOrders] = useState<Order[]>(kfosStore.getOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPlace, setCustPlace] = useState('');
  const [variant, setVariant] = useState<ProductVariant>('Room Freshener');
  const [quality, setQuality] = useState<QualityGrade>('Standard');
  const [quantity, setQuantity] = useState(5);
  const [discountPerUnit, setDiscountPerUnit] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  // Undo Buffer State
  const [undoToast, setUndoToast] = useState<{
    message: string;
    undoFn: () => void;
    timerId: NodeJS.Timeout;
  } | null>(null);

  const refresh = () => setOrders(kfosStore.getOrders());

  useEffect(() => {
    refresh();
    return kfosStore.subscribe(refresh);
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await kfosStore.createOrder({
      customerName: custName,
      customerPlace: custPlace,
      productVariant: variant,
      quality,
      quantity,
      discountPerUnit,
      paidAmount,
      source: 'Dashboard Manual',
    });

    if (res.success) {
      setShowNewOrderModal(false);
      setCustName('');
      setCustPlace('');
      setQuantity(5);
      setDiscountPerUnit(0);
      setPaidAmount(0);
    } else {
      alert(`Failed to create order: ${res.error}`);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForReturn || !returnReason.trim()) return;

    const res = await kfosStore.processReturn(selectedOrderForReturn.id, returnReason);
    if (res.success) {
      setSelectedOrderForReturn(null);
      setReturnReason('');
      alert(res.message);
    } else {
      alert(res.error || 'Failed to process return');
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!isAdminUnlocked) {
      alert('Admin Unlock (PIN 6124) is required to delete/archive orders.');
      return;
    }

    const { success, undoAction } = kfosStore.softDeleteOrder(orderId);
    if (success) {
      if (undoToast) clearTimeout(undoToast.timerId);

      const timerId = setTimeout(() => {
        setUndoToast(null);
      }, 5000); // 5 second undo window

      setUndoToast({
        message: 'Order archived. You have 5 seconds to undo.',
        undoFn: () => {
          undoAction();
          clearTimeout(timerId);
          setUndoToast(null);
        },
        timerId,
      });
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPlace.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            placeholder="Search order #, customer, or place..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={() => setShowNewOrderModal(true)}
          className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Sales Order
        </button>
      </div>

      {/* Undo Toast Floating Window */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-zinc-950 px-4 py-3 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-4 h-4" />
          <span>{undoToast.message}</span>
          <button
            onClick={undoToast.undoFn}
            className="px-2.5 py-1 bg-zinc-950 text-amber-400 rounded-lg text-[11px] font-mono flex items-center gap-1 hover:bg-zinc-900"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="overflow-x-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3.5 px-4">Order #</th>
              <th className="py-3.5 px-4">Customer & Place</th>
              <th className="py-3.5 px-4">Variant & Quality</th>
              <th className="py-3.5 px-4">Quantity</th>
              <th className="py-3.5 px-4">Total Amount</th>
              <th className="py-3.5 px-4">Realized Profit</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {filteredOrders.map((ord) => {
              const item = ord.items[0];
              return (
                <tr key={ord.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-100">{ord.orderNumber}</td>
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-bold text-zinc-200">{ord.customerName}</div>
                    <div className="text-[10px] text-zinc-400">{ord.customerPlace}</div>
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px]">
                      {item?.quality} {item?.productVariant}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold">{item?.quantity} Cans (5L)</td>
                  <td className="py-3.5 px-4 font-bold text-zinc-100">
                    ₹{ord.totalAmount.toLocaleString('en-IN')}
                    {ord.totalDiscount > 0 && (
                      <span className="text-[10px] text-zinc-400 block font-normal">
                        (-₹{ord.totalDiscount} disc)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    {ord.isReturned ? (
                      <span className="text-red-400 line-through">
                        ₹{ord.totalProfit.toLocaleString('en-IN')} (Reversed)
                      </span>
                    ) : (
                      `+₹${ord.totalProfit.toLocaleString('en-IN')}`
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    {ord.isReturned ? (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-bold">
                        Returned
                      </span>
                    ) : ord.paymentStatus === 'Paid' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold">
                        Paid
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold">
                        {ord.paymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2 font-sans">
                    {!ord.isReturned && (
                      <button
                        onClick={() => setSelectedOrderForReturn(ord)}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded text-[11px] font-semibold"
                        title="Process Product Return & Reverse Profit"
                      >
                        Return
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOrder(ord.id)}
                      className="p-1 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 rounded"
                      title="Soft Delete Order (5s Undo Window)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Return Modal */}
      {selectedOrderForReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Process Product Return #{selectedOrderForReturn.orderNumber}
            </h3>
            <p className="text-xs text-zinc-400">
              Returning this order will automatically restore physical liquid inventory to the pool and deduct/reverse ₹
              {selectedOrderForReturn.totalProfit.toLocaleString('en-IN')} from Net Realized Profit.
            </p>

            <form onSubmit={handleProcessReturn} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Reason for Return</label>
                <textarea
                  required
                  rows={3}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Fragrance variant swapped or damaged seal during transit"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Confirm Return & Reverse Profit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForReturn(null)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">Create New Sales Order</h3>
              <button onClick={() => setShowNewOrderModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Ramesh Super Market"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Place / City</label>
                  <input
                    type="text"
                    required
                    value={custPlace}
                    onChange={(e) => setCustPlace(e.target.value)}
                    placeholder="e.g. Trichy"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Variant</label>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as ProductVariant)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                  >
                    <option value="Room Freshener">Room Freshener</option>
                    <option value="Bathroom Freshener">Bathroom Freshener</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Quality Grade</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as QualityGrade)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1"
                  >
                    <option value="Eco">Eco (Buy ₹650 / Sale ₹900)</option>
                    <option value="Standard">Standard (Buy ₹750 / Sale ₹1200)</option>
                    <option value="Premium">Premium (Buy ₹950 / Sale ₹1500)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-zinc-400">Quantity (5L Cans)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Discount/Unit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={discountPerUnit}
                    onChange={(e) => setDiscountPerUnit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Paid Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 mt-1 font-mono"
                  />
                </div>
              </div>

              {/* Live Profit Preview */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Unit Realized Profit:</span>
                  <span>₹{PRICING_MATRIX[quality].salePrice - PRICING_MATRIX[quality].buyPrice - discountPerUnit}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-400 text-sm">
                  <span>Total Realized Profit:</span>
                  <span>
                    +₹
                    {(PRICING_MATRIX[quality].salePrice - PRICING_MATRIX[quality].buyPrice - discountPerUnit) *
                      quantity}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Commit Sales Order
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
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
