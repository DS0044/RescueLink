import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Database,
  Sliders,
  Send,
  Radio,
  Cpu,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  FastForward,
  ShieldX,
  Navigation,
} from 'lucide-react';
import { authFetch } from '../utils/auth';

export default function DemoControlPanel({
  channelStatus,
  onUpdateSimConfig,
  onResetData,
  onSeedData,
  onSendSampleTwo,
  onSendSampleFive,
  onTriggerScriptedStep,
  activeStep,
}) {
  const [delayMs, setDelayMs] = useState(channelStatus?.delay_ms || 650);
  const [lossRate, setLossRate] = useState(channelStatus?.packet_loss_percent || 0);
  const [linkMode, setLinkMode] = useState(channelStatus?.mode || 'SIMULATED');
  const [busyAction, setBusyAction] = useState(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [simSpeed, setSimSpeed] = useState(10); // 1, 10, 60
  const [lastSimulatedId, setLastSimulatedId] = useState('SOS-9001');

  const handleApplyConfig = async (newDelay, newLoss, newMode) => {
    const d = newDelay !== undefined ? newDelay : delayMs;
    const l = newLoss !== undefined ? newLoss : lossRate;
    const m = newMode !== undefined ? newMode : linkMode;

    await onUpdateSimConfig({
      delay_ms: Number(d),
      packet_loss_percent: Number(l),
      mode: m,
    });
    setActionFeedback(`Updated Channel: Delay ${d}ms, Packet Loss ${l}%, Mode ${m}`);
    setTimeout(() => setActionFeedback(''), 3000);
  };

  const handleAction = async (name, fn) => {
    setBusyAction(name);
    try {
      const res = await fn();
      setActionFeedback(res?.message || 'Operation executed successfully');
      setTimeout(() => setActionFeedback(''), 4000);
    } catch (err) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Simulate mission accelerator
  const handleSimulateMission = async () => {
    setBusyAction('simulateMission');
    try {
      // Find an SOS or pick first from list
      const listRes = await authFetch('/api/sos/list');
      const list = await listRes.json();
      if (!list || list.length === 0) {
        alert('Please seed or send an SOS first before simulating a mission.');
        return;
      }
      const target = list[0];
      setLastSimulatedId(target.packet_id);

      const res = await authFetch(`/api/demo/simulate-mission/${target.packet_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: simSpeed }),
      });
      const data = await res.json();
      setActionFeedback(data.message || `Mission simulated at ${simSpeed}x speed!`);
      setTimeout(() => setActionFeedback(''), 5000);
    } catch (err) {
      setActionFeedback(`Mission simulation error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Quick action: Accept with ETA 12 min
  const handleQuickAccept = async () => {
    setBusyAction('quickAccept');
    try {
      const listRes = await authFetch('/api/sos/list');
      const list = await listRes.json();
      const pending = list.find((r) => r.status === 'pending') || list[0];
      if (!pending) {
        alert('No active SOS to accept.');
        return;
      }
      const res = await authFetch(`/api/sos/${pending.packet_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responder_id: 'RESP-NDRF-01',
          responder_name: 'Capt. A. Sharma (NDRF)',
          eta_minutes: 12,
          team_type: 1, // Boat
          note_code: 1, // Stay where you are
        }),
      });
      const data = await res.json();
      setActionFeedback(`SOS ${pending.packet_id} accepted with ETA: 12 min (Boat Team)!`);
      setTimeout(() => setActionFeedback(''), 4000);
    } catch (err) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Quick action: Send ETA update (+5 min delay)
  const handleSendEtaUpdate = async () => {
    setBusyAction('etaUpdate');
    try {
      const listRes = await authFetch('/api/sos/list');
      const list = await listRes.json();
      const accepted = list.find((r) => r.status === 'accepted' || r.status === 'en_route') || list[0];
      if (!accepted) {
        alert('Please accept an SOS first to update its ETA.');
        return;
      }
      const updatedEta = (accepted.eta_minutes || 10) + 5;
      const res = await authFetch(`/api/sos/${accepted.packet_id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'eta_updated',
          eta_minutes: updatedEta,
          note_text: 'Delayed by water flow (+5 min)',
        }),
      });
      const data = await res.json();
      setActionFeedback(`ETA updated to ~${updatedEta} min for ${accepted.packet_id}`);
      setTimeout(() => setActionFeedback(''), 4000);
    } catch (err) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Quick action: Send forged downlink message
  const handleSendForgedMessage = async () => {
    setBusyAction('forgedMessage');
    try {
      const listRes = await authFetch('/api/sos/list');
      const list = await listRes.json();
      if (!list || list.length === 0) {
        alert('No SOS reports available.');
        return;
      }
      const target = list[0];
      const res = await authFetch(`/api/demo/tamper-downlink/${target.packet_id}?tamper_type=corrupt_signature`, {
        method: 'POST',
      });
      const data = await res.json();
      setActionFeedback('Forged downlink dispatched! Open /victim to see cryptographic rejection badge.');
      setTimeout(() => setActionFeedback(''), 5000);
    } catch (err) {
      setActionFeedback(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // 8-stage Message Journey stages
  const journeyStages = [
    { id: 'VICTIM', label: '1. Victim SOS', icon: Send, desc: '21B Packed' },
    { id: 'LORA_TX', label: '2. LoRa TX', icon: Radio, desc: '868.1 MHz' },
    { id: 'CHANNEL', label: '3. Channel', icon: Sliders, desc: 'Loss & ToA' },
    { id: 'GATEWAY_RX', label: '4. Gateway RX', icon: Zap, desc: 'SX1276 CRC' },
    { id: 'IECE', label: '5. IECE Engine', icon: Cpu, desc: 'P1 Triage' },
    { id: 'DASHBOARD', label: '6. Dashboard', icon: Activity, desc: 'Live Map' },
    { id: 'RESPONDER_ACK', label: '7. Ed25519 Sign', icon: ShieldCheck, desc: 'Private Key' },
    { id: 'DOWNLINK', label: '8. Victim Ack', icon: CheckCircle2, desc: 'Verified' },
  ];

  return (
    <div className="demo-page-wrapper">
      {/* Top Banner Card */}
      <div className="card card-accent-top">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sliders className="w-5 h-5 text-orange-500" />
              <h2 className="text-section-title">Evaluator Demo Control Center</h2>
            </div>
            <p className="text-helper">
              Interactive test bench to simulate physical LoRa RF parameters and trigger end-to-end mission scenarios.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-chip ${channelStatus?.is_simulated ? 'link-simulated' : 'link-real'}`}>
              <span className="status-dot"></span>
              <span>{channelStatus?.is_simulated ? 'Link: Simulated' : 'Link: Real LoRa'}</span>
            </span>
          </div>
        </div>

        {actionFeedback && (
          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--accent-orange-subtle)', border: '1px solid var(--accent-orange-border)', color: 'var(--accent-orange)', fontSize: '13px', fontWeight: 600 }}>
            {actionFeedback}
          </div>
        )}
      </div>

      {/* SPEC SECTION 6: RESCUE MISSION ACCELERATOR */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FastForward className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">Mission Accelerator & Downlink Controls</h3>
          </div>
          <span className="badge-priority p2">SIMULATION ACCELERATOR</span>
        </div>

        <p className="text-helper" style={{ marginBottom: '16px' }}>
          Automatically step through the full lifecycle: <strong>Pending &gt; Accepted &gt; En Route &gt; Arriving Soon (&lt;5m) &gt; Arrived</strong>. Accelerate time so evaluators can inspect every signed downlink update in under 60 seconds.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Speed Multiplier</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 10, 60].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSimSpeed(spd)}
                  className={`btn ${simSpeed === spd ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: '32px', fontSize: '12px', flex: 1, padding: 0 }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <button
              type="button"
              disabled={busyAction === 'simulateMission'}
              onClick={handleSimulateMission}
              className="btn btn-primary"
              style={{ height: '42px', fontWeight: 700 }}
            >
              <Play className="w-4 h-4" />
              <span>{busyAction === 'simulateMission' ? 'Accelerating...' : 'Simulate Rescue Mission'}</span>
            </button>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <button
              type="button"
              disabled={busyAction === 'quickAccept'}
              onClick={handleQuickAccept}
              className="btn btn-secondary"
              style={{ height: '42px', fontSize: '12px' }}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Accept with ETA 12 min</span>
            </button>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <button
              type="button"
              disabled={busyAction === 'forgedMessage'}
              onClick={handleSendForgedMessage}
              className="btn btn-danger"
              style={{ height: '42px', fontSize: '12px' }}
            >
              <ShieldX className="w-4 h-4" />
              <span>Send Forged Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Message Journey Timeline */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">Live Message Journey Pipeline</h3>
          </div>
          <span className="text-helper">Full bidirectional traversal: Victim SOS (21B) &rarr; Gateway &rarr; IECE &rarr; Responder &rarr; Downlink (80B)</span>
        </div>

        <div className="journey-timeline-row">
          {journeyStages.map((stg, idx) => {
            const Icon = stg.icon;
            const isPassed = idx < 6;
            return (
              <React.Fragment key={stg.id}>
                <div className={`journey-node ${isPassed ? 'active' : ''}`}>
                  <div className="journey-node-icon">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="journey-node-label">{stg.label}</span>
                  <span className="journey-node-sub">{stg.desc}</span>
                </div>
                {idx < journeyStages.length - 1 && (
                  <div className={`journey-connector ${isPassed ? 'active' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Numbered Step-by-Step Scripted Walkthrough */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">Scripted Evaluator Sequence</h3>
          </div>
          <span className="text-helper">Click each step in order for a guided demonstration</span>
        </div>

        <div className="step-grid">
          <button
            type="button"
            onClick={() => onTriggerScriptedStep(1)}
            className="step-card-btn"
          >
            <div className="step-number-badge">1</div>
            <div className="step-content">
              <span className="step-title">1. Victim Sends SOS</span>
              <span className="step-desc">Simulates a victim trapped in flood sending a 21-byte packet.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(2)}
            className="step-card-btn"
          >
            <div className="step-number-badge">2</div>
            <div className="step-content">
              <span className="step-title">2. LoRa Propagation</span>
              <span className="step-desc">Transmits CSS SF10 chirp over 868MHz with simulated ToA delay.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(3)}
            className="step-card-btn"
          >
            <div className="step-number-badge">3</div>
            <div className="step-content">
              <span className="step-title">3. IECE Engine Triage</span>
              <span className="step-desc">Decode 21B struct, evaluate P1-P4 priority, check deduplication.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(4)}
            className="step-card-btn"
          >
            <div className="step-number-badge">4</div>
            <div className="step-content">
              <span className="step-title">4. Open Rescue Map</span>
              <span className="step-desc">Incident plotted on live dark map with priority color badge.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(5)}
            className="step-card-btn"
          >
            <div className="step-number-badge">5</div>
            <div className="step-content">
              <span className="step-title">5. Accept & Ed25519 Sign</span>
              <span className="step-desc">Commander accepts; backend generates 80B signed downlink.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(6)}
            className="step-card-btn"
          >
            <div className="step-number-badge" style={{ backgroundColor: '#DC2626' }}>6</div>
            <div className="step-content">
              <span className="step-title">6. Test Tampered Ack</span>
              <span className="step-desc">Verify forged payloads are cryptographically rejected.</span>
            </div>
          </button>
        </div>
      </div>

      {/* IECE Scenario Triggers */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">IECE Algorithmic Scenario Tests</h3>
          </div>
          <span className="text-helper">Automated priority preemption & duplicate grouping</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Priority Preemption Test</h4>
              <span className="badge-priority p1">P1 vs P3</span>
            </div>
            <p className="text-helper">
              Sends <strong>Stranded (P3)</strong> at t=0s, followed by <strong>Heart Attack (P1)</strong> at t=+10s. 
              Visibly proves the IECE Priority Queue preempts the list to process cardiac emergency first.
            </p>
            <button
              type="button"
              onClick={() => handleAction('sampleTwo', onSendSampleTwo)}
              disabled={busyAction === 'sampleTwo'}
              className="btn btn-primary"
              style={{ marginTop: 'auto', height: '40px' }}
            >
              {busyAction === 'sampleTwo' ? 'Processing...' : 'Send Two Sample Emergencies (P1 vs P3)'}
            </button>
          </div>

          <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Duplicate Cluster Grouping</h4>
              <span className="badge-priority p2">Radius &lt; 50m</span>
            </div>
            <p className="text-helper">
              Generates <strong>5 nearby flood reports</strong> within a 40-meter radius. 
              Visibly proves IECE groups them into one cluster card while preserving all individual records.
            </p>
            <button
              type="button"
              onClick={() => handleAction('sampleFive', onSendSampleFive)}
              disabled={busyAction === 'sampleFive'}
              className="btn btn-primary"
              style={{ marginTop: 'auto', height: '40px' }}
            >
              {busyAction === 'sampleFive' ? 'Generating...' : 'Generate 5 Nearby Flood SOS (Cluster Group)'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Controls & Reset/Seed */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">LoRa Physical Channel Simulator Controls</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextMode = linkMode === 'SIMULATED' ? 'REAL_HARDWARE' : 'SIMULATED';
              setLinkMode(nextMode);
              handleApplyConfig(undefined, undefined, nextMode);
            }}
            className="btn btn-secondary"
            style={{ height: '32px', fontSize: '12px' }}
          >
            Toggle Mode: {linkMode}
          </button>
        </div>

        <div className="sim-controls-grid">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
              <span className="text-muted">Simulated Time-on-Air & Latency</span>
              <span className="font-mono" style={{ color: 'var(--accent-orange)' }}>{delayMs} ms</span>
            </div>
            <input
              type="range"
              min="50"
              max="3000"
              step="50"
              value={delayMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDelayMs(val);
                handleApplyConfig(val, undefined, undefined);
              }}
              className="custom-range-slider"
            />
            <span className="text-helper" style={{ display: 'block', marginTop: '6px' }}>
              Standard LoRa CSS SF10 / BW125 ToA: 450ms - 850ms
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
              <span className="text-muted">Simulated Packet Loss Rate</span>
              <span className="font-mono" style={{ color: lossRate > 0 ? '#EF4444' : '#10B981' }}>{lossRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={lossRate}
              onChange={(e) => {
                const val = Number(e.target.value);
                setLossRate(val);
                handleApplyConfig(undefined, val, undefined);
              }}
              className="custom-range-slider"
            />
            <span className="text-helper" style={{ display: 'block', marginTop: '6px' }}>
              Set &gt;0% to test RF drop and victim retransmission
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-helper">Reset database or restore realistic disaster seed dataset</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleAction('reset', onResetData)}
              disabled={busyAction === 'reset'}
              className="btn btn-secondary"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Demo Data</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction('seed', onSeedData)}
              disabled={busyAction === 'seed'}
              className="btn btn-primary"
            >
              <Database className="w-4 h-4" />
              <span>Seed Sample Emergencies</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
