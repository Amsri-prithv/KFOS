import React, { useState, useEffect } from 'react';
import { Bell, Check, AlertTriangle, Info, CheckCircle2, FileText } from 'lucide-react';
import { kfosStore } from '../services/kfosStore';
import { NotificationItem } from '../types/kfos';

export const NotificationsManager: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(kfosStore.getNotifications());

  useEffect(() => {
    const update = () => setNotifications(kfosStore.getNotifications());
    update();
    return kfosStore.subscribe(update);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'alert':
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            System Notifications & Low-Stock Alerts
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time alerts for low stock thresholds, pending follow-ups, and payment updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all border border-neutral-700"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No data available</p>
            <p className="text-xs text-neutral-600 mt-1">No system notifications or alerts currently present.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 transition-all ${
                  !n.isRead ? 'bg-amber-500/5' : 'hover:bg-neutral-800/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 mt-0.5">
                    {getTypeIcon(n.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-neutral-100">{n.title}</h4>
                      {!n.isRead && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">{n.message}</p>
                    <span className="text-[10px] text-neutral-500 font-mono mt-2 block">
                      {new Date(n.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </div>
                </div>

                {!n.isRead && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
