import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCog,
  UserPlus,
  Shield,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Power,
} from 'lucide-react';
import { api } from '../lib/api';
import { Me, UserRow, UserRole, roleLabels } from '../types';

interface UsersViewProps {
  me: Me;
}

interface DeptOption {
  id: number;
  name: string;
}

interface UserFormState {
  id?: number;
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
  departmentId: number | '';
}

const emptyForm: UserFormState = {
  fullName: '',
  username: '',
  password: '',
  role: 'dept_head',
  departmentId: '',
};

export default function UsersView({ me }: UsersViewProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, d] = await Promise.all([
        api.get<UserRow[]>('/api/users'),
        api.get<DeptOption[]>('/api/departments'),
      ]);
      setUsers(u);
      setDepartments(d);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (u: UserRow) => {
    setForm({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      password: '',
      role: u.role,
      departmentId: u.departmentId || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.fullName.trim() || !form.username.trim()) {
      setFormError('الاسم واسم المستخدم مطلوبان');
      return;
    }
    if (!form.id && !form.password) {
      setFormError('كلمة المرور مطلوبة للمستخدم الجديد');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        role: form.role,
        departmentId: form.departmentId === '' ? null : Number(form.departmentId),
      };
      if (form.password) payload.password = form.password;
      if (form.id) {
        await api.put(`/api/users/${form.id}`, payload);
        setNotice('تم تحديث المستخدم بنجاح');
      } else {
        await api.post('/api/users', payload);
        setNotice('تمت إضافة المستخدم بنجاح');
      }
      setShowForm(false);
      await load();
      setTimeout(() => setNotice(null), 4000);
    } catch (e: any) {
      setFormError(e.message || 'تعذر حفظ المستخدم');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      await api.put(`/api/users/${u.id}`, { isActive: !u.isActive });
      await load();
      setNotice(u.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
      setTimeout(() => setNotice(null), 4000);
    } catch (e: any) {
      setError(e.message || 'تعذر تغيير حالة الحساب');
    }
  };

  if (me.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-navy-100">
        <Shield className="w-10 h-10 text-navy-300 mx-auto mb-3" />
        <p className="text-navy-500 text-sm">هذه الشاشة متاحة لمدير النظام فقط</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">إدارة المستخدمين</h2>
          <p className="text-sm text-navy-500 mt-1">إضافة وتعديل حسابات الموظفين والأدوار</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-navy-100 text-navy-500 cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-gold-500 text-navy-900 rounded-lg text-xs font-bold hover:bg-gold-600 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            مستخدم جديد
          </button>
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4" />
            {notice}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          >
            <AlertTriangle className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-navy-300 mx-auto mb-3 animate-spin" />
            <p className="text-navy-400 text-sm">جارٍ التحميل...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 border-b border-navy-100">
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-navy-600">الاسم</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-navy-600">اسم المستخدم</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-navy-600">القسم</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-navy-600">الدور</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-navy-600">الحالة</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-navy-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="hover:bg-navy-50/50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${u.isActive ? 'bg-gold-500/15 border border-gold-400' : 'bg-navy-100'}`}>
                          <UserCog className={`w-4 h-4 ${u.isActive ? 'text-gold-600' : 'text-navy-400'}`} />
                        </div>
                        <span className="font-semibold text-navy-900 text-xs">{u.fullName}</span>
                        {u.id === me.id && (
                          <span className="text-[9px] bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded-full">أنت</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-navy-600 font-mono" dir="ltr">{u.username}</td>
                    <td className="px-5 py-3.5 text-xs text-navy-600">{u.departmentName || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700'
                          : u.role === 'director' ? 'bg-gold-100 text-gold-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {roleLabels[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'نشط' : 'معطّل'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2.5 py-1.5 rounded-lg border border-navy-200 text-[10px] text-navy-600 hover:bg-navy-50 cursor-pointer"
                        >
                          تعديل
                        </button>
                        {u.id !== me.id && (
                          <button
                            onClick={() => toggleActive(u)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] cursor-pointer ${
                              u.isActive
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            {u.isActive ? 'تعطيل' : 'تفعيل'}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-navy-900 px-5 py-4 text-white flex items-center justify-between">
                  <h3 className="font-bold text-sm">{form.id ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h3>
                  <button onClick={() => setShowForm(false)} className="text-navy-300 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-3.5">
                  {formError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {formError}
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">الاسم الكامل</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full border border-navy-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">اسم المستخدم (للدخول)</label>
                    <input
                      type="text"
                      value={form.username}
                      dir="ltr"
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className="w-full border border-navy-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">
                      كلمة المرور {form.id ? '(اتركها فارغة للإبقاء على الحالية)' : ''}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      dir="ltr"
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border border-navy-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-navy-700 mb-1">الدور</label>
                      <select
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                        className="w-full border border-navy-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/50 cursor-pointer"
                      >
                        <option value="dept_head">رئيس قسم</option>
                        <option value="director">مدير المديرية</option>
                        <option value="admin">مدير النظام</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-navy-700 mb-1">القسم</label>
                      <select
                        value={form.departmentId}
                        onChange={(e) => setForm({ ...form, departmentId: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full border border-navy-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/50 cursor-pointer"
                      >
                        <option value="">— بدون قسم —</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2.5 rounded-lg border border-navy-200 text-xs text-navy-600 hover:bg-navy-50 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-gold-500 text-navy-900 rounded-lg text-xs font-bold hover:bg-gold-600 disabled:opacity-60 cursor-pointer"
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {form.id ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
