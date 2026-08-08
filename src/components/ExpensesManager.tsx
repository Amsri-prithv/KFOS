import React, { useState, useEffect } from 'react';
import { IndianRupee, Plus, AlertCircle, FileText, Calendar, UserCheck } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { ExpenseRecord, UserRole } from '../types/kfos';

interface ExpensesManagerProps {
  userRole?: UserRole;
}

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({ userRole = 'Founder' }) => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(kfosStore.getExpenses());
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseRecord['category']>('Fuel & Field Travel');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setExpenses(kfosStore.getExpenses());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const isAllowedToManage = ['Founder', 'Admin', 'Finance'].includes(userRole);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) {
      setError('Please provide a valid title and positive amount');
      return;
    }

    setIsSubmitting(true);
    const res = await kfosStore.addExpense({
      title: title.trim(),
      category,
      amount: amt,
      date: new Date().toISOString(),
      loggedBy: userRole,
      notes: notes.trim(),
    });

    setIsSubmitting(false);
    if (res.success) {
      setTitle('');
      setAmount('');
      setNotes('');
      setShowModal(false);
    } else {
      setError(res.error || 'Failed to record expense');
    }
  };

  const totalExpenseSum = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-red-400" />
            Company Expenses & Field Operational Costs
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Authoritative financial expense ledger stored directly in Firestore.
          </p>
        </div>

        {isAllowedToManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        )}
      </div>

      {!isAllowedToManage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>You have Read-Only view access to company expense totals. Expense entries require Founder/Admin/Finance role permissions.</span>
        </div>
      )}

      {/* Summary Banner */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between font-mono">
        <div>
          <span className="text-xs uppercase text-neutral-400 font-semibold tracking-wider">Total Recorded Expenses</span>
          <div className="text-3xl font-black text-red-400 mt-1">₹{totalExpenseSum.toLocaleString('en-IN')}</div>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <span>{expenses.length} Expense Entries</span>
        </div>
      </div>

      {/* Expense List Table */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No operational expenses have been logged yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300 font-mono">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Expense Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Logged By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-semibold text-neutral-100">{exp.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-md text-xs bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-400">₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-neutral-400">{exp.loggedBy}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {new Date(exp.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs max-w-xs truncate">{exp.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-100">Record Operational Expense</h3>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Expense Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fuel for Trichy field trip"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-red-500"
                >
                  <option value="Fuel & Field Travel">Fuel & Field Travel</option>
                  <option value="Raw Essence">Raw Essence</option>
                  <option value="Packaging & Cans">Packaging & Cans</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Sales Commission">Sales Commission</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-red-500 h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
