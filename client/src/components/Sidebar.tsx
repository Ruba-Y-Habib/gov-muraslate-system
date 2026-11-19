import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Send,
  Inbox,
  Archive,
  Users,
  PenSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  UserCog,
  Layers,
  Globe,
} from 'lucide-react';
import { Me, roleLabels } from '../types';

interface SidebarProps {
  me: Me;
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ me, activeView, onViewChange, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isEntityUser = me.role === 'external';

  // حساب الجهة الخارجية: شاشة واحدة فقط — مراسلات جهته مع المديرية
  const menuItems = isEntityUser ? [
    { id: 'external', label: 'المراسلات الخارجية', icon: Globe },
  ] : [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'inbox', label: 'البريد الوارد', icon: Inbox },
    { id: 'sent', label: 'البريد الصادر', icon: Send },
    { id: 'compose', label: 'مراسلة جديدة', icon: PenSquare },
    { id: 'archive', label: 'الأرشيف', icon: Archive },
    ...(me.role === 'admin' || me.role === 'director' || me.role === 'dept_head' ? [
      { id: 'external', label: 'المراسلات الخارجية', icon: Globe },
    ] : []),
    { id: 'departments', label: 'رؤساء الأقسام', icon: Users },
    ...(me.role === 'admin' ? [
      { id: 'all', label: 'جميع المراسلات', icon: Layers },
      { id: 'users', label: 'إدارة المستخدمين', icon: UserCog },
    ] : []),
  ];

  const subtitle = me.role === 'admin'
    ? 'مدير النظام'
    : me.role === 'director'
      ? 'مدير المديرية'
      : me.role === 'external'
        ? (me.externalEntityName || 'جهة خارجية')
        : (me.departmentName || roleLabels[me.role]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-white flex flex-col shadow-2xl relative z-20"
    >
      {/* Header */}
      <div className="p-4 border-b border-navy-700/50">
        <div className="flex items-center gap-3">
          <img
            src="/images/emblem.png"
            alt="شعار المديرية"
            className="w-12 h-12 flex-shrink-0"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="overflow-hidden"
              >
                <h1 className="text-sm font-bold text-gold-400 leading-tight">مديرية مالية اللاذقية</h1>
                <p className="text-[11px] text-navy-300 mt-0.5">نظام المراسلات الداخلية</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 border-b border-navy-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-500/20 border-2 border-gold-400 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-gold-400" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="overflow-hidden"
              >
                <p className="text-sm font-semibold text-white">{me.fullName}</p>
                <p className="text-[11px] text-gold-400">{subtitle}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileHover={{ x: -4 }}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer ${
                isActive
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'text-navy-200 hover:bg-navy-700/50 hover:text-white border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-gold-400' : 'text-navy-400 group-hover:text-white'}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* تلميح يظهر عند تمرير المؤشر على الأيقونة في الوضع المصغّر */}
              {collapsed && (
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-navy-800 border border-gold-500/30 text-white text-[11px] font-medium rounded-lg px-3 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                  {item.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-navy-700 border border-navy-600 rounded-full flex items-center justify-center text-white hover:bg-navy-600 transition-colors cursor-pointer z-30"
      >
        {collapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Logout */}
      <div className="p-3 border-t border-navy-700/50">
        <button
          onClick={onLogout}
          className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all cursor-pointer group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                تسجيل الخروج
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-navy-800 border border-gold-500/30 text-white text-[11px] font-medium rounded-lg px-3 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
              تسجيل الخروج
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
