import React, { useState, useEffect } from 'react';
import { Target, Plus, Phone, MapPin, CheckCircle2, XCircle, ArrowRight, FileText } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { Lead } from '../types/kfos';

export const LeadsManager: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>(kfosStore.getLeads());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [place, setPlace] = useState('');
  const [phone, setPhone] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const update = () => setLeads(kfosStore.getLeads());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const pipelineStages: Lead['status'][] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];

  const filteredLeads = filterStatus === 'ALL' ? leads : leads.filter((l) => l.status === filterStatus);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !place.trim()) return;

    setIsSubmitting(true);
    await kfosStore.addLead({
      name: name.trim(),
      businessName: businessName.trim() || undefined,
      place: place.trim(),
      phone: phone.trim() || '+91 90000 00000',
      status: 'New',
      estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
      notes: notes.trim() || undefined,
    });

    setIsSubmitting(false);
    setName('');
    setBusinessName('');
    setPlace('');
    setPhone('');
    setEstimatedValue('');
    setNotes('');
    setShowModal(false);
  };

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    await kfosStore.updateLeadStatus(leadId, newStatus);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Lead Management & Sales Pipeline
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Track potential field fragrance buyers from prospect inquiry to conversion.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Lead</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-800 font-mono text-xs">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filterStatus === 'ALL' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          All ({leads.length})
        </button>
        {pipelineStages.map((stage) => {
          const count = leads.filter((l) => l.status === stage).length;
          return (
            <button
              key={stage}
              onClick={() => setFilterStatus(stage)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterStatus === stage ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {stage} ({count})
            </button>
          );
        })}
      </div>

      {/* Lead List Table / Empty State */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No leads match the selected status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300 font-mono">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Lead Name</th>
                  <th className="px-4 py-3">Location & Contact</th>
                  <th className="px-4 py-3">Est. Value</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Pipeline Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-semibold text-neutral-100">
                      <div>{lead.name}</div>
                      {lead.businessName && <div className="text-xs text-neutral-500 font-sans">{lead.businessName}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{lead.place}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{lead.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      {lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                        className="bg-neutral-950 border border-neutral-800 text-xs rounded-lg px-2 py-1 text-neutral-200 focus:outline-none focus:border-indigo-500"
                      >
                        {pipelineStages.map((stage) => (
                          <option key={stage} value={stage}>
                            Move to {stage}
                          </option>
                        ))}
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
            <h3 className="text-lg font-bold text-neutral-100">Add New Field Lead</h3>

            <form onSubmit={handleCreateLead} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajan Kumar"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Business / Hotel Name (Optional)</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Grand Palace Hotel"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Location / City</label>
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="e.g. Trichy, Madurai, Chennai"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Est. Deal Value (₹)</label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on requirement..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500 h-20"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
