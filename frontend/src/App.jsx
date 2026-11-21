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
} from 'lucide-react';

import VictimView from './components/VictimView';
import DashboardView from './components/DashboardView';
import DemoControlPanel from './components/DemoControlPanel';
import AboutHonestyModal from './components/AboutHonestyModal';

export default function App() {
  const [activeView, setActiveView] = useState('victim'); // 'victim', 'dashboard', 'demo'
  const [reports, setReports] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);
  const [activeResponder, setActiveResponder] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeScriptedStep, setActiveScriptedStep] = useState(null);

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
          } else if (msg.type === 'SOS_ACCEPTED') {
            fetchData();
          } else if (msg.type === 'SIM_CONFIG_UPDATED') {
            setChannelStatus(msg.config);
          } else if (msg.type === 'ACK_TAMPERED') {
            fetchData();
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
      }
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setActiveResponder(null);
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
    return await res.json();
  };

  // Handler: Seed Data
  const handleSeedData = async () => {
    const res = await fetch('/api/demo/seed', { method: 'POST' });
    await fetchData();
    return await res.json();
  };

  // Handler: Sample Two (P1 vs P3 priority test)
  const handleSendSampleTwo = async () => {
    const res = await fetch('/api/demo/sample-two', { method: 'POST' });
    await fetchData();
    setActiveView('dashboard');
    return await res.json();
  };

  // Handler: Sample Five (Flood cluster grouping test)
  const handleSendSampleFive = async () => {
    const res = await fetch('/api/demo/sample-five', { method: 'POST' });
    await fetchData();
    setActiveView('dashboard');
    return await res.json();
  };

  // Handler: Scripted Walkthrough Sequence
  const handleTriggerScriptedStep = (stepNumber) => {
    setActiveScriptedStep(stepNumber);
    if (stepNumber === 1) {
      setActiveView('victim');
    } else if (stepNumber === 2) {
      setActiveView('victim');
    } else if (stepNumber === 3) {
      setActiveView('dashboard');
    } else if (stepNumber === 4) {
      setActiveView('dashboard');
      if (!activeResponder) {
        handleLogin('RESP-NDRF-01');
      }
    } else if (stepNumber === 5) {
      setActiveView('victim');
    } else if (stepNumber === 6) {
      setActiveView('victim');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/40">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-wider">RESCUE LINK</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 font-bold border border-orange-800">
                  ASTRA HACKATHON
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Offline Emergency Communication & Coordination Engine (IECE)</p>
            </div>
          </div>

          {/* View Switcher Navigation */}
          <nav className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveView('victim')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeView === 'victim'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Victim SOS Terminal
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeView === 'dashboard'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Rescue Dashboard ({reports.length})
            </button>
            <button
              onClick={() => setActiveView('demo')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeView === 'demo'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Demo Control Panel
            </button>
          </nav>

          {/* Badges & Auditing Modal Trigger */}
          <div className="flex items-center gap-2.5">
            {/* Live WS Status */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400" title={wsConnected ? 'WebSocket Live Telemetry Active' : 'WebSocket Reconnecting...'}>
              {wsConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
              <span className="hidden sm:inline">{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>

            {/* Simulated Badge */}
            <span className={`badge ${channelStatus?.is_simulated ? 'badge-simulated' : 'badge-real'}`}>
              {channelStatus?.is_simulated ? 'SIMULATED LINK' : 'REAL LORA'}
            </span>

            {/* Architecture Audit Modal */}
            <button
              onClick={() => setShowAboutModal(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              title="System Architecture & Honesty Disclosure"
            >
              <Info className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main App Content */}
      <main className="max-w-7xl mx-auto px-4 pt-6 flex-1 w-full">
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

      {/* Honesty & Architecture Audit Modal */}
      <AboutHonestyModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
}
