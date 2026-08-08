import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { Campaign } from '../types/kfos';

export const CampaignsManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(kfosStore.getCampaigns());
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState('WhatsApp Direct');
  const [budget, setBudget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const update = () => setCampaigns(kfosStore.getCampaigns());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await kfosStore.addCampaign({
      name: name.trim(),
      channel,
      budget: budget ? parseFloat(budget) : 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'Active',
      leadCount: 0,
      conversions: 0,
    });

    setIsSubmitting(false);
    setName('');
    setBudget('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-400" />
            Field Marketing & Outreach Campaigns
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Track promotional campaigns, sample giveaways, and hotel trade show leads.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Launch Campaign</span>
        </button>
      </div>

      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No marketing campaigns recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300 font-mono">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Campaign Name</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Leads Generated</th>
                  <th className="px-4 py-3">Conversions</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-semibold text-neutral-100">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{c.channel}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">₹{c.budget.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-indigo-300 font-bold">{c.leadCount}</td>
                    <td className="px-4 py-3 text-teal-400 font-bold">{c.conversions}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {c.status}
                      </span>
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
            <h3 className="text-lg font-bold text-neutral-100">Launch New Marketing Campaign</h3>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Trichy Hotel Association Expo"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="WhatsApp Direct">WhatsApp Direct</option>
                  <option value="Field Sales Rep Visit">Field Sales Rep Visit</option>
                  <option value="Trade Show / Expo">Trade Show / Expo</option>
                  <option value="Hotel Directory Ad">Hotel Directory Ad</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 font-mono mb-1">Budget (₹)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-indigo-500"
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
                  {isSubmitting ? 'Creating...' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
