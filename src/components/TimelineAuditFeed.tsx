import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Package,
  RotateCcw,
  Gift,
  DollarSign,
  Droplet,
  Search,
} from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { TimelineEvent } from '../types/kfos';

export const TimelineAuditFeed: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>(kfosStore.getTimeline());
  const [searchQuery, setSearchQuery] = useState('');

  const refresh = () => setTimeline([...kfosStore.getTimeline()]);

  useEffect(() => {
    refresh();
    return kfosStore.subscribe(refresh);
  }, []);

  const filteredTimeline = timeline.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'Order Created':
        return <Package className="w-4 h-4 text-emerald-400" />;
      case 'Payment Received':
        return <DollarSign className="w-4 h-4 text-teal-400" />;
      case 'Return Processed':
        return <RotateCcw className="w-4 h-4 text-amber-400" />;
      case 'Sample Distributed':
        return <Gift className="w-4 h-4 text-indigo-400" />;
      case 'Stock Restocked':
        return <Droplet className="w-4 h-4 text-blue-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Immutable System Timeline & Field Audit Trail
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Chronological record of all field orders, payments, returns, and sample follow-ups.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search timeline event..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Vertical Timeline Feed */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
        {filteredTimeline.map((evt) => {
          const dateIST = new Date(evt.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          return (
            <div key={evt.id} className="relative group">
              {/* Node Icon */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center shadow-md">
                {getEventIcon(evt.type)}
              </div>

              {/* Event Card */}
              <div className="bg-zinc-900/90 border border-zinc-800/80 group-hover:border-zinc-700 p-4 rounded-2xl space-y-1.5 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-100">{evt.title}</span>
                  <span className="text-[10px] font-mono text-zinc-400">{dateIST} IST</span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">{evt.description}</p>

                {evt.customerName && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 font-mono">
                      Client: {evt.customerName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
