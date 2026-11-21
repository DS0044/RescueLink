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
    { id: 'VICTIM', label: '1. Victim SOS', icon: Send, desc: 'Browser GNSS + 21B Pack' },
    { id: 'LORA_TX', label: '2. LoRa TX', icon: Radio, desc: '868MHz CSS SF10' },
    { id: 'CHANNEL', label: '3. Channel Sim', icon: Sliders, desc: 'Time-on-Air & Loss' },
    { id: 'GATEWAY_RX', label: '4. Gateway RX', icon: Zap, desc: 'SX1276 SNR/RSSI CRC' },
    { id: 'IECE', label: '5. IECE Engine', icon: Cpu, desc: 'Priority & Grouping' },
    { id: 'DASHBOARD', label: '6. Dashboard', icon: Activity, desc: 'Live Map & Triage' },
    { id: 'RESPONDER_ACK', label: '7. Ed25519 Sign', icon: ShieldCheck, desc: 'Commander Private Key' },
    { id: 'DOWNLINK', label: '8. Victim Ack', icon: CheckCircle2, desc: 'Public Key Verified' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Card */}
      <div className="card" style={{ borderLeft: '4px solid #ff6600' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-black text-white tracking-wide">HACKATHON DEMO CONTROL PANEL</h2>
            </div>
            <p className="text-xs text-slate-300">
              Scripted evaluator walkthrough sequence, physical LoRa channel parameters, and live telemetry feed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${channelStatus?.is_simulated ? 'badge-simulated' : 'badge-real'}`}>
              {channelStatus?.is_simulated ? 'SIMULATED LINK' : 'REAL LORA'}
            </span>
          </div>
        </div>

        {actionFeedback && (
          <div className="mt-3 p-2 bg-orange-950/60 border border-orange-700/60 rounded text-xs text-orange-300 font-semibold animate-pulse">
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Live Message Journey Visualizer */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          End-to-End "Message Journey" Architecture Flow
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {journeyStages.map((stg, idx) => {
            const Icon = stg.icon;
            const isCurrent = activeStep === idx + 1;
            return (
              <div
                key={stg.id}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isCurrent
                    ? 'bg-orange-600/30 border-orange-500 shadow-lg scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${isCurrent ? 'text-orange-400 animate-bounce' : 'text-slate-400'}`} />
                <div className="font-bold text-xs text-white leading-tight">{stg.label}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono leading-tight">{stg.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scripted Evaluator Sequence Walkthrough */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4 text-orange-400" />
            Scripted Demo Walkthrough Buttons
          </h3>
          <span className="text-xs text-slate-400">Click in sequence for live demonstration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => onTriggerScriptedStep(1)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">1</div>
            <div>
              <div className="text-xs font-bold text-white">Send Victim SOS</div>
              <div className="text-[11px] text-slate-400">Generates 21B packet over simulated LoRa link</div>
            </div>
          </button>

          <button
            onClick={() => onTriggerScriptedStep(2)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">2</div>
            <div>
              <div className="text-xs font-bold text-white">Inspect 21B Packet</div>
              <div className="text-[11px] text-slate-400">View raw hex and byte-by-byte struct layout</div>
            </div>
          </button>

          <button
            onClick={() => onTriggerScriptedStep(3)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">3</div>
            <div>
              <div className="text-xs font-bold text-white">Open Triage Dashboard</div>
              <div className="text-[11px] text-slate-400">Review prioritized map and cluster groups</div>
            </div>
          </button>

          <button
            onClick={() => onTriggerScriptedStep(4)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">4</div>
            <div>
              <div className="text-xs font-bold text-white">Responder Acceptance</div>
              <div className="text-[11px] text-slate-400">Login and sign Ed25519 digital acknowledgement</div>
            </div>
          </button>

          <button
            onClick={() => onTriggerScriptedStep(5)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">5</div>
            <div>
              <div className="text-xs font-bold text-white">Verify Downlink Ack</div>
              <div className="text-[11px] text-slate-400">Victim terminal validates Ed25519 signature</div>
            </div>
          </button>

          <button
            onClick={() => onTriggerScriptedStep(6)}
            className="btn btn-secondary text-left p-3.5 flex items-start gap-3 hover:border-orange-500"
          >
            <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">6</div>
            <div>
              <div className="text-xs font-bold text-white">Test Tampered Ack</div>
              <div className="text-[11px] text-slate-400">Verify forged ack is detected and rejected</div>
            </div>
          </button>
        </div>
      </div>

      {/* IECE Engine Live Demonstrations */}
      <div className="card space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-orange-400" />
          IECE Engine Scenario Test Triggers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Button B: Send Two Sample Emergencies */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">Priority Preemption Check</h4>
              <span className="badge bg-red-950 text-red-300 border-red-800">P1 vs P3</span>
            </div>
            <p className="text-xs text-slate-300">
              Sends <strong>Stranded (P3)</strong> first at t=0, followed by <strong>Heart Attack (P1)</strong> at t=+10s.
              Visibly proves the IECE Priority Queue preempts the queue to process the Cardiac emergency first.
            </p>
            <button
              onClick={() => handleAction('sampleTwo', onSendSampleTwo)}
              disabled={busyAction === 'sampleTwo'}
              className="btn btn-primary text-xs py-2 w-full font-bold"
            >
              {busyAction === 'sampleTwo' ? 'Sending...' : 'Send Two Sample Emergencies (P1 vs P3)'}
            </button>
          </div>

          {/* Button C: Generate 5 Nearby SOS Reports */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">Duplicate Cluster Grouping</h4>
              <span className="badge bg-orange-950 text-orange-300 border-orange-800">Radius &lt; 50m</span>
            </div>
            <p className="text-xs text-slate-300">
              Generates <strong>5 nearby flood reports</strong> within a 40-meter radius.
              Visibly proves IECE groups them into one aggregate cluster card while preserving individual victim records.
            </p>
            <button
              onClick={() => handleAction('sampleFive', onSendSampleFive)}
              disabled={busyAction === 'sampleFive'}
              className="btn btn-primary text-xs py-2 w-full font-bold"
            >
              {busyAction === 'sampleFive' ? 'Generating...' : 'Generate 5 Nearby Flood SOS (Cluster Group)'}
            </button>
          </div>
        </div>
      </div>

      {/* LoRa Channel & Hardware Simulation Parameters */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-400" />
            LoRa Physical Channel Simulator Controls
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMode = linkMode === 'SIMULATED' ? 'REAL_HARDWARE' : 'SIMULATED';
                setLinkMode(nextMode);
                handleApplyConfig(undefined, undefined, nextMode);
              }}
              className={`text-xs px-2.5 py-1 rounded font-bold border transition-colors ${
                linkMode === 'SIMULATED' ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-emerald-950 text-emerald-300 border-emerald-700'
              }`}
            >
              Toggle Mode: {linkMode}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>Simulated Time-on-Air & Latency</span>
              <span className="font-mono text-orange-400">{delayMs} ms</span>
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
              className="w-full accent-orange-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 block mt-1">Realistic LoRa SF10 Time-on-Air: 450ms - 850ms</span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>Simulated Packet Loss Rate</span>
              <span className={`font-mono ${lossRate > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{lossRate}%</span>
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
              className="w-full accent-orange-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 block mt-1">Set &gt;0% to test RF drop & retransmission</span>
          </div>
        </div>

        {/* Channel Metrics / Hardware bridge */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800">
          <div>
            <span className="text-slate-400 block">RF Frequency:</span>
            <span className="text-white font-bold">{channelStatus?.frequency_mhz || 868.1} MHz</span>
          </div>
          <div>
            <span className="text-slate-400 block">Modulation:</span>
            <span className="text-white font-bold">SF{channelStatus?.spreading_factor || 10} / BW{channelStatus?.bandwidth_khz || 125}k</span>
          </div>
          <div>
            <span className="text-slate-400 block">Packets TX:</span>
            <span className="text-emerald-400 font-bold">{channelStatus?.stats?.packets_transmitted || 0}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Packets Dropped:</span>
            <span className="text-red-400 font-bold">{channelStatus?.stats?.packets_dropped || 0}</span>
          </div>
        </div>
      </div>

      {/* State & Reset Controls */}
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-400">
          Ensure demo never starts empty. Seed fresh flood disaster data or reset cleanly before evaluator evaluation.
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction('reset', onResetData)}
            disabled={busyAction === 'reset'}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 hover:text-red-400"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
          <button
            onClick={() => handleAction('seed', onSeedData)}
            disabled={busyAction === 'seed'}
            className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5 font-bold"
          >
            <Database className="w-3.5 h-3.5" />
            Seed Sample Emergencies
          </button>
        </div>
      </div>
    </div>
  );
}
