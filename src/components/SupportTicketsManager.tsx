import React, { useState, useEffect } from 'react';
import { LifeBuoy, Plus, CheckCircle2, AlertTriangle, Clock, UserCheck, Search, MessageSquare, FileText } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { SupportTicket, UserRole } from '../types/kfos';

interface SupportTicketsManagerProps {
  userRole?: UserRole;
}

export const SupportTicketsManager: React.FC<SupportTicketsManagerProps> = ({ userRole = 'Founder' }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>(kfosStore.getSupportTickets());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('Medium');
  const [assignedUser, setAssignedUser] = useState('Support Rep');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const update = () => setTickets(kfosStore.getSupportTickets());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !issue.trim()) return;

    setIsSubmitting(true);
    await kfosStore.addSupportTicket({
      customerName: customerName.trim(),
      issue: issue.trim(),
      priority,
      status: 'Open',
      assignedUser,
    });

    setIsSubmitting(false);
    setCustomerName('');
    setIssue('');
    setPriority('Medium');
    setShowModal(false);
  };

  const handleStatusChange = async (ticketId: string, status: SupportTicket['status']) => {
    await kfosStore.updateSupportTicketStatus(ticketId, status);
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.issue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getPriorityBadge = (p: SupportTicket['priority']) => {
    switch (p) {
      case 'Urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'High':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-teal-400" />
            Customer Support & Complaint Tickets
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Track customer complaints, batch defect reports, and fragrance preference feedback.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
          {['ALL', 'Open', 'In Progress', 'Resolved', 'Closed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterStatus === st
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800'
              }`}
            >
              {st} ({st === 'ALL' ? tickets.length : tickets.filter((t) => t.status === st).length})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket #, customer..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-neutral-200 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No support tickets match the current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300 font-mono">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Ticket #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issue Description</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-bold text-teal-400">{t.ticketNumber}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-100">{t.customerName}</td>
                    <td className="px-4 py-3 text-xs text-neutral-300 max-w-xs">{t.issue}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs border ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{t.assignedUser}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-md text-xs bg-neutral-800 text-neutral-200 border border-neutral-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as SupportTicket['status'])}
                        className="bg-neutral-950 border border-neutral-800 text-xs rounded-lg px-2 py-1 text-neutral-200 focus:outline-none focus:border-teal-500"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-100">Raise Support Ticket</h3>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Trichy Fragrance Mart"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Issue Description</label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Describe customer feedback or issue..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-teal-500 h-24"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 font-mono mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 font-mono mb-1">Assign To</label>
                  <input
                    type="text"
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
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
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
