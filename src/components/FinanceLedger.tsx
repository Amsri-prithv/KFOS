import React, { useState } from 'react';
import {
  IndianRupee,
  Receipt,
  FileSpreadsheet,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Printer,
  Calendar,
} from 'lucide-react';
import { Customer, Order, ExpenseRecord } from '../types/kfos';
import { kfosStore } from '../services/kfosStore';

interface FinanceLedgerProps {
  customers: Customer[];
  orders: Order[];
  onPaymentRecorded?: () => void;
}

export const FinanceLedger: React.FC<FinanceLedgerProps> = ({
  customers,
  orders,
  onPaymentRecorded,
}) => {
  const [activeTab, setActiveTab] = useState<'receivables' | 'expenses' | 'invoices'>('receivables');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  
  // Payment modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [paymentNotes, setPaymentNotes] = useState('');

  // New expense state
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([
    {
      id: 'exp_1',
      title: 'Trichy Route Diesel Fuel',
      category: 'Fuel & Field Travel',
      amount: 1800,
      date: new Date().toISOString().split('T')[0],
      loggedBy: 'Field Rep - Ramesh',
    },
    {
      id: 'exp_2',
      title: '5L HDPE Cans Batch Purchase (500 Cans)',
      category: 'Packaging & Cans',
      amount: 22500,
      date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
      loggedBy: 'Ops Manager',
    },
  ]);

  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number>(0);
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseRecord['category']>('Fuel & Field Travel');

  const customersWithCredit = customers.filter((c) => c.outstandingBalance > 0);
  const totalReceivables = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRealizedProfit = orders.reduce((sum, o) => sum + (o.isReturned ? 0 : o.totalProfit), 0);
  const netOperatingProfit = totalRealizedProfit - totalExpenses;

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    // Find latest unpaid/partial order for this customer
    const customerOrders = orders.filter(
      (o) => o.customerId === selectedCustomer.id && o.paymentStatus !== 'Paid'
    );
    const targetOrderId = customerOrders[0]?.id || 'ord_direct';

    kfosStore.recordPayment(targetOrderId, selectedCustomer.id, paymentAmount, paymentMethod, paymentNotes);
    setSelectedCustomer(null);
    setPaymentAmount(0);
    setPaymentNotes('');
    if (onPaymentRecorded) onPaymentRecorded();
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseTitle || newExpenseAmount <= 0) return;

    const newExp: ExpenseRecord = {
      id: `exp_${Date.now()}`,
      title: newExpenseTitle,
      category: newExpenseCategory,
      amount: newExpenseAmount,
      date: new Date().toISOString().split('T')[0],
      loggedBy: 'Admin',
    };

    setExpenses([newExp, ...expenses]);
    setNewExpenseTitle('');
    setNewExpenseAmount(0);
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview KPI Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Total Receivables
            </span>
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl font-bold text-white">
              ₹{totalReceivables.toLocaleString('en-IN')}
            </span>
            <span className="ml-2 text-xs text-amber-400 font-medium">Outstanding</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Realized Sales Profit
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl font-bold text-emerald-400">
              ₹{totalRealizedProfit.toLocaleString('en-IN')}
            </span>
            <span className="ml-2 text-xs text-neutral-400 font-medium">Gross Margin</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Field & Operating Expenses
            </span>
            <Receipt className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl font-bold text-rose-400">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </span>
            <span className="ml-2 text-xs text-neutral-400 font-medium">Logged Expenses</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Net Business Margin
            </span>
            <IndianRupee className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline">
            <span
              className={`text-2xl font-bold ${
                netOperatingProfit >= 0 ? 'text-indigo-400' : 'text-rose-400'
              }`}
            >
              ₹{netOperatingProfit.toLocaleString('en-IN')}
            </span>
            <span className="ml-2 text-xs text-neutral-400 font-medium">Net Income</span>
          </div>
        </div>
      </div>

      {/* Finance Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'receivables'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Accounts Receivable Aging ({customersWithCredit.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'expenses'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Expense Ledger ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Invoice Generator ({orders.length})
        </button>
      </div>

      {/* Tab 1: Accounts Receivable */}
      {activeTab === 'receivables' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <AlertCircle className="w-5 h-5 text-amber-400 mr-2" />
              Outstanding Credit Ledger by Field Account
            </h3>
            <span className="text-xs text-neutral-400">
              Updated in real-time from sales receipts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-800/80 text-xs text-neutral-400 uppercase border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Customer / Store</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Outstanding Credit</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {customersWithCredit.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      All field customer accounts are fully paid up! Zero credit pending.
                    </td>
                  </tr>
                ) : (
                  customersWithCredit.map((customer) => (
                    <tr key={customer.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-white">
                        {customer.name}
                        {customer.businessName && (
                          <span className="block text-xs text-neutral-400">
                            {customer.businessName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-300">{customer.place}</td>
                      <td className="px-4 py-3.5 text-neutral-400">{customer.phone}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-amber-400">
                        ₹{customer.outstandingBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setPaymentAmount(customer.outstandingBalance);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold text-xs rounded-lg transition-colors inline-flex items-center"
                        >
                          <IndianRupee className="w-3.5 h-3.5 mr-1" />
                          Record Payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Expense Ledger */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center">
              <PlusCircle className="w-4 h-4 text-amber-400 mr-2" />
              Log Field / Operating Expense
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Expense Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Madurai route diesel, 5L cans"
                  value={newExpenseTitle}
                  onChange={(e) => setNewExpenseTitle(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Category
                </label>
                <select
                  value={newExpenseCategory}
                  onChange={(e) =>
                    setNewExpenseCategory(e.target.value as ExpenseRecord['category'])
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Fuel & Field Travel">Fuel & Field Travel</option>
                  <option value="Raw Essence">Raw Essence Chemicals</option>
                  <option value="Packaging & Cans">Packaging & 5L HDPE Cans</option>
                  <option value="Logistics">Logistics & Freight</option>
                  <option value="Sales Commission">Sales Commission</option>
                  <option value="Utilities">Utilities & Factory</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="₹ Amount"
                  value={newExpenseAmount || ''}
                  onChange={(e) => setNewExpenseAmount(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Add Expense Record
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center">
              <FileSpreadsheet className="w-4 h-4 text-rose-400 mr-2" />
              Expense Log History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="bg-neutral-800/80 text-xs text-neutral-400 uppercase border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Expense Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{exp.title}</td>
                      <td className="px-4 py-3 text-neutral-400">{exp.category}</td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">{exp.date}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Receipt className="w-5 h-5 text-indigo-400 mr-2" />
            Field Orders Invoicing Ledger
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-800/80 text-xs text-neutral-400 uppercase border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Order Total</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                  <th className="px-4 py-3 text-center">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-amber-400">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {order.customerName}
                      <span className="block text-xs text-neutral-400">{order.customerPlace}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : order.paymentStatus === 'Partial'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedOrderForInvoice(order)}
                        className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 transition-colors inline-flex items-center"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Record Field Payment Received
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Customer:{' '}
              <span className="text-amber-400 font-semibold">{selectedCustomer.name}</span> (
              {selectedCustomer.place})
            </p>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Payment Amount Received (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedCustomer.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'Cash' | 'UPI' | 'Bank Transfer')
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="UPI">GPay / PhonePe / UPI</option>
                  <option value="Cash">Cash Handover</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Notes / Transaction Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #94829018"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-sm font-semibold rounded-lg flex items-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedOrderForInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-8 max-w-2xl w-full shadow-2xl text-neutral-200">
            <div className="flex justify-between items-start border-b border-neutral-800 pb-6">
              <div>
                <h2 className="text-xl font-bold text-amber-400 uppercase tracking-wide">
                  Kashmeer Fragrances
                </h2>
                <p className="text-xs text-neutral-400">
                  5L Bulk Liquid Fragrances & Botanical Extracts
                </p>
                <p className="text-xs text-neutral-400">Trichy - Madurai - Chennai, Tamil Nadu</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-500 block uppercase">TAX INVOICE</span>
                <span className="text-lg font-mono font-bold text-white">
                  {selectedOrderForInvoice.orderNumber}
                </span>
                <span className="text-xs text-neutral-400 block mt-1">
                  Date: {new Date(selectedOrderForInvoice.orderDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>

            <div className="my-6 grid grid-cols-2 gap-4 text-sm bg-neutral-800/40 p-4 rounded-lg">
              <div>
                <span className="text-xs text-neutral-400 block uppercase">Billed To</span>
                <p className="font-semibold text-white">{selectedOrderForInvoice.customerName}</p>
                <p className="text-xs text-neutral-300">
                  Location: {selectedOrderForInvoice.customerPlace}
                </p>
              </div>
              <div>
                <span className="text-xs text-neutral-400 block uppercase">Payment Status</span>
                <span className="font-bold text-amber-400">
                  {selectedOrderForInvoice.paymentStatus} (Paid ₹
                  {selectedOrderForInvoice.paidAmount.toLocaleString('en-IN')})
                </span>
              </div>
            </div>

            <table className="w-full text-left text-sm mb-6">
              <thead className="bg-neutral-800 text-xs text-neutral-400 uppercase">
                <tr>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Grade</th>
                  <th className="p-3 text-center">Qty (5L Cans)</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {selectedOrderForInvoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-white font-medium">{item.productVariant}</td>
                    <td className="p-3 text-neutral-300">{item.quality}</td>
                    <td className="p-3 text-center text-white">{item.quantity}</td>
                    <td className="p-3 text-right text-neutral-300">
                      ₹{item.salePricePerUnit - item.discountPerUnit}
                    </td>
                    <td className="p-3 text-right font-bold text-white">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center border-t border-neutral-800 pt-4">
              <button
                onClick={() => setSelectedOrderForInvoice(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-sm font-semibold rounded-lg flex items-center"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print / Save Invoice PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
