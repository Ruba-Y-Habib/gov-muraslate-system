import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Printer,
  Paperclip,
  Clock,
  CheckCircle2,
  Archive,
  MailOpen,
  ArrowUpLeft,
  ArrowDownRight,
  Reply,
  User,
  Building2,
  Calendar,
  Hash,
  Loader2,
  Download,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { printOfficialLetter } from '../lib/officialPrint';
import {
  Correspondence,
  CorrespondencePriority,
  CorrespondenceStatus,
  formatDateTime,
  formatSize,
  priorityLabels,
} from '../types';

interface CorrespondenceDetailProps {
  correspondenceId: number;
  onBack: () => void;
  onReply: (correspondence: Correspondence) => void;
  onOpenCorrespondence?: (id: number) => void;
}

const priorityColors: Record<CorrespondencePriority, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
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
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  read: 'bg-blue-100 text-blue-700 border-blue-200',
  archived: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function CorrespondenceDetail({ correspondenceId, onBack, onReply, onOpenCorrespondence }: CorrespondenceDetailProps) {
  const [item, setItem] = useState<Correspondence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await api.get<Correspondence>(`/api/correspondences/${correspondenceId}`);
      setItem(c);
      window.dispatchEvent(new Event('murasalat:mail-changed'));
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل المراسلة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [correspondenceId]);

  const handleArchive = async () => {
    if (!item || archiving) return;
    setArchiving(true);
    try {
      await api.post(`/api/correspondences/${item.id}/archive`);
      await load();
    } catch (e: any) {
      setError(e.message || 'تعذر الأرشفة');
    } finally {
      setArchiving(false);
    }
  };

  const ATT_BASE = '/api/correspondences/attachments';

  const handleDownload = (attId: number, fileName: string) => {
    api.download(`${ATT_BASE}/${attId}/download`, fileName).catch((e) => {
      setError(e.message || 'تعذر تنزيل المرفق');
    });
  };

  const isPreviewable = (contentType: string) =>
    contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/');

  const handlePreview = (attId: number) => {
    api.blobUrl(`${ATT_BASE}/${attId}/download`).then((url) => {
      window.open(url, '_blank');
    }).catch((e) => {
      setError(e.message || 'تعذر فتح المرفق للمعاينة');
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
        <Loader2 className="w-8 h-8 text-navy-300 mx-auto mb-3 animate-spin" />
        <p className="text-navy-400 text-sm">جارٍ التحميل...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-red-100">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-500 text-sm">{error || 'المراسلة غير موجودة'}</p>
        <button onClick={onBack} className="mt-4 px-5 py-2 bg-navy-800 text-white rounded-lg text-xs font-medium cursor-pointer">
          رجوع
        </button>
      </div>
    );
  }

  const handlePrintOfficial = () => {
    if (!item) return;
    // المرسل منتمٍ لقسم: الاسم/القسم — وإلا فهو مدير المالية أو مدير النظام: «مدير مالية اللاذقية»
    const senderHasDept = !!item.fromDepartment && item.fromDepartment !== '—';
    const receiverHasDept = !!item.toDepartment && item.toDepartment !== '—';
    printOfficialLetter({
      date: item.date,
      number: item.number,
      senderSection: senderHasDept ? item.fromDepartment : '',
      senderIsDirector: !senderHasDept,
      fromLine: senderHasDept ? `${item.from} / ${item.fromDepartment}` : 'مدير مالية اللاذقية',
      toLine: receiverHasDept ? `${item.to} / ${item.toDepartment}` : 'مدير مالية اللاذقية',
      subject: item.subject,
      body: item.body,
    });
  };

  const StatusIcon = statusIcons[item.status];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 font-medium cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>
        <div className="flex items-center gap-2">
          {item.type === 'incoming' && item.status !== 'archived' && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-navy-200 text-xs text-navy-600 hover:bg-navy-50 transition-colors cursor-pointer disabled:opacity-60"
            >
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              أرشفة
            </button>
          )}
          <button
            onClick={handlePrintOfficial}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-navy-200 text-xs text-navy-600 hover:bg-navy-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة كتاب رسمي
          </button>
          {item.type === 'incoming' && (
            <button
              onClick={() => onReply(item)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-500 text-navy-900 text-xs font-bold hover:bg-gold-600 transition-colors cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5" />
              رد
            </button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden"
      >
        <div className="bg-gradient-to-l from-navy-900 to-navy-800 px-6 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">{item.subject}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-navy-300">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /><span className="font-mono text-gold-400">{item.number}</span></span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(item.date)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${priorityColors[item.priority]}`}>
                {priorityLabels[item.priority]}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border ${statusColors[item.status]}`}>
                <StatusIcon className="w-3 h-3" />
                {statusLabels[item.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="px-6 py-4 border-b border-navy-100 grid sm:grid-cols-2 gap-3 bg-navy-50/40">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${item.type === 'incoming' ? 'bg-blue-100' : 'bg-navy-100'}`}>
              <ArrowDownRight className={`w-4 h-4 ${item.type === 'incoming' ? 'text-blue-600' : 'text-navy-500'}`} />
            </div>
            <div>
              <p className="text-[10px] text-navy-400">من</p>
              <p className="text-xs font-bold text-navy-900">{item.from}</p>
              <p className="text-[10px] text-navy-500 flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{item.fromDepartment}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${item.type === 'outgoing' ? 'bg-emerald-100' : 'bg-navy-100'}`}>
              <ArrowUpLeft className={`w-4 h-4 ${item.type === 'outgoing' ? 'text-emerald-600' : 'text-navy-500'}`} />
            </div>
            <div>
              <p className="text-[10px] text-navy-400">إلى</p>
              <p className="text-xs font-bold text-navy-900">{item.to}</p>
              <p className="text-[10px] text-navy-500 flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{item.toDepartment}</p>
            </div>
          </div>
        </div>

        {item.replyToNumber && (
          <div className="px-6 py-2.5 border-b border-navy-100 text-[11px] text-navy-500 bg-gold-50/50">
            رد على المراسلة رقم <span className="font-mono text-gold-700">{item.replyToNumber}</span>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-navy-800 leading-loose whitespace-pre-wrap">{item.body}</p>
        </div>

        {/* Attachments */}
        {item.attachments && item.attachments.length > 0 && (
          <div className="px-6 py-4 border-t border-navy-100 bg-navy-50/30">
            <p className="text-xs font-bold text-navy-700 mb-2.5 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-navy-400" />
              المرفقات ({item.attachments.length})
            </p>
            <div className="space-y-2">
              {item.attachments.map(att => {
                const canPreview = isPreviewable(att.contentType || '');
                return (
                  <div
                    key={att.id}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white border border-navy-150 hover:border-gold-300 hover:shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Paperclip className="w-4 h-4 text-navy-400 flex-shrink-0" />
                      <span className="text-xs text-navy-800 font-medium truncate">{att.fileName}</span>
                      <span className="text-[10px] text-navy-400 flex-shrink-0">({formatSize(att.sizeBytes)})</span>
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {canPreview && (
                        <button
                          onClick={() => handlePreview(att.id)}
                          title="معاينة المرفق"
                          className="p-1.5 rounded-lg hover:bg-gold-100 text-navy-400 hover:text-gold-700 cursor-pointer transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(att.id, att.fileName)}
                        title="تنزيل المرفق"
                        className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-400 hover:text-navy-700 cursor-pointer transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read receipt */}
        <div className="px-6 py-3 border-t border-navy-100 flex items-center justify-between text-[10px] text-navy-400">
          <span>حالة القراءة: {item.readAt ? `قُرئت بتاريخ ${formatDateTime(item.readAt)}` : 'لم تُقرأ بعد'}</span>
          {item.repliedAt && <span>رُدّ عليها بتاريخ {formatDateTime(item.repliedAt)}</span>}
        </div>
      </motion.div>

      {/* سجل المحادثة: من أول مراسلة حتى آخر رد بتواريخها */}
      {item.thread && item.thread.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-5">
          <p className="text-xs font-bold text-navy-700 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-navy-400" />
            سجل المحادثة — من أول مراسلة إلى آخر رد ({item.thread.length})
          </p>
          <div>
            {item.thread.map((t, i) => {
              const isCurrent = t.id === item.id;
              return (
                <div key={t.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${isCurrent ? 'bg-gold-500 border-gold-500' : 'bg-white border-navy-300'}`} />
                    {i < item.thread!.length - 1 && <div className="w-px flex-1 bg-navy-200 my-0.5 min-h-[2.25rem]" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <button
                      onClick={() => { if (!isCurrent && onOpenCorrespondence) onOpenCorrespondence(t.id); }}
                      disabled={isCurrent}
                      className={`w-full text-right px-3 py-2 rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-gold-50 border-gold-300 cursor-default'
                          : 'bg-white border-navy-100 hover:border-gold-300 hover:bg-gold-50/40 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-navy-900">{t.subject}</span>
                        <span className="text-[10px] font-mono text-gold-700">{t.number}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap mt-1">
                        <span className="text-[10px] text-navy-500">
                          من {t.from} ({t.fromDepartment}) إلى {t.to} ({t.toDepartment})
                        </span>
                        <span className="text-[10px] text-navy-400 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatDateTime(t.date)}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
