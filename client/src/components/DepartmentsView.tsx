import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  MapPin,
  Send,
  User,
  Building2,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Department, Me } from '../types';

interface DepartmentsViewProps {
  me: Me;
  onComposeTo: (userId: number) => void;
}

const avatarColors = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-purple-500 to-purple-600',
  'from-rose-500 to-rose-600',
  'from-amber-500 to-amber-600',
  'from-cyan-500 to-cyan-600',
];

interface DeptForm {
  name: string;
  headName: string;
  headTitle: string;
  phone: string;
  email: string;
  office: string;
}

const EMPTY_FORM: DeptForm = { name: '', headName: '', headTitle: '', phone: '', email: '', office: '' };

export default function DepartmentsView({ me, onComposeTo }: DepartmentsViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; dept?: Department } | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const isAdmin = me.role === 'admin';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.get<Department[]>('/api/departments');
      setDepartments(list);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل الأقسام');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ mode: 'add' });
  };

  const openEdit = (dept: Department) => {
    setForm({
      name: dept.name || '',
      headName: dept.headName || '',
      headTitle: dept.headTitle || '',
      phone: dept.phone || '',
      email: dept.email || '',
      office: dept.office || '',
    });
    setFormError(null);
    setModal({ mode: 'edit', dept });
  };

  const saveModal = async () => {
    if (!modal || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (modal.mode === 'add') {
        await api.post('/api/departments', form);
      } else {
        await api.put(`/api/departments/${modal.dept!.id}`, form);
      }
      setModal(null);
      setNotice(modal.mode === 'add' ? 'تمت إضافة القسم بنجاح' : 'تم تعديل بيانات القسم بنجاح');
      setTimeout(() => setNotice(null), 5000);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'تعذر حفظ القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (deleting) return;
    if (!window.confirm(`هل أنت متأكد من حذف القسم «${dept.name}»؟ سيخفى القسم من النظام ولن يمكن إرسال مراسلات إليه.`)) return;
    setDeleting(dept.id);
    setError(null);
    try {
      const res = await api.del(`/api/departments/${dept.id}`);
      setNotice(res?.message || 'تم حذف القسم بنجاح');
      setTimeout(() => setNotice(null), 5000);
      await load();
    } catch (e: any) {
      setError(e.message || 'تعذر حذف القسم');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-900">رؤساء الأقسام</h2>
          <p className="text-sm text-navy-500 mt-1">دليل الاتصال برؤساء الأقسام في مديرية مالية اللاذقية</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-500 bg-navy-100 px-3 py-1 rounded-full">{departments.length} قسم</span>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-navy-900 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة قسم
            </button>
          )}
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-navy-100 text-navy-500 cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
          <RefreshCw className="w-8 h-8 text-navy-300 mx-auto mb-3 animate-spin" />
          <p className="text-navy-400 text-sm">جارٍ التحميل...</p>
        </div>
      ) : departments.length === 0 && !error ? (
        <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
          <Building2 className="w-8 h-8 text-navy-300 mx-auto mb-3" />
          <p className="text-navy-400 text-sm">لا توجد أقسام بعد</p>
          {isAdmin && (
            <button onClick={openAdd} className="mt-3 text-xs font-bold text-gold-600 hover:underline cursor-pointer">
              إضافة أول قسم
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, index) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.4) }}
              className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden hover:shadow-lg hover:border-gold-200 transition-all group"
            >
              <div className={`bg-gradient-to-l ${avatarColors[index % avatarColors.length]} px-5 py-4 text-white relative overflow-hidden`}>
                <div className="absolute left-0 top-0 w-32 h-full opacity-10">
                  <Building2 className="w-full h-full p-2" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{dept.headName || 'لم يُحدد'}</h3>
                    <p className="text-[11px] opacity-90">{dept.headTitle || dept.name}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
                    <button
                      onClick={() => openEdit(dept)}
                      title="تعديل القسم"
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      disabled={deleting === dept.id}
                      title="حذف القسم"
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500 text-white cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {deleting === dept.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-navy-600">
                  <Building2 className="w-3.5 h-3.5 text-navy-400" />
                  <span className="font-medium">{dept.name}</span>
                </div>
                {dept.phone && (
                  <div className="flex items-center gap-2 text-xs text-navy-600">
                    <Phone className="w-3.5 h-3.5 text-navy-400" />
                    <span dir="ltr">{dept.phone}</span>
                  </div>
                )}
                {dept.email && (
                  <div className="flex items-center gap-2 text-xs text-navy-600">
                    <Mail className="w-3.5 h-3.5 text-navy-400" />
                    <span dir="ltr">{dept.email}</span>
                  </div>
                )}
                {dept.office && (
                  <div className="flex items-center gap-2 text-xs text-navy-600">
                    <MapPin className="w-3.5 h-3.5 text-navy-400" />
                    <span>{dept.office}</span>
                  </div>
                )}

                {dept.headUserId && (
                  <button
                    onClick={() => onComposeTo(dept.headUserId!)}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-800 hover:bg-gold-500 hover:text-navy-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer group/btn"
                  >
                    <Send className="w-3.5 h-3.5" />
                    إرسال مراسلة لرئيس القسم
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* نافذة إضافة/تعديل قسم */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
              <h3 className="text-base font-bold text-navy-900">
                {modal.mode === 'add' ? 'إضافة قسم جديد' : `تعديل القسم: ${modal.dept!.name}`}
              </h3>
              <button
                onClick={() => !saving && setModal(null)}
                className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">اسم القسم <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: قسم الموازنة"
                  className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">اسم رئيس القسم</label>
                  <input
                    type="text"
                    value={form.headName}
                    onChange={(e) => setForm({ ...form, headName: e.target.value })}
                    placeholder="اختياري"
                    className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={form.headTitle}
                    onChange={(e) => setForm({ ...form, headTitle: e.target.value })}
                    placeholder="اختياري"
                    className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">الهاتف</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="اختياري"
                    dir="ltr"
                    className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="اختياري"
                    dir="ltr"
                    className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 text-left"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">المكتب / الموقع</label>
                <input
                  type="text"
                  value={form.office}
                  onChange={(e) => setForm({ ...form, office: e.target.value })}
                  placeholder="اختياري"
                  className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-navy-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="px-5 py-2 rounded-lg border border-navy-200 text-navy-600 text-xs font-medium hover:bg-navy-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={saveModal}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-navy-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modal.mode === 'add' ? 'إضافة القسم' : 'حفظ التعديلات'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
