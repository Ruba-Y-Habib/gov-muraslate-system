import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CorrespondenceList from './components/CorrespondenceList';
import CorrespondenceDetail from './components/CorrespondenceDetail';
import ComposeForm, { ComposeData } from './components/ComposeForm';
import DepartmentsView from './components/DepartmentsView';
import UsersView from './components/UsersView';
import ExternalView from './components/ExternalView';
import LoginScreen from './components/LoginScreen';
import NotificationBell from './components/NotificationBell';
import { api, getToken, setToken, clearToken } from './lib/api';
import { connectSocket, disconnectSocket } from './lib/socket';
import { Bell, Menu } from 'lucide-react';
import { Correspondence, DashboardStats, Me } from './types';

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<number | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: number; from: string; fromDepartment: string; subject: string } | null>(null);
  const [composeUserId, setComposeUserId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Correspondence[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (me && me.role === 'external') return;
    try {
      const [s, r] = await Promise.all([
        api.get<DashboardStats>('/api/correspondences/meta/stats'),
        api.get<Correspondence[]>('/api/correspondences?box=incoming'),
      ]);
      setStats(s);
      setRecent(r.slice(0, 5));
    } catch {
      /* handled by unauthorized event */
    }
  }, [me]);

  // Restore session on load
  useEffect(() => {
    const restore = async () => {
      if (getToken()) {
        try {
          const user = await api.get<Me>('/api/auth/me');
          setMe(user);
          setActiveView(user.role === 'external' ? 'external' : 'dashboard');
        } catch {
          clearToken();
        }
      }
      setAuthLoading(false);
    };
    restore();
  }, []);

  // Handle session expiry
  useEffect(() => {
    const onUnauthorized = () => {
      setMe(null);
      setSelectedCorrespondence(null);
      setActiveView('dashboard');
    };
    window.addEventListener('murasalat:unauthorized', onUnauthorized);
    return () => window.removeEventListener('murasalat:unauthorized', onUnauthorized);
  }, []);

  // Load data + live notifications when logged in
  useEffect(() => {
    if (!me) return;
    refreshData();
    connectSocket((payload) => {
      setToast(`بريد جديد من ${payload.fromName}: ${payload.subject}`);
      setTimeout(() => setToast(null), 6000);
      window.dispatchEvent(new Event('murasalat:mail-changed'));
      refreshData();
    });
    return () => disconnectSocket();
  }, [me, refreshData]);

  // Refresh when any view changes are signaled (sent/read/archive)
  useEffect(() => {
    const onChanged = () => {
      refreshData();
      setDataVersion(v => v + 1);
    };
    window.addEventListener('murasalat:mail-changed', onChanged);
    return () => window.removeEventListener('murasalat:mail-changed', onChanged);
  }, [refreshData]);

  const handleLogin = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: Me }>('/api/auth/login', { username, password });
    setToken(res.token);
    setMe(res.user);
    setActiveView(res.user.role === 'external' ? 'external' : 'dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    disconnectSocket();
    setMe(null);
    setSelectedCorrespondence(null);
    setSelectedExternal(null);
    setActiveView('dashboard');
  }, []);

  // فتح مراسلة خارجية من الإشعارات
  const handleViewExternal = useCallback((id: number) => {
    setSelectedCorrespondence(null);
    setSelectedExternal(id);
    setActiveView('external');
    setMobileMenuOpen(false);
  }, []);

  const handleViewCorrespondence = useCallback((id: number) => {
    setSelectedCorrespondence(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCorrespondence(null);
    window.dispatchEvent(new Event('murasalat:mail-changed'));
  }, []);

  const handleReply = useCallback((c: Correspondence) => {
    setReplyTo({ id: c.id, from: c.from, fromDepartment: c.fromDepartment, subject: c.subject });
    // الرد يعود تلقائياً إلى المرسل الأصلي للمراسلة
    setComposeUserId(c.fromUserId);
    setSelectedCorrespondence(null);
    setActiveView('compose');
  }, []);

  const handleComposeTo = useCallback((userId: number) => {
    setReplyTo(null);
    setComposeUserId(userId);
    setActiveView('compose');
  }, []);

  const handleSend = useCallback(async (data: ComposeData) => {
    const form = new FormData();
    if (data.toUserId) form.append('toUserId', String(data.toUserId));
    if (data.departmentId) form.append('departmentId', String(data.departmentId));
    form.append('subject', data.subject);
    form.append('body', data.body);
    form.append('priority', data.priority);
    if (data.replyToId) form.append('replyToId', String(data.replyToId));
    for (const f of data.files) form.append('attachments', f);
    const res = await api.postForm<{ id: number; number: string; message: string }>('/api/correspondences', form);
    setReplyTo(null);
    setComposeUserId(null);
    window.dispatchEvent(new Event('murasalat:mail-changed'));
    return res;
  }, []);

  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
    setSelectedCorrespondence(null);
    setSelectedExternal(null);
    setReplyTo(null);
    setComposeUserId(null);
    setMobileMenuOpen(false);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
        <div className="w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!me) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (selectedCorrespondence) {
      return (
        <CorrespondenceDetail
          correspondenceId={selectedCorrespondence}
          onBack={handleBack}
          onReply={handleReply}
        />
      );
    }

    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            recent={recent}
            me={me}
            onViewCorrespondence={handleViewCorrespondence}
            onViewChange={handleViewChange}
          />
        );
      case 'inbox':
        return (
          <CorrespondenceList
            key={`inbox-${dataVersion}`}
            title="البريد الوارد"
            box="incoming"
            onViewCorrespondence={handleViewCorrespondence}
          />
        );
      case 'sent':
        return (
          <CorrespondenceList
            key={`sent-${dataVersion}`}
            title="البريد الصادر"
            box="sent"
            onViewCorrespondence={handleViewCorrespondence}
          />
        );
      case 'archive':
        return (
          <CorrespondenceList
            key={`archive-${dataVersion}`}
            title="الأرشيف"
            box="archived"
            onViewCorrespondence={handleViewCorrespondence}
          />
        );
      case 'all':
        return (
          <CorrespondenceList
            key={`all-${dataVersion}`}
            title="جميع المراسلات"
            box="all"
            onViewCorrespondence={handleViewCorrespondence}
          />
        );
      case 'compose':
        return (
          <ComposeForm
            me={me}
            replyTo={replyTo}
            presetRecipientId={composeUserId}
            onSend={handleSend}
          />
        );
      case 'departments':
        return <DepartmentsView me={me} onComposeTo={handleComposeTo} />;
      case 'external':
        return (
          <ExternalView
            me={me}
            focusId={selectedExternal}
            onFocusHandled={() => setSelectedExternal(null)}
          />
        );
      case 'users':
        return <UsersView me={me} />;
      default:
        return null;
    }
  };

  const viewTitles: Record<string, string> = {
    dashboard: 'لوحة التحكم',
    inbox: 'البريد الوارد',
    sent: 'البريد الصادر',
    compose: 'مراسلة جديدة',
    archive: 'الأرشيف',
    all: 'جميع المراسلات',
    departments: 'رؤساء الأقسام',
    external: 'المراسلات الخارجية',
    users: 'إدارة المستخدمين',
  };

  return (
    <div className="flex h-screen bg-navy-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          me={me}
          activeView={activeView}
          onViewChange={handleViewChange}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 h-full z-50 lg:hidden"
            >
              <Sidebar
                me={me}
                activeView={activeView}
                onViewChange={handleViewChange}
                onLogout={handleLogout}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-navy-100 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-navy-100 cursor-pointer"
            >
              <Menu className="w-5 h-5 text-navy-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-navy-900">
                {selectedCorrespondence ? 'تفاصيل المراسلة' : viewTitles[activeView]}
              </h1>
              <p className="text-xs text-navy-500 hidden sm:block">
                مديرية مالية اللاذقية - نظام المراسلات الداخلية
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell onOpenCorrespondence={handleViewCorrespondence} onOpenExternal={handleViewExternal} />
            <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-navy-200">
              <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-400 flex items-center justify-center">
                <img src="/images/emblem.png" alt="" className="w-5 h-5" />
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-navy-800">{me.fullName}</p>
                <p className="text-[10px] text-navy-500">
                  {me.role === 'dept_head' ? (me.departmentName || 'رئيس قسم') : me.role === 'admin' ? 'مدير النظام' : me.role === 'external' ? (me.externalEntityName || 'جهة خارجية') : 'مدير المديرية'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView + (selectedCorrespondence || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Live mail toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 left-5 z-50 flex items-center gap-3 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-gold-500/40 max-w-sm"
          >
            <Bell className="w-5 h-5 text-gold-400 flex-shrink-0" />
            <p className="text-sm">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
