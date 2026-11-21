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
} from 'lucide-react';

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

      {/* Message Journey Timeline Card */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">Message Journey Architecture Flow</h3>
          </div>
          <span className="text-helper">Live transmission path verification</span>
        </div>

        <div className="journey-nodes-row">
          {journeyStages.map((stg, idx) => {
            const Icon = stg.icon;
            const isCurrent = activeStep === idx + 1;
            return (
              <div
                key={stg.id}
                className={`journey-node-box ${isCurrent ? 'active' : ''}`}
              >
                <Icon className={`w-5 h-5 ${isCurrent ? 'text-orange-500' : 'text-slate-400'}`} />
                <div className="journey-node-title">{stg.label}</div>
                <div className="journey-node-sub">{stg.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scripted Walkthrough Sequence Grid */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play className="w-5 h-5 text-orange-500" />
            <h3 className="card-header-title">Scripted Evaluator Walkthrough</h3>
          </div>
          <span className="text-helper">Click each step to guide evaluator evaluation</span>
        </div>

        <div className="scripted-steps-grid">
          <button
            type="button"
            onClick={() => onTriggerScriptedStep(1)}
            className="step-card-btn"
          >
            <div className="step-number-badge">1</div>
            <div className="step-content">
              <span className="step-title">Send Victim SOS</span>
              <span className="step-desc">Encodes survival telemetry into exact 21-byte binary packet.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(2)}
            className="step-card-btn"
          >
            <div className="step-number-badge">2</div>
            <div className="step-content">
              <span className="step-title">Inspect 21B Packet</span>
              <span className="step-desc">Inspect raw hex and byte-by-byte struct breakdown.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(3)}
            className="step-card-btn"
          >
            <div className="step-number-badge">3</div>
            <div className="step-content">
              <span className="step-title">Open Triage Dashboard</span>
              <span className="step-desc">Live OpenStreetMap with priority triage & duplicate clusters.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(4)}
            className="step-card-btn"
          >
            <div className="step-number-badge">4</div>
            <div className="step-content">
              <span className="step-title">Responder Acceptance</span>
              <span className="step-desc">Authorize commander and generate Ed25519 digital signature.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(5)}
            className="step-card-btn"
          >
            <div className="step-number-badge">5</div>
            <div className="step-content">
              <span className="step-title">Verify Signed Ack</span>
              <span className="step-desc">Victim terminal validates Ed25519 signature in browser.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScriptedStep(6)}
            className="step-card-btn"
          >
            <div className="step-number-badge" style={{ backgroundColor: '#DC2626' }}>6</div>
            <div className="step-content">
              <span className="step-title">Test Tampered Ack</span>
              <span className="step-desc">Verify forged or modified payloads are cryptographically rejected.</span>
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
