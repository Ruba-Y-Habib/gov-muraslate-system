import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, MailOpen, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { AppNotification, formatDateTime } from '../types';

interface NotificationBellProps {
  onOpenCorrespondence: (id: number) => void;
  onOpenExternal?: (id: number) => void;
}

export default function NotificationBell({ onOpenCorrespondence, onOpenExternal }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await api.get<{ unreadCount: number; notifications: AppNotification[] }>('/api/notifications');
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener('murasalat:mail-changed', onChanged);
    const interval = setInterval(load, 60000);
    return () => {
      window.removeEventListener('murasalat:mail-changed', onChanged);
      clearInterval(interval);
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAllRead = async () => {
    await api.post('/api/notifications/read-all');
    load();
  };

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) {
      api.post(`/api/notifications/${n.id}/read`).catch(() => {});
    }
    setOpen(false);
    load();
    if (n.externalMessageId && onOpenExternal) {
      onOpenExternal(n.externalMessageId);
    } else if (n.correspondenceId) {
      onOpenCorrespondence(n.correspondenceId);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-navy-100 transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5 text-navy-600" />
        {unread > 0 && (
          <span className="absolute top-1 left-1 min-w-4 h-4 px-0.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-navy-100 z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-navy-100 flex items-center justify-between bg-navy-50/50">
              <h4 className="text-sm font-bold text-navy-900">الإشعارات</h4>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-gold-600 hover:text-gold-700 font-medium cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-navy-50">
              {items.length === 0 ? (
                <div className="p-8 text-center">
                  <MailOpen className="w-8 h-8 text-navy-300 mx-auto mb-2" />
                  <p className="text-xs text-navy-400">لا توجد إشعارات</p>
                </div>
              ) : (
                items.map(n => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`w-full text-right px-4 py-3 hover:bg-navy-50/60 transition-colors cursor-pointer ${
                      !n.isRead ? 'bg-gold-50/40 border-r-2 border-gold-400' : ''
                    }`}
                  >
                    <p className={`text-xs ${!n.isRead ? 'font-bold text-navy-900' : 'font-medium text-navy-700'}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-[11px] text-navy-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-navy-400 mt-1">{formatDateTime(n.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
