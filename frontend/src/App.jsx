import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio,
  MapPin,
  Sliders,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  Wifi,
  WifiOff,
  Home,
  User,
  KeyRound,
  Users,
  LogOut,
  ChevronDown,
  LogIn,
} from 'lucide-react';

import LandingView from './components/LandingView';
import VictimView from './components/VictimView';
import DashboardView from './components/DashboardView';
import DemoControlPanel from './components/DemoControlPanel';
import AboutHonestyModal from './components/AboutHonestyModal';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import AdminUsersView from './components/AdminUsersView';
import ChangePasswordModal from './components/ChangePasswordModal';
import InactivityWarningModal from './components/InactivityWarningModal';
import { getCurrentUser, logoutUser, getSessionToken } from './utils/auth';

const getInitialView = () => {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('admin/users') || path.includes('admin-users')) return 'admin-users';
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('victim')) return 'victim';
  if (path.includes('demo')) return 'demo';
  if (path.includes('register')) return 'register';
  if (path.includes('login')) return 'login';
  return 'landing';
};

export default function App() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [activeUser, setActiveUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [reports, setReports] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeScriptedStep, setActiveScriptedStep] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Dropdown & Modals
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loginRedirectTarget, setLoginRedirectTarget] = useState('dashboard');

  // Inactivity Timeout (30 min auto-logout, 1 min warning)
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState(60);
  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await getCurrentUser();
        setActiveUser(user);
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    initAuth();
  }, []);

  // Route Guard Navigation
  const navigateTo = (view) => {
    setShowUserDropdown(false);

    // Protected views require authentication
    const protectedViews = ['dashboard', 'demo', 'admin-users'];
    if (protectedViews.includes(view) && !activeUser) {
      setLoginRedirectTarget(view);
      setActiveView('login');
      const targetPath = `/login?next=/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      return;
    }

    // Admin view requires admin role
    if (view === 'admin-users' && activeUser?.role !== 'admin') {
      showToast('Access Denied: Administrator role required.');
      navigateTo('dashboard');
      return;
    }

    setActiveView(view);
    let targetPath = '/';
    if (view === 'admin-users') targetPath = '/admin/users';
    else if (view !== 'landing') targetPath = `/${view}`;

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const v = getInitialView();
      navigateTo(v);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeUser]);

  // If user hits protected route directly when unauthenticated after initial check
  useEffect(() => {
    if (!authChecking) {
      const protectedViews = ['dashboard', 'demo', 'admin-users'];
      if (protectedViews.includes(activeView) && !activeUser) {
        setLoginRedirectTarget(activeView);
        setActiveView('login');
      }
    }
  }, [authChecking, activeView, activeUser]);

  // Inactivity tracking (30 min inactivity = 29m idle + 1m countdown warning)
  const resetIdleTimer = useCallback(() => {
    if (!activeUser) return;
    setShowInactivityModal(false);
    clearInterval(countdownTimerRef.current);
    clearTimeout(idleTimerRef.current);

    // 29 minutes = 1740 seconds
    idleTimerRef.current = setTimeout(() => {
      setShowInactivityModal(true);
      setInactivitySecondsLeft(60);

      countdownTimerRef.current = setInterval(() => {
        setInactivitySecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleSignOut('Session expired, please sign in again');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 29 * 60 * 1000);
  }, [activeUser]);

  useEffect(() => {
    if (!activeUser) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetIdleTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity));
    resetIdleTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimeout(idleTimerRef.current);
      clearInterval(countdownTimerRef.current);
    };
  }, [activeUser, resetIdleTimer]);

  // Sign out handler
  const handleSignOut = async (customMessage) => {
    setShowUserDropdown(false);
    setShowInactivityModal(false);
    clearTimeout(idleTimerRef.current);
    clearInterval(countdownTimerRef.current);

    await logoutUser();
    setActiveUser(null);
    showToast(customMessage || 'Successfully signed out');
    navigateTo('login');
  };

  // Sign in success callback
  const handleLoginSuccess = (user, target) => {
    setActiveUser(user);
    showToast(`Welcome back, ${user.name}`);
    if (user.must_change_password) {
      setShowPasswordModal(true);
    }
    navigateTo(target || 'dashboard');
  };

  // Fetch initial data (only if authenticated or public simulator/victim)
  const fetchData = useCallback(async () => {
    try {
      const headers = {};
      const token = getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [simRes] = await Promise.all([fetch('/api/simulator/config')]);
      if (simRes.ok) setChannelStatus(await simRes.json());

      if (activeUser) {
        const [sosRes, grpRes, statsRes] = await Promise.all([
          fetch('/api/sos/list', { headers }),
          fetch('/api/sos/groups', { headers }),
          fetch('/api/iece/stats', { headers }),
        ]);

        if (sosRes.ok) setReports(await sosRes.json());
        if (grpRes.ok) setGroups(await grpRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, [activeUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Connect WebSocket for real-time live events (authenticated with token)
  useEffect(() => {
    if (!activeUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getSessionToken();
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard${token ? `?token=${token}` : ''}`;
    let ws;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_SOS') {
            fetchData();
            showToast(`New SOS Received: Node #${msg.report?.victim_id} (${msg.report?.emergency_type_label})`);
          } else if (msg.type === 'SOS_ACCEPTED' || msg.type === 'STATUS_CHANGED') {
            fetchData();
          } else if (msg.type === 'PRIORITY_OVERRIDDEN') {
            fetchData();
            showToast(`Priority Overridden: ${msg.sos_id} set to ${msg.severity_label} by Coordinator`);
          } else if (msg.type === 'FORCE_DISCONNECT') {
            handleSignOut('Your account was disabled by an administrator');
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, [activeUser, fetchData]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.header-user-menu-wrapper')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Header Top Bar */}
      <header className="app-header">
        <div className="page-container">
          <div className="app-header-inner">
            {/* Left: Brand & Logo */}
            <div className="brand-group" onClick={() => navigateTo('landing')}>
              <div className="brand-icon-box">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div className="brand-text-block">
                <span className="brand-title">RESCUE LINK</span>
                <span className="brand-subtitle">ASTRA HACKATHON • SATELLITE & NAV CONNECTIVITY</span>
              </div>
            </div>

            {/* Centre: Nav Tabs / Pills */}
            <nav className="nav-pills-container" role="tablist" aria-label="Main Navigation">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'landing'}
                onClick={() => navigateTo('landing')}
                className={`nav-pill ${activeView === 'landing' ? 'active' : ''}`}
              >
                <Home className="w-4 h-4" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'victim'}
                onClick={() => navigateTo('victim')}
                className={`nav-pill ${activeView === 'victim' ? 'active' : ''}`}
              >
                <Radio className="w-4 h-4" />
                <span>Victim Terminal</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'dashboard'}
                onClick={() => navigateTo('dashboard')}
                className={`nav-pill ${activeView === 'dashboard' ? 'active' : ''}`}
              >
                <MapPin className="w-4 h-4" />
                <span>Rescue Dashboard</span>
                {reports.length > 0 && <span className="nav-badge">{reports.length}</span>}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'demo'}
                onClick={() => navigateTo('demo')}
                className={`nav-pill ${activeView === 'demo' ? 'active' : ''}`}
              >
                <Sliders className="w-4 h-4" />
                <span>Demo Control</span>
              </button>

              {activeUser?.role === 'admin' && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === 'admin-users'}
                  onClick={() => navigateTo('admin-users')}
                  className={`nav-pill ${activeView === 'admin-users' ? 'active' : ''}`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </button>
              )}
            </nav>

            {/* Right: Status & User Menu */}
            <div className="status-area">
              <div className={`status-chip ${wsConnected ? 'network-online' : 'network-offline'}`}>
                <span className="status-dot"></span>
                <span>Network: {wsConnected ? 'Online' : 'Offline'}</span>
              </div>

              <div className={`status-chip ${channelStatus?.is_simulated ? 'link-simulated' : 'link-real'}`}>
                <span className="status-dot"></span>
                <span>Link: {channelStatus?.is_simulated ? 'Simulated' : 'Real LoRa'}</span>
              </div>

              {/* User Menu Dropdown or Sign In Button */}
              {activeUser ? (
                <div className="header-user-menu-wrapper">
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="header-user-trigger"
                    aria-expanded={showUserDropdown}
                  >
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                    <span>{activeUser.name.split(' ')[0]}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: activeUser.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: activeUser.role === 'admin' ? '#F87171' : '#FCD34D',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {activeUser.role}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-tertiary" />
                  </button>

                  {/* Dropdown Card */}
                  {showUserDropdown && (
                    <div className="header-user-dropdown">
                      <div className="user-dropdown-header">
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {activeUser.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>
                          {activeUser.email}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-orange)', marginTop: '2px' }}>
                          {activeUser.organisation}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowPasswordModal(true);
                        }}
                        className="user-dropdown-item"
                      >
                        <KeyRound className="w-4 h-4 text-tertiary" />
                        <span>Change Password</span>
                      </button>

                      {activeUser.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => navigateTo('admin-users')}
                          className="user-dropdown-item"
                        >
                          <Users className="w-4 h-4 text-tertiary" />
                          <span>User Management</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSignOut()}
                        className="user-dropdown-item danger"
                        style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '8px' }}
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('login')}
                  className="btn btn-secondary"
                  style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Responder Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="icon-btn-round"
                title="System Architecture & Honesty Audit"
                aria-label="System Architecture & Honesty Audit"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="page-container" style={{ flex: 1, paddingBottom: '32px' }}>
        {authChecking ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <Shield className="w-8 h-8 text-orange-400 animate-pulse" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>Authenticating secure responder session...</p>
          </div>
        ) : (
          <>
            {activeView === 'landing' && <LandingView onNavigate={(view) => navigateTo(view)} />}

            {activeView === 'victim' && (
              <VictimView
                channelStatus={channelStatus}
                onSosCreated={() => {
                  fetchData();
                }}
              />
            )}

            {activeView === 'login' && (
              <LoginView
                onLoginSuccess={handleLoginSuccess}
                onNavigate={(view) => navigateTo(view)}
                redirectTarget={loginRedirectTarget}
              />
            )}

            {activeView === 'register' && (
              <RegisterView onNavigate={(view) => navigateTo(view)} />
            )}

            {activeView === 'dashboard' && activeUser && (
              <DashboardView
                reports={reports}
                groups={groups}
                activeResponder={activeUser}
                onAcceptSos={() => fetchData()}
                channelStatus={channelStatus}
              />
            )}

            {activeView === 'admin-users' && activeUser?.role === 'admin' && (
              <AdminUsersView currentUser={activeUser} onNavigate={(view) => navigateTo(view)} />
            )}

            {activeView === 'demo' && activeUser && (
              <DemoControlPanel
                channelStatus={channelStatus}
                onUpdateSimConfig={() => fetchData()}
                onResetData={() => fetchData()}
                onSeedData={() => fetchData()}
                onSendSampleTwo={() => {
                  fetchData();
                  navigateTo('dashboard');
                }}
                onSendSampleFive={() => {
                  fetchData();
                  navigateTo('dashboard');
                }}
                onTriggerScriptedStep={(step) => {
                  setActiveScriptedStep(step);
                  if (step === 1 || step === 2) navigateTo('victim');
                  else if (step === 3 || step === 4) navigateTo('dashboard');
                  else if (step === 5 || step === 6) navigateTo('victim');
                }}
                activeStep={activeScriptedStep}
              />
            )}
          </>
        )}
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        isForced={activeUser?.must_change_password}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          showToast('Password changed successfully');
          if (activeUser) {
            setActiveUser({ ...activeUser, must_change_password: false });
          }
        }}
      />

      {/* Inactivity Warning Dialog */}
      <InactivityWarningModal
        isOpen={showInactivityModal}
        secondsRemaining={inactivitySecondsLeft}
        onStayLoggedIn={resetIdleTimer}
        onLogoutNow={() => handleSignOut()}
      />

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 3000,
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--accent-orange-border)',
            borderRadius: '8px',
            padding: '12px 18px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'pulse-subtle 2s ease',
          }}
        >
          <CheckCircle className="w-4 h-4 text-orange-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Architecture & Honesty Disclosure Modal */}
      <AboutHonestyModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
    </div>
  );
}
