import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  ArrowUpLeft,
  ArrowDownRight,
  Paperclip,
  Eye,
  Clock,
  CheckCircle2,
  Archive,
  MailOpen,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Correspondence,
  CorrespondencePriority,
  CorrespondenceStatus,
  formatDate,
} from '../types';

interface CorrespondenceListProps {
  title: string;
  box: 'incoming' | 'sent' | 'archived' | 'all';
  onViewCorrespondence: (id: number) => void;
}

const priorityLabels: Record<CorrespondencePriority, string> = {
  low: 'منخفض',
  normal: 'عادي',
  high: 'هام',
  urgent: 'عاجل',
};

const priorityColors: Record<CorrespondencePriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusIcons: Record<CorrespondenceStatus, typeof Clock> = {
  sent: CheckCircle2,
  read: MailOpen,
  archived: Archive,
};

const statusLabels: Record<CorrespondenceStatus, string> = {
  sent: 'مرسلة',
  read: 'مقروءة',
  archived: 'مؤرشفة',
};

const statusColors: Record<CorrespondenceStatus, string> = {
  sent: 'bg-emerald-100 text-emerald-700',
  read: 'bg-blue-100 text-blue-700',
  archived: 'bg-purple-100 text-purple-700',
};

export default function CorrespondenceList({ title, box, onViewCorrespondence }: CorrespondenceListProps) {
  const [items, setItems] = useState<Correspondence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<CorrespondencePriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Correspondence[]>(`/api/correspondences?box=${box}`);
      setItems(res);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل المراسلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [box]);

  let filtered = items;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      c =>
        c.subject.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        c.from.toLowerCase().includes(q) ||
        c.to.toLowerCase().includes(q) ||
        (c.fromDepartment || '').includes(q) ||
        (c.toDepartment || '').includes(q)
    );
  }
  if (priorityFilter !== 'all') {
    filtered = filtered.filter(c => c.priority === priorityFilter);
  }

  const priorityOrder: Record<CorrespondencePriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-navy-900">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-500 bg-navy-100 px-3 py-1 rounded-full">
            {filtered.length} مراسلة
          </span>
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-navy-100 text-navy-500 cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              type="text"
              placeholder="بحث بالرقم، الموضوع، المرسل أو المستلم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-navy-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as CorrespondencePriority | 'all')}
              className="border border-navy-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 bg-white cursor-pointer"
            >
              <option value="all">جميع الأولويات</option>
              <option value="urgent">عاجل</option>
              <option value="high">هام</option>
              <option value="normal">عادي</option>
              <option value="low">منخفض</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
              className="border border-navy-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 bg-white cursor-pointer"
            >
              <option value="date">ترتيب بالتاريخ</option>
              <option value="priority">ترتيب بالأولوية</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
          <RefreshCw className="w-8 h-8 text-navy-300 mx-auto mb-3 animate-spin" />
          <p className="text-navy-400 text-sm">جارٍ التحميل...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl p-12 text-center border border-red-100">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-gold-600 hover:underline cursor-pointer">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
              <Inbox className="w-12 h-12 text-navy-300 mx-auto mb-3" />
              <p className="text-navy-500">لا توجد مراسلات مطابقة</p>
            </div>
          ) : (
            filtered.map((item, index) => {
              const StatusIcon = statusIcons[item.status];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className={`bg-white rounded-xl shadow-sm border hover:shadow-md hover:border-gold-200 transition-all cursor-pointer group ${
                    item.type === 'incoming' && item.status === 'sent' ? 'border-r-4 border-r-gold-500' : 'border-navy-100'
                  }`}
                  onClick={() => onViewCorrespondence(item.id)}
                >
                  <div className="p-4 flex items-start gap-4">
                    {/* Type Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'incoming' ? 'bg-blue-100' : 'bg-emerald-100'
                    }`}>
                      {item.type === 'incoming' ? (
                        <ArrowDownRight className="w-5 h-5 text-blue-600" />
                      ) : (
                        <ArrowUpLeft className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-semibold text-navy-900 text-sm group-hover:text-gold-700 transition-colors ${item.type === 'incoming' && item.status === 'sent' ? 'font-bold' : ''}`}>
                          {item.subject}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${priorityColors[item.priority]}`}>
                          {priorityLabels[item.priority]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-navy-500">
                        <span className="font-mono">{item.number}</span>
                        <span>{formatDate(item.date)}</span>
                        <span>
                          {item.type === 'incoming' ? `من: ${item.from} (${item.fromDepartment})` : `إلى: ${item.to} (${item.toDepartment})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[item.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusLabels[item.status]}
                        </span>
                        {item.attachmentCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-navy-400">
                            <Paperclip className="w-3 h-3" />
                            {item.attachmentCount} مرفق
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-navy-400" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
