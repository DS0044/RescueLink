import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  MapPin,
  Sliders,
  Shield,
  Layers,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  Wifi,
  WifiOff,
  Home,
} from 'lucide-react';

import LandingView from './components/LandingView';
import VictimView from './components/VictimView';
import DashboardView from './components/DashboardView';
import DemoControlPanel from './components/DemoControlPanel';
import AboutHonestyModal from './components/AboutHonestyModal';

const getInitialView = () => {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('victim')) return 'victim';
  if (path.includes('demo')) return 'demo';
  return 'landing';
};

export default function App() {
  const [activeView, setActiveView] = useState(getInitialView);
  const [reports, setReports] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);
  const [activeResponder, setActiveResponder] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeScriptedStep, setActiveScriptedStep] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const navigateTo = (view) => {
    setActiveView(view);
    const targetPath = view === 'landing' ? '/' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [sosRes, grpRes, simRes, statsRes] = await Promise.all([
        fetch('/api/sos/list'),
        fetch('/api/sos/groups'),
        fetch('/api/simulator/config'),
        fetch('/api/iece/stats'),
      ]);

      if (sosRes.ok) setReports(await sosRes.json());
      if (grpRes.ok) setGroups(await grpRes.json());
      if (simRes.ok) setChannelStatus(await simRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Connect WebSocket for real-time live events
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;
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
          } else if (msg.type === 'SOS_ACCEPTED') {
            fetchData();
            showToast(`Rescue Mission Accepted by ${msg.responder_name}`);
          } else if (msg.type === 'SIM_CONFIG_UPDATED') {
            setChannelStatus(msg.config);
          } else if (msg.type === 'ACK_TAMPERED') {
            fetchData();
            showToast(`[Security Test] Acknowledgement payload altered`);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, [fetchData]);

  // Handler: Responder Login
  const handleLogin = async (responderId) => {
    try {
      const res = await fetch('/api/auth/responder-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responder_id: responderId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveResponder(data);
        showToast(`Authenticated: ${data.responder_name}`);
      }
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setActiveResponder(null);
    showToast('Responder signed out');
  };

  // Handler: Accept SOS
  const handleAcceptSos = async (sosId, responder) => {
    try {
      const res = await fetch(`/api/sos/${sosId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responder_id: responder.responder_id,
          responder_name: responder.responder_name,
          eta_minutes: 12,
        }),
      });
      if (res.ok) {
        fetchData();
        showToast(`Signed Ed25519 acknowledgement for ${sosId}`);
      }
    } catch (err) {
      alert(`Accept failed: ${err.message}`);
    }
  };

  // Handler: Update Simulator Config
  const handleUpdateSimConfig = async (config) => {
    try {
      const res = await fetch('/api/simulator/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelStatus(data);
      }
    } catch (err) {
      console.error('Error updating sim config:', err);
    }
  };

  // Handler: Reset Data
  const handleResetData = async () => {
    const res = await fetch('/api/demo/reset', { method: 'POST' });
    await fetchData();
    showToast('Demo data reset to clean slate');
    return await res.json();
  };

  // Handler: Seed Data
  const handleSeedData = async () => {
    const res = await fetch('/api/demo/seed', { method: 'POST' });
    await fetchData();
    showToast('Loaded disaster scenario seed dataset');
    return await res.json();
  };

  // Handler: Sample Two (P1 vs P3 priority test)
  const handleSendSampleTwo = async () => {
    const res = await fetch('/api/demo/sample-two', { method: 'POST' });
    await fetchData();
    setActiveView('dashboard');
    showToast('Sample Two dispatched: Cardiac (P1) preempts Stranded (P3)!');
    return await res.json();
  };

  // Handler: Sample Five (Flood cluster grouping test)
  const handleSendSampleFive = async () => {
    const res = await fetch('/api/demo/sample-five', { method: 'POST' });
    await fetchData();
    setActiveView('dashboard');
    showToast('Sample Five generated: Auto-grouped into single cluster card!');
    return await res.json();
  };

  // Handler: Scripted Walkthrough Sequence
  const handleTriggerScriptedStep = (stepNumber) => {
    setActiveScriptedStep(stepNumber);
    if (stepNumber === 1 || stepNumber === 2) {
      navigateTo('victim');
    } else if (stepNumber === 3 || stepNumber === 4) {
      navigateTo('dashboard');
      if (stepNumber === 4 && !activeResponder) {
        handleLogin('RESP-NDRF-01');
      }
    } else if (stepNumber === 5 || stepNumber === 6) {
      navigateTo('victim');
    }
  };

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
                <span className="nav-badge">{reports.length}</span>
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
            </nav>

            {/* Right: Status Group */}
            <div className="status-area">
              <div className={`status-chip ${wsConnected ? 'network-online' : 'network-offline'}`}>
                <span className="status-dot"></span>
                <span>Network: {wsConnected ? 'Online' : 'Offline'}</span>
              </div>

              <div className={`status-chip ${channelStatus?.is_simulated ? 'link-simulated' : 'link-real'}`}>
                <span className="status-dot"></span>
                <span>Link: {channelStatus?.is_simulated ? 'Simulated' : 'Real LoRa'}</span>
              </div>

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

      {/* Main Page Container */}
      <main className="page-container" style={{ flex: 1, paddingBottom: '32px' }}>
        {activeView === 'landing' && (
          <LandingView onNavigate={(view) => navigateTo(view)} />
        )}

        {activeView === 'victim' && (
          <VictimView
            channelStatus={channelStatus}
            onSosCreated={() => {
              fetchData();
            }}
          />
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            reports={reports}
            groups={groups}
            activeResponder={activeResponder}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onAcceptSos={handleAcceptSos}
            channelStatus={channelStatus}
          />
        )}

        {activeView === 'demo' && (
          <DemoControlPanel
            channelStatus={channelStatus}
            onUpdateSimConfig={handleUpdateSimConfig}
            onResetData={handleResetData}
            onSeedData={handleSeedData}
            onSendSampleTwo={handleSendSampleTwo}
            onSendSampleFive={handleSendSampleFive}
            onTriggerScriptedStep={handleTriggerScriptedStep}
            activeStep={activeScriptedStep}
          />
        )}
      </main>

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div style={{
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
        }}>
          <CheckCircle className="w-4 h-4 text-orange-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Architecture & Honesty Disclosure Modal */}
      <AboutHonestyModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
}
