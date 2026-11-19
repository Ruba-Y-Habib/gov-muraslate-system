import { motion } from 'framer-motion';
import {
  Inbox,
  Send,
  Clock,
  AlertTriangle,
  Calendar,
  Archive,
  TrendingUp,
  ArrowUpLeft,
  Users,
  Layers,
  PenSquare,
} from 'lucide-react';
import { Correspondence, DashboardStats, Me, formatDate, priorityLabels } from '../types';

interface DashboardProps {
  stats: DashboardStats | null;
  recent: Correspondence[];
  me: Me;
  onViewCorrespondence: (id: number) => void;
  onViewChange: (view: string) => void;
}

const statCards = [
  { key: 'totalIncoming', label: 'الوارد', icon: Inbox, bgLight: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: 'totalOutgoing', label: 'الصادر', icon: Send, color: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { key: 'unreadCount', label: 'غير مقروء', icon: Clock, bgLight: 'bg-amber-50', textColor: 'text-amber-700' },
  { key: 'urgentCount', label: 'عاجل / هام', icon: AlertTriangle, bgLight: 'bg-red-50', textColor: 'text-red-700' },
  { key: 'todayCount', label: 'اليوم', icon: Calendar, bgLight: 'bg-purple-50', textColor: 'text-purple-700' },
  { key: 'archivedCount', label: 'الأرشيف', icon: Archive, bgLight: 'bg-gray-100', textColor: 'text-gray-700' },
];

export default function Dashboard({ stats, recent, me, onViewCorrespondence, onViewChange }: DashboardProps) {
  const quickActions = [
    { id: 'compose', label: 'مراسلة جديدة', icon: PenSquare, color: 'text-gold-600 bg-gold-50 border-gold-200' },
    { id: 'inbox', label: 'البريد الوارد', icon: Inbox, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'sent', label: 'البريد الصادر', icon: Send, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'departments', label: 'دليل الأقسام', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-navy-900 via-navy-800 to-navy-900 p-6 text-white shadow-xl"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-gold-400" />
            <span className="text-gold-400 text-sm font-medium">نظام المراسلات الداخلية</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">مرحباً، {me.fullName}</h2>
          <p className="text-navy-200 text-sm">
            {me.role === 'admin' ? 'مدير النظام' : me.role === 'director' ? 'مدير المديرية' : (me.departmentName || 'رئيس قسم')} - مديرية مالية اللاذقية
          </p>
          <p className="text-navy-300 text-xs mt-2">
            {new Date().toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="absolute left-0 top-0 w-64 h-full opacity-10">
          <img src="/images/emblem.png" alt="" className="w-full h-full object-contain" />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          const value = stats ? stats[card.key as keyof DashboardStats] : null;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="bg-white rounded-xl p-4 shadow-sm border border-navy-100 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg ${card.bgLight} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
              <p className="text-2xl font-bold text-navy-900">
                {value === null ? '—' : value}
              </p>
              <p className="text-xs text-navy-500 mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onClick={() => onViewChange(action.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border bg-white hover:shadow-md transition-all cursor-pointer ${action.color}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-semibold text-navy-800">{action.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Recent Incoming */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-navy-100 flex items-center justify-between bg-navy-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold-600" />
            <h3 className="font-bold text-navy-900 text-sm">أحدث البريد الوارد</h3>
          </div>
          <button
            onClick={() => onViewChange('inbox')}
            className="text-xs text-gold-600 hover:text-gold-700 font-medium cursor-pointer"
          >
            عرض الكل
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="w-10 h-10 text-navy-300 mx-auto mb-3" />
            <p className="text-sm text-navy-400">لا يوجد بريد وارد بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-50">
            {recent.map((c) => (
              <button
                key={c.id}
                onClick={() => onViewCorrespondence(c.id)}
                className="w-full text-right px-5 py-3.5 hover:bg-navy-50/60 transition-colors flex items-center gap-4 cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${c.type === 'incoming' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                  <ArrowUpLeft className={`w-4 h-4 ${c.type === 'incoming' ? 'text-blue-600 rotate-180' : 'text-emerald-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">{c.subject}</p>
                  <p className="text-[11px] text-navy-500 mt-0.5">
                    من: {c.from} - {c.fromDepartment} · <span className="font-mono">{c.number}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.priority === 'urgent' && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {priorityLabels.urgent}
                    </span>
                  )}
                  <span className="text-[11px] text-navy-400">{formatDate(c.date)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
