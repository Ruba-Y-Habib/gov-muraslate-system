// شاشة المراسلات الخارجية: تسجيل الوارد والصادر مع الجهات الرسمية الأخرى، الإدارة والأرشفة والطباعة
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2, Plus, Search, Printer, Archive, ArchiveRestore, Loader2,
  ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, Paperclip, Download, Eye,
  ShieldCheck, X, KeyRound, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { printOfficialLetter } from '../lib/officialPrint';
import {
  ExternalEntity, ExternalMessage, ExternalMessageDetail, ExternalDirection,
  formatDate, formatSize, Me,
} from '../types';

type Tab = 'messages' | 'entities';
type Filter = 'all' | 'out' | 'in' | 'archived';

const directionLabels: Record<ExternalDirection, string> = {
  out: 'صادر',
  in: 'وارد',
};

interface Props {
  me: Me;
  focusId?: number | null;
  onFocusHandled?: () => void;
}

export default function ExternalView({ me, focusId, onFocusHandled }: Props) {
  const [tab, setTab] = useState<Tab>('messages');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  const [entities, setEntities] = useState<ExternalEntity[]>([]);
  const [messages, setMessages] = useState<ExternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ExternalMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [entityFormOpen, setEntityFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<ExternalEntity | null>(null);
  const composeRef = useRef<HTMLDivElement>(null);

  const isAdmin = me.role === 'admin';
  const isEntityUser = me.role === 'external';
  const isStaff = !isEntityUser;
  const canManageEntities = isAdmin || me.role === 'director';
  const canSeeExternal = isEntityUser || isAdmin || me.role === 'director' || me.role === 'dept_head';

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // تحميل الجهات
  const loadEntities = useCallback(async () => {
    try {
      const list = await api.get<ExternalEntity[]>('/api/external-entities');
      setEntities(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // تحميل القائمة وفق الفلاتر
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'out') params.set('direction', 'out');
      if (filter === 'in') params.set('direction', 'in');
      if (filter === 'archived') params.set('archived', '1'); else params.set('archived', '0');
      if (search.trim()) params.set('q', search.trim());
      if (entityFilter) params.set('entityId', entityFilter);
      const list = await api.get<ExternalMessage[]>(`/api/external?${params.toString()}`);
      setMessages(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, search, entityFilter]);

  useEffect(() => { if (!isEntityUser) loadEntities(); }, [loadEntities, isEntityUser]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // تفاصيل رسالة
  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setSelectedId(id);
    try {
      const d = await api.get<ExternalMessageDetail>(`/api/external/${id}`);
      setDetail(d);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  // فتح رسالة محددة قادمة من الإشعارات
  useEffect(() => {
    if (focusId == null) return;
    openDetail(focusId);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // أرشفة / إلغاء أرشفة
  const toggleArchive = async () => {
    if (!detail) return;
    setArchiving(true);
    try {
      const r = await api.post<{ message: string }>(`/api/external/${detail.id}/archive`, {});
      flash(r.message);
      setDetail({ ...detail, archived: !detail.archived });
      loadMessages();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setArchiving(false);
    }
  };

  // طباعة كتاب رسمي بترويسة الجمهورية
  const printLetter = () => {
    if (!detail) return;
    const outgoing = detail.direction === 'out';
    // المرسل والمستلم حسب اتجاه المراسلة — اسم القسم يظهر للموظف وينحذف لمدير المالية/النظام
    const ourSide = me.role === 'dept_head' && me.departmentName
      ? `${me.fullName} / ${me.departmentName}`
      : 'مدير مالية اللاذقية';
    const entitySide = detail.entity.sectionName
      ? `${detail.entity.name} / ${detail.entity.sectionName}`
      : detail.entity.name;
    printOfficialLetter({
      date: detail.date,
      number: detail.number,
      senderSection: outgoing ? (me.role === 'dept_head' ? (me.departmentName || '') : '') : '',
      senderIsDirector: me.role !== 'dept_head',
      fromLine: outgoing ? ourSide : entitySide,
      toLine: outgoing ? entitySide : ourSide,
      subject: detail.subject,
      body: detail.body,
    });
  };

  if (!canSeeExternal) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-navy-100 p-8 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-navy-300" />
        <p className="mt-3 text-navy-700 font-medium">المراسلات الخارجية متاحة لموظفي المديرية المخوّلين وحسابات الجهات الخارجية فقط.</p>
      </div>
    );
  }

  // ================== تفاصيل الرسالة ==================
  if (selectedId && detail) {
    const outgoing = detail.direction === 'out';
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={closeDetail} className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 font-medium cursor-pointer">
            رجوع
          </button>
          <div className="flex items-center gap-2">
            {isStaff && (<>
            <button
              onClick={toggleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-navy-200 text-xs text-navy-600 hover:bg-navy-50 transition-colors cursor-pointer disabled:opacity-60"
            >
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : detail.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {detail.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
            </button>
            <button
              onClick={printLetter}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500 text-navy-900 text-xs font-bold hover:bg-gold-600 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة كتاب رسمي
            </button>
            </>)}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden">
          <div className={`px-6 py-4 text-white flex items-start justify-between gap-4 ${outgoing ? 'bg-gradient-to-l from-navy-900 to-navy-800' : 'bg-gradient-to-l from-emerald-900 to-emerald-800'}`}>
            <div>
              <h2 className="text-lg font-bold">{detail.subject}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] opacity-90">
                <span className="font-mono text-gold-300">{detail.number}</span>
                <span>{formatDate(detail.date)}</span>
                <span className="bg-white/15 rounded-full px-2 py-0.5">
                  {outgoing ? `صادر إلى ${detail.entity.name}` : `واردة من ${detail.entity.name}`}
                </span>
              </div>
            </div>
            <span className="text-[11px] bg-white/15 rounded-full px-3 py-1 flex-shrink-0">
              {directionLabels[detail.direction]}
            </span>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-navy-50 rounded-lg p-3">
                <p className="text-[11px] text-navy-500 mb-1">الجهة الخارجية</p>
                <p className="font-semibold text-navy-900">{detail.entity.name}</p>
                {detail.entity.sectionName && <p className="text-xs text-navy-600 mt-0.5">القسم: {detail.entity.sectionName}</p>}
                {detail.entity.contactInfo && <p className="text-xs text-navy-500 mt-0.5">{detail.entity.contactInfo}</p>}
              </div>
              <div className="bg-navy-50 rounded-lg p-3">
                <p className="text-[11px] text-navy-500 mb-1">سجّلها</p>
                <p className="font-semibold text-navy-900">{detail.createdByName}</p>
                <p className="text-xs text-navy-500 mt-0.5">{formatDate(detail.createdAt || detail.date)}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-navy-500 mb-1">نص المراسلة</p>
              <p className="text-sm text-navy-900 whitespace-pre-wrap leading-relaxed border-r-2 border-gold-400 pr-3">{detail.body}</p>
            </div>

            {detail.attachments.length > 0 && (
              <div>
                <p className="text-[11px] text-navy-500 mb-2">المرفقات ({detail.attachments.length})</p>
                <div className="space-y-2">
                  {detail.attachments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-navy-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-navy-400 flex-shrink-0" />
                        <span className="text-xs text-navy-800 truncate">{a.fileName}</span>
                        <span className="text-[10px] text-navy-400 flex-shrink-0">{formatSize(a.sizeBytes)}</span>
                      </div>
                      <button
                        onClick={() => api.download(`/api/external/attachment/${a.id}`, a.fileName).catch((e) => flash((e as Error).message))}
                        className="flex items-center gap-1 text-[11px] text-gold-700 hover:text-gold-800 flex-shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تنزيل
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {toast && (
          <div className="fixed bottom-5 left-5 z-50 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
        )}
      </div>
    );
  }

  if (selectedId && detailLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  // ================== القائمة ==================
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* التبويبات */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-white rounded-xl border border-navy-100 p-1">
          <button
            onClick={() => setTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === 'messages' ? 'bg-gold-500/20 text-gold-800' : 'text-navy-600 hover:bg-navy-50'}`}
          >
            الرسائل الخارجية
          </button>
          {isStaff && (
            <button
              onClick={() => setTab('entities')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === 'entities' ? 'bg-gold-500/20 text-gold-800' : 'text-navy-600 hover:bg-navy-50'}`}
            >
              <Building2 className="w-4 h-4 inline-block ml-1 -mt-0.5" />
              الجهات الخارجية
            </button>
          )}
        </div>
        {tab === 'messages' && (
          <button
            onClick={() => { setComposeOpen(true); setTimeout(() => composeRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-bold hover:bg-navy-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isEntityUser ? 'إرسال مراسلة إلى المديرية' : 'تسجيل مراسلة خارجية'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <AnimatePresence>
        {composeOpen && (
          <ExternalComposeForm
            entities={entities}
            isEntityUser={isEntityUser}
            entityName={me.externalEntityName || ''}
            onCancel={() => setComposeOpen(false)}
            onSaved={(msg) => {
              setComposeOpen(false);
              flash(msg);
              loadMessages();
            }}
            innerRef={composeRef}
          />
        )}
      </AnimatePresence>

      {tab === 'messages' ? (
        <>
          {/* الفلاتر */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'النشطة'],
              ['out', 'الصادر'],
              ['in', 'الوارد'],
              ...(isStaff ? [['archived', 'الأرشيف']] : []),
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${filter === key ? 'bg-navy-900 text-white' : 'bg-white border border-navy-100 text-navy-600 hover:bg-navy-50'}`}
              >
                {label}
              </button>
            ))}
            {isStaff && (
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="mr-auto text-xs border border-navy-100 rounded-lg px-3 py-2 bg-white text-navy-700 cursor-pointer"
            >
              <option value="">كل الجهات</option>
              {entities.map((en) => (
                <option key={en.id} value={String(en.id)}>{en.name}</option>
              ))}
            </select>
            )}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالموضوع أو الرقم أو الجهة"
                className="w-56 pr-9 pl-3 py-2 text-xs border border-navy-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              />
            </div>
          </div>

          {/* القائمة */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-gold-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-xl border border-navy-100 py-16 text-center text-navy-500 text-sm">
              لا توجد مراسلات خارجية في هذا التصنيف بعد.
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openDetail(m.id)}
                  className="w-full text-right bg-white rounded-xl border border-navy-100 px-4 py-3.5 hover:border-gold-400/60 hover:shadow-sm transition-all cursor-pointer flex items-center gap-3"
                >
                  {m.direction === 'out'
                    ? <ArrowUpCircle className="w-6 h-6 text-navy-700 flex-shrink-0" />
                    : <ArrowDownCircle className="w-6 h-6 text-emerald-700 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-navy-900">{m.subject}</span>
                      {m.archived && <span className="text-[10px] bg-navy-100 text-navy-600 rounded-full px-2 py-0.5">مؤرشفة</span>}
                    </div>
                    <p className="text-[11px] text-navy-500 mt-1">
                      <span className="font-mono text-gold-700">{m.number}</span>
                      {' · '}{m.direction === 'out' ? `إلى ${m.entityName}` : `من ${m.entityName}`}
                      {' · '}{formatDate(m.date)}
                      {' · '}{m.createdByName}
                    </p>
                  </div>
                  {m.unread
                    ? <span className="w-2.5 h-2.5 rounded-full bg-gold-500 flex-shrink-0" title="غير مقروءة" />
                    : <Eye className="w-4 h-4 text-navy-300 flex-shrink-0" />}
                </motion.button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ============ إدارة الجهات ============ */
        <EntitiesPanel
          entities={entities}
          isAdmin={isAdmin}
          canManage={canManageEntities}
          onChanged={() => { loadEntities(); loadMessages(); }}
          flash={flash}
          editingEntity={editingEntity}
          setEditingEntity={setEditingEntity}
          entityFormOpen={entityFormOpen}
          setEntityFormOpen={setEntityFormOpen}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-5 z-50 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
      )}
    </div>
  );
}

// ================== نموذج تسجيل مراسلة خارجية ==================
function ExternalComposeForm({
  entities, isEntityUser, entityName, onCancel, onSaved, innerRef,
}: {
  entities: ExternalEntity[];
  isEntityUser: boolean;
  entityName: string;
  onCancel: () => void;
  onSaved: (msg: string) => void;
  innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [direction, setDirection] = useState<ExternalDirection>(isEntityUser ? 'in' : 'out');
  const [entityId, setEntityId] = useState('');
  const [number, setNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const missing = () => {
    if (!isEntityUser && !entityId) return 'الجهة الخارجية';
    if (!subject.trim()) return 'الموضوع';
    if (!body.trim()) return 'نص المراسلة';
    return null;
  };

  const submit = async () => {
    const miss = missing();
    if (miss) {
      setErr(`يرجى إكمال: ${miss}`);
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('direction', direction);
      if (entityId) fd.append('entityId', entityId);
      fd.append('subject', subject.trim());
      fd.append('body', body);
      if (number.trim()) fd.append('number', number.trim());
      if (date) fd.append('date', new Date(date).toISOString());
      for (const f of files) fd.append('attachments', f);
      const r = await api.postForm<{ message: string }>('/api/external', fd);
      onSaved(r.message);
    } catch (e) {
      setErr((e as Error).message);
      setSending(false);
    }
  };

  return (
    <motion.div
      ref={innerRef}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-white rounded-xl border border-gold-400/50 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-navy-900 text-sm">{isEntityUser ? 'إرسال مراسلة إلى مديرية مالية اللاذقية' : 'تسجيل مراسلة خارجية (على ترقيم الديوان)'}</h3>
          <button onClick={onCancel} className="text-navy-400 hover:text-navy-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{err}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isEntityUser ? (
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              تُرسل هذه المراسلة باسم «{entityName}» إلى مديرية مالية اللاذقية — وستُرقّم على ديوان المديرية.
            </div>
          ) : (
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">نوع المراسلة</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection('out')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${direction === 'out' ? 'bg-navy-900 text-white border-navy-900' : 'border-navy-100 text-navy-600 hover:bg-navy-50'}`}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                صادرة من المديرية
              </button>
              <button
                onClick={() => setDirection('in')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${direction === 'in' ? 'bg-emerald-800 text-white border-emerald-800' : 'border-navy-100 text-navy-600 hover:bg-navy-50'}`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                واردة إلى المديرية
              </button>
            </div>
          </div>
          )}
          {!isEntityUser && (
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">الجهة الخارجية</label>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/50"
            >
              <option value="">— اختر الجهة —</option>
              {entities.map((en) => (
                <option key={en.id} value={String(en.id)}>{en.name}{en.sectionName ? ` — ${en.sectionName}` : ''}</option>
              ))}
            </select>
          </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">
              رقم الديوان <span className="text-navy-300">(يُولَّد تلقائياً {direction === 'out' ? 'ص/السنة/التسلسل' : 'و/السنة/التسلسل'} إذا تُرك فارغاً)</span>
            </label>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="مثال: ص/2026/015"
              className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">تاريخ المراسلة <span className="text-navy-300">(اختياري — الافتراضي الآن)</span></label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-navy-500 mb-1">الموضوع</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
          />
        </div>

        <div>
          <label className="block text-[11px] text-navy-500 mb-1">نص المراسلة</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50 resize-y"
          />
        </div>

        <div>
          <label className="block text-[11px] text-navy-500 mb-1">المرفقات (حتى 10 ملفات)</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-xs text-navy-600 file:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gold-500/20 file:text-gold-800 file:text-xs file:font-bold file:cursor-pointer"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-navy-100 text-xs text-navy-600 hover:bg-navy-50 cursor-pointer">إلغاء</button>
          <button
            onClick={submit}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gold-500 text-navy-900 text-xs font-bold hover:bg-gold-600 cursor-pointer disabled:opacity-60"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            حفظ وتسجيل
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ================== إدارة الجهات الخارجية ==================
function EntitiesPanel({
  entities, isAdmin, canManage, onChanged, flash, editingEntity, setEditingEntity,
  entityFormOpen, setEntityFormOpen,
}: {
  entities: ExternalEntity[];
  isAdmin: boolean;
  canManage: boolean;
  onChanged: () => void;
  flash: (m: string) => void;
  editingEntity: ExternalEntity | null;
  setEditingEntity: (e: ExternalEntity | null) => void;
  entityFormOpen: boolean;
  setEntityFormOpen: (v: boolean) => void;
}) {
  const [creds, setCreds] = useState<{ username: string; password: string; name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const resetPassword = async (en: ExternalEntity) => {
    if (!window.confirm(`إعادة تعيين كلمة مرور حساب الجهة «${en.name}»؟ سيتم إلغاء كلمة المرور الحالية.`)) return;
    setResetting(true);
    try {
      const r = await api.post<{ username: string; password: string }>(`/api/external-entities/${en.id}/reset-password`, {});
      setCreds({ username: r.username, password: r.password, name: en.name });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-3">
      {canManage && (
      <div className="flex justify-end">
        <button
          onClick={() => { setEditingEntity(null); setEntityFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-sm font-bold hover:bg-navy-800 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إضافة جهة خارجية
        </button>
      </div>
      )}

      {entityFormOpen && (
        <EntityForm
          editing={editingEntity}
          onClose={() => { setEntityFormOpen(false); setEditingEntity(null); }}
          onSaved={(msg, cr) => {
            setEntityFormOpen(false);
            setEditingEntity(null);
            flash(msg);
            onChanged();
            if (cr) setCreds(cr);
          }}
        />
      )}

      {entities.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 py-14 text-center text-navy-500 text-sm">
          لا توجد جهات خارجية بعد — أضف مديرية العقارات أو المحافظة أو المحكمة أو غيرها.
        </div>
      ) : (
        <div className="space-y-2">
          {entities.map((en) => (
            <motion.div
              key={en.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl border border-navy-100 px-4 py-3.5 flex items-center gap-3 ${!en.isActive ? 'opacity-60' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-navy-50 border border-navy-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-navy-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-navy-900">{en.name}</span>
                  {!en.isActive && <span className="text-[10px] bg-navy-100 text-navy-500 rounded-full px-2 py-0.5">معطّلة</span>}
                </div>
                <p className="text-[11px] text-navy-500 mt-0.5">
                  {en.sectionName ? `القسم: ${en.sectionName}` : 'بدون قسم محدد'}
                  {en.contactInfo ? ` · ${en.contactInfo}` : ''}
                  {en.accountUsername ? ` · حساب الدخول: ${en.accountUsername}` : ' · بلا حساب نظامي'}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isAdmin && (
                    <button
                      onClick={() => resetPassword(en)}
                      disabled={resetting}
                      className="p-2 rounded-lg text-navy-400 hover:text-gold-700 hover:bg-gold-50 cursor-pointer disabled:opacity-60"
                      title="إعادة تعيين كلمة مرور حساب الجهة"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingEntity(en); setEntityFormOpen(true); }}
                    className="p-2 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 cursor-pointer"
                    title="تعديل"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`حذف أو تعطيل الجهة «${en.name}»؟`)) return;
                      try {
                        const r = await api.del<{ message: string }>(`/api/external-entities/${en.id}`);
                        flash(r.message);
                        onChanged();
                      } catch (e) {
                        flash((e as Error).message);
                      }
                    }}
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="حذف / تعطيل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* نافذة بيانات الدخول */}
      <AnimatePresence>
        {creds && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-navy-950/60 flex items-center justify-center p-4"
            onClick={() => setCreds(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-gold-600" />
                <h3 className="font-bold text-navy-900">بيانات دخول حساب الجهة</h3>
              </div>
              <p className="text-xs text-navy-500">
                احفظ هذه البيانات الآن — لن تظهر مرة أخرى. سلّمها للجهة كي تسجّل الدخول وتراسل المديرية.
              </p>
              <div className="bg-navy-50 rounded-xl p-4 space-y-2 text-sm">
                <p>الجهة: <span className="font-bold text-navy-900">{creds.name}</span></p>
                <p>اسم المستخدم: <span className="font-bold text-navy-900" dir="ltr">{creds.username}</span></p>
                <p>كلمة المرور: <span className="font-bold text-gold-700" dir="ltr">{creds.password}</span></p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`المستخدم: ${creds.username}\nكلمة المرور: ${creds.password}`).then(() => flash('تم نسخ بيانات الدخول')).catch(() => {});
                  }}
                  className="px-4 py-2 rounded-lg bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 cursor-pointer"
                >
                  نسخ البيانات
                </button>
                <button
                  onClick={() => setCreds(null)}
                  className="px-4 py-2 rounded-lg border border-navy-100 text-xs text-navy-600 hover:bg-navy-50 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ================== نموذج جهة خارجية ==================
function EntityForm({
  editing, onClose, onSaved,
}: {
  editing: ExternalEntity | null;
  onClose: () => void;
  onSaved: (msg: string, creds?: { username: string; password: string; name: string }) => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [sectionName, setSectionName] = useState(editing?.sectionName || '');
  const [contactInfo, setContactInfo] = useState(editing?.contactInfo || '');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr('اسم المديرية الخارجية مطلوب');
      return;
    }
    if (!editing && accountPassword.trim() && accountPassword.trim().length < 6) {
      setErr('كلمة مرور الحساب يجب أن تكون 6 أحرف أو أكثر');
      return;
    }
    if (editing && newPassword.trim() && newPassword.trim().length < 6) {
      setErr('كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أكثر');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (editing) {
        const r = await api.put<{ message: string }>(`/api/external-entities/${editing.id}`, {
          name: name.trim(), sectionName: sectionName.trim(), contactInfo: contactInfo.trim(), isActive: editing.isActive,
          newPassword: newPassword.trim() || undefined,
        });
        onSaved(r.message);
      } else {
        const r = await api.post<{ message: string; accountUsername?: string; password?: string }>('/api/external-entities', {
          name: name.trim(), sectionName: sectionName.trim(), contactInfo: contactInfo.trim(),
          username: accountUsername.trim() || undefined,
          password: accountPassword.trim() || undefined,
        });
        onSaved(r.message, r.accountUsername && r.password
          ? { username: r.accountUsername, password: r.password, name: name.trim() }
          : undefined);
      }
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gold-400/50 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-navy-900 text-sm">{editing ? 'تعديل جهة خارجية' : 'إضافة جهة خارجية'}</h3>
        <button onClick={onClose} className="text-navy-400 hover:text-navy-700 cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{err}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-navy-500 mb-1">اسم المديرية / الجهة</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مديرية العقارات، المحافظة، المحكمة"
            className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
          />
        </div>
        <div>
          <label className="block text-[11px] text-navy-500 mb-1">اسم القسم فيها <span className="text-navy-300">(اختياري)</span></label>
          <input
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="مثال: قسم التسجيل"
            className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-navy-500 mb-1">بيانات الاتصال <span className="text-navy-300">(اختياري)</span></label>
        <input
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          placeholder="هاتف أو بريد أو عنوان"
          className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
        />
      </div>

      {!editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-navy-50 rounded-xl p-3">
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">اسم مستخدم حساب الجهة <span className="text-navy-300">(اختياري — يُولَّد تلقائياً)</span></label>
            <input
              value={accountUsername}
              onChange={(e) => setAccountUsername(e.target.value)}
              placeholder="أحرف إنكليزية وأرقام"
              className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[11px] text-navy-500 mb-1">كلمة مرور الحساب <span className="text-navy-300">(اختيارية — تُولَّد تلقائياً)</span></label>
            <input
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
              className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              dir="ltr"
            />
          </div>
          <p className="sm:col-span-2 text-[11px] text-navy-500">
            سيُنشأ للجهة حساب نظامي تلقائياً لتسجيل الدخول ومراسلة المديرية — تظهر بيانات الدخول بعد الحفظ ولا يمكن استرجاعها لاحقاً.
          </p>
        </div>
      )}

      {editing && (
        <div>
          <label className="block text-[11px] text-navy-500 mb-1">كلمة مرور جديدة لحساب الجهة <span className="text-navy-300">(اتركها فارغة للإبقاء على الحالية)</span></label>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6 أحرف على الأقل"
            className="w-full text-sm border border-navy-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
            dir="ltr"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-navy-100 text-xs text-navy-600 hover:bg-navy-50 cursor-pointer">إلغاء</button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gold-500 text-navy-900 text-xs font-bold hover:bg-gold-600 cursor-pointer disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          حفظ
        </button>
      </div>
    </div>
  );
}
