import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  User,
  Building2,
  Search,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { CorrespondencePriority, Me, priorityLabels } from '../types';

interface ComposeFormProps {
  me: Me;
  replyTo?: { id: number; from: string; fromDepartment: string; subject: string } | null;
  presetRecipientId?: number | null;
  onSend: (data: ComposeData) => Promise<{ id: number; number: string; message: string }>;
}

export interface ComposeData {
  toUserId: number | null;
  departmentId: number | null;
  subject: string;
  body: string;
  priority: CorrespondencePriority;
  replyToId?: number | null;
  files: File[];
}

interface UserRow {
  id: number;
  fullName: string;
  departmentName: string | null;
  role: string;
}

interface DeptRow {
  id: number;
  name: string;
  headName: string | null;
}

type RecipientOption =
  | { kind: 'user'; id: number; label: string; sub: string }
  | { kind: 'dept'; id: number; label: string; sub: string };

// تطبيع البحث العربي: توحيد الهمزات والألف المقصورة والتاء المربوطة
const norm = (s: string) =>
  (s || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();

export default function ComposeForm({ me, replyTo, presetRecipientId, onSend }: ComposeFormProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [selected, setSelected] = useState<RecipientOption | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(replyTo ? `رد: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<CorrespondencePriority>('normal');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ number: string; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [us, ds] = await Promise.all([
          api.get<UserRow[]>('/api/users'),
          api.get<DeptRow[]>('/api/departments'),
        ]);
        const list = us.filter(u => u.id !== me.id);
        setUsers(list);
        setDepts(ds);
        // تعبئة المستلم تلقائياً (عند الرد: المرسل الأصلي، أو عند الإرسال من دليل الأقسام)
        if (presetRecipientId) {
          const u = list.find(x => x.id === presetRecipientId);
          if (u) {
            setSelected({ kind: 'user', id: u.id, label: u.fullName, sub: u.departmentName || 'بدون قسم' });
          }
        }
      } catch (e: any) {
        setLoadError(e.message || 'تعذر تحميل قائمة المستلمين');
      }
    };
    load();
  }, [me.id, presetRecipientId]);

  // إغلاق قائمة الاقتراحات عند النقر خارجها
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    const userHits: RecipientOption[] = users
      .filter(u => norm(u.fullName).includes(q) || norm(u.departmentName || '').includes(q))
      .slice(0, 8)
      .map(u => ({ kind: 'user' as const, id: u.id, label: u.fullName, sub: u.departmentName || 'بدون قسم' }));
    const deptHits: RecipientOption[] = depts
      .filter(d => norm(d.name).includes(q))
      .slice(0, 6)
      .map(d => ({
        kind: 'dept' as const,
        id: d.id,
        label: d.name,
        sub: `قسم كامل — تصلك النسخة لجميع منتسبيه النشطين${d.headName ? ` (رئيس القسم: ${d.headName})` : ''}`,
      }));
    return [...userHits, ...deptHits].slice(0, 10);
  }, [query, users, depts]);

  const pick = (opt: RecipientOption) => {
    setSelected(opt);
    setQuery('');
    setOpen(false);
    if (errors.to) setErrors(prev => { const n = { ...prev }; delete n.to; return n; });
  };

  const clearSelected = () => {
    setSelected(null);
    setTimeout(() => toRef.current?.focus(), 0);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) next.push(f);
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} كيلوبايت` : `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selected) errs.to = 'يرجى تحديد المستلم (ابحث بالاسم أو القسم)';
    if (!subject.trim()) errs.subject = 'يرجى إدخال الموضوع';
    if (!body.trim()) errs.body = 'يرجى كتابة نص المراسلة';
    setErrors(errs);
    return errs;
  };

  const handleSubmit = async () => {
    if (sending) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      // التركيز على أول حقل ناقص لتنبيه المستخدم مباشرة
      if (errs.to) toRef.current?.focus();
      else if (errs.subject) subjectRef.current?.focus();
      else if (errs.body) bodyRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await onSend({
        toUserId: selected!.kind === 'user' ? selected!.id : null,
        departmentId: selected!.kind === 'dept' ? selected!.id : null,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        replyToId: replyTo?.id || null,
        files,
      });
      setSentInfo({ number: res.number, message: res.message });
      setSelected(null);
      setSubject('');
      setBody('');
      setPriority('normal');
      setFiles([]);
    } catch (e: any) {
      setErrors({ send: e.message || 'تعذر إرسال المراسلة' });
    } finally {
      setSending(false);
    }
  };

  const missingList = [errors.to && 'المستلم', errors.subject && 'الموضوع', errors.body && 'نص المراسلة']
    .filter(Boolean)
    .join('، ');

  if (sentInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-navy-100 p-10 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-navy-900 mb-2">تم إرسال المراسلة بنجاح</h3>
        <p className="text-sm text-navy-500 mb-1">رقم المراسلة: <span className="font-mono font-bold text-navy-800">{sentInfo.number}</span></p>
        <p className="text-xs text-navy-400 mb-6">{sentInfo.message}</p>
        <button
          onClick={() => setSentInfo(null)}
          className="px-6 py-2.5 bg-navy-800 text-white rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors cursor-pointer"
        >
          مراسلة جديدة
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-navy-100 p-6">
        {replyTo && (
          <div className="mb-5 p-3 rounded-lg bg-gold-50 border border-gold-200 text-xs text-navy-700">
            رد على مراسلة من <span className="font-bold">{replyTo.from}</span> ({replyTo.fromDepartment}) — تم تحديد المرسل الأصلي كمستلم تلقائياً
          </div>
        )}

        {loadError && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {loadError}
          </div>
        )}

        {/* تنبيه استكمال الحقول الناقصة */}
        {missingList && !errors.send && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>يرجى استكمال الحقول التالية: <span className="font-bold">{missingList}</span></span>
          </div>
        )}

        {/* Recipient — بحث بالاسم أو القسم */}
        <div className="mb-4" ref={boxRef}>
          <label className="block text-xs font-semibold text-navy-700 mb-1.5">
            إلى <span className="text-navy-400 font-normal">(ابحث باسم الموظف أو القسم أو جزء منها)</span>
          </label>
          {errors.to && <p className="text-[11px] text-red-600 mb-1">{errors.to}</p>}

          {selected ? (
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${errors.to ? 'border-red-300 bg-red-50' : 'border-navy-200 bg-navy-50'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${selected.kind === 'dept' ? 'bg-teal-100 text-teal-600' : 'bg-navy-100 text-navy-600'}`}>
                  {selected.kind === 'dept' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy-900 truncate">{selected.label}</p>
                  <p className="text-[10px] text-navy-500 truncate">{selected.sub}</p>
                </div>
              </div>
              <button
                onClick={clearSelected}
                className="p-1.5 rounded-full hover:bg-navy-200 text-navy-500 cursor-pointer flex-shrink-0"
                title="تغيير المستلم"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
                <input
                  ref={toRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                  placeholder="اكتب اسم الموظف أو اسم القسم..."
                  className={`w-full border rounded-lg pr-9 pl-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 bg-white ${errors.to ? 'border-red-300' : 'border-navy-200'}`}
                />
                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none" />
              </div>
              {open && query.trim() !== '' && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-navy-200 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-navy-400 text-center">لا توجد نتائج مطابقة للبحث</div>
                  ) : (
                    suggestions.map((opt, i) => (
                      <div key={`${opt.kind}-${opt.id}`}>
                        {i > 0 && suggestions[i - 1].kind !== opt.kind && <div className="h-px bg-navy-100" />}
                        <button
                          onClick={() => pick(opt)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gold-50 text-right transition-colors cursor-pointer"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${opt.kind === 'dept' ? 'bg-teal-100 text-teal-600' : 'bg-navy-100 text-navy-600'}`}>
                            {opt.kind === 'dept' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-900 truncate">{opt.label}</p>
                            <p className="text-[10px] text-navy-500 truncate">{opt.sub}</p>
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-navy-700 mb-1.5">الأولوية</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high', 'urgent'] as CorrespondencePriority[]).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  priority === p
                    ? p === 'urgent'
                      ? 'bg-red-600 text-white border-red-600'
                      : p === 'high'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : p === 'normal'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-navy-600 text-white border-navy-600'
                    : 'bg-white text-navy-600 border-navy-200 hover:border-navy-300'
                }`}
              >
                {priorityLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-navy-700 mb-1.5">الموضوع</label>
          {errors.subject && <p className="text-[11px] text-red-600 mb-1">{errors.subject}</p>}
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (errors.subject) setErrors(prev => { const n = { ...prev }; delete n.subject; return n; });
            }}
            placeholder="اكتب موضوع المراسلة..."
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 ${errors.subject ? 'border-red-300 bg-red-50/40' : 'border-navy-200'}`}
          />
        </div>

        {/* Body */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-navy-700 mb-1.5">نص المراسلة</label>
          {errors.body && <p className="text-[11px] text-red-600 mb-1">{errors.body}</p>}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (errors.body) setErrors(prev => { const n = { ...prev }; delete n.body; return n; });
            }}
            placeholder="اكتب نص المراسلة هنا..."
            rows={8}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 resize-y ${errors.body ? 'border-red-300 bg-red-50/40' : 'border-navy-200'}`}
          />
        </div>

        {/* Attachments */}
        <div className="mb-2">
          <label className="block text-xs font-semibold text-navy-700 mb-1.5">المرفقات</label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-navy-300 text-xs text-navy-500 hover:border-gold-400 hover:text-gold-600 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
            إضافة مرفقات
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-navy-50 border border-navy-100">
                  <span className="text-xs text-navy-700 truncate max-w-[70%]">{f.name} <span className="text-navy-400">({formatSize(f.size)})</span></span>
                  <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {errors.send && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {errors.send}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={sending}
          className="flex items-center gap-2 px-8 py-3 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-navy-900 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'جارٍ الإرسال...' : 'إرسال المراسلة'}
        </button>
      </div>
    </div>
  );
}
