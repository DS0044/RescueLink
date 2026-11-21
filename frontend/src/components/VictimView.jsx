import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Send,
  Navigation,
  Users,
  ShieldCheck,
  ShieldX,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Cpu,
  KeyRound,
  FileCode,
} from 'lucide-react';
import PacketInspector from './PacketInspector';
import { verifySignedAcknowledgement } from '../utils/crypto';

export default function VictimView({ onSosCreated, channelStatus }) {
  // Form state
  const [emergencyType, setEmergencyType] = useState(2); // default: Trapped in Flood
  const [peopleCount, setPeopleCount] = useState(1);
  const [latitude, setLatitude] = useState(13.0827);
  const [longitude, setLongitude] = useState(80.2707);
  const [isManualGps, setIsManualGps] = useState(true);
  const [gpsAge, setGpsAge] = useState(6);
  const [gpsStatus, setGpsStatus] = useState('Manual Fallback (Chennai Flood Basin)');

  // Submission & Transmission state
  const [sending, setSending] = useState(false);
  const [activeSOS, setActiveSOS] = useState(null);
  const [transmissionStage, setTransmissionStage] = useState('IDLE'); // IDLE, LORA_TX, GATEWAY_RX, PENDING, ACCEPTED, DROPPED
  const [ackDetails, setAckDetails] = useState(null);
  const [cryptoVerification, setCryptoVerification] = useState(null);
  const [tampering, setTampering] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  // Acquire real browser GPS when requested
  const acquireBrowserGps = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('Acquiring GNSS satellite fix...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          setIsManualGps(false);
          setGpsAge(0);
          setGpsStatus(`GNSS Fix Acquired (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`);
        },
        (err) => {
          setGpsStatus(`GPS Warning: ${err.message}. Using manual fallback.`);
          setIsManualGps(true);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setGpsStatus('Browser Geolocation unavailable; using manual fallback.');
    }
  };

  // Poll for acknowledgement when active SOS is in pending stage
  useEffect(() => {
    if (!activeSOS || transmissionStage === 'ACCEPTED' || transmissionStage === 'DROPPED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sos/${activeSOS.packet_id}/ack`);
        if (res.ok) {
          const data = await res.json();
          if (data.accepted && data.signed_ack) {
            setAckDetails(data);
            // Verify Ed25519 signature on client side
            const verResult = await verifySignedAcknowledgement(data.signed_ack);
            setCryptoVerification(verResult);

            if (verResult.isValid) {
              setTransmissionStage('ACCEPTED');
            } else {
              // Tampered or invalid signature!
              setTransmissionStage('PENDING'); // MUST NOT BE ACCEPTED
            }
          }
        }
      } catch (err) {
        console.error('Error polling for ack:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSOS, transmissionStage]);

  const handleSendSOS = async (e) => {
    e.preventDefault();
    setSending(true);
    setTransmissionStage('LORA_TX');
    setAckDetails(null);
    setCryptoVerification(null);

    const payload = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      emergency_type: Number(emergencyType),
      people_count: Number(peopleCount),
      gps_age_sec: Number(gpsAge),
      is_simulated: channelStatus?.is_simulated ?? true,
    };

    try {
      const res = await fetch('/api/sos/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.status === 'dropped') {
        setTransmissionStage('DROPPED');
        setActiveSOS(data);
      } else {
        setActiveSOS(data);
        setTransmissionStage('PENDING');
        if (onSosCreated) onSosCreated(data);
      }
    } catch (err) {
      alert(`Transmission failed: ${err.message}`);
      setTransmissionStage('IDLE');
    } finally {
      setSending(false);
    }
  };

  const handleTamperTest = async () => {
    if (!activeSOS) return;
    setTampering(true);
    try {
      const res = await fetch(`/api/demo/tamper-ack/${activeSOS.packet_id}?tamper_type=modify_field`, {
        method: 'POST',
      });
      const data = await res.json();
      // Refetch ack to see the tampered payload
      const ackRes = await fetch(`/api/sos/${activeSOS.packet_id}/ack`);
      const ackData = await ackRes.json();
      setAckDetails(ackData);

      const verResult = await verifySignedAcknowledgement(ackData.signed_ack);
      setCryptoVerification(verResult);
      // Because verification failed, transmission stage stays or reverts to PENDING
      setTransmissionStage('PENDING');
    } catch (err) {
      alert(`Tamper request failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  const resetForm = () => {
    setActiveSOS(null);
    setTransmissionStage('IDLE');
    setAckDetails(null);
    setCryptoVerification(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="card text-center relative overflow-hidden" style={{ borderTop: '4px solid #ff6600' }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Radio className="w-6 h-6 text-orange-500 animate-pulse" />
          <h2 className="text-2xl font-black text-white tracking-wide">VICTIM SOS BEACON</h2>
        </div>
        <p className="text-sm text-slate-300">
          Direct emergency transmitter terminal. Encodes telemetry into 21-byte LoRa packets.
        </p>

        <div className="mt-3 flex items-center justify-center gap-3">
          <span className={`badge ${channelStatus?.is_simulated ? 'badge-simulated' : 'badge-real'}`}>
            {channelStatus?.is_simulated ? 'SIMULATED LINK' : 'REAL LORA'}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Modulation: CSS SF10 / BW 125kHz
          </span>
        </div>
      </div>

      {/* SOS Form or Active Transmission Status */}
      {transmissionStage === 'IDLE' ? (
        <form onSubmit={handleSendSOS} className="card space-y-5">
          {/* Emergency Type Selector */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
              Emergency Condition
            </label>
            <select
              value={emergencyType}
              onChange={(e) => setEmergencyType(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 text-base font-semibold focus:border-orange-500 focus:outline-none"
            >
              <option value="1">⚠️ HEART ATTACK (P1 - Life Threatening)</option>
              <option value="2">🌊 TRAPPED IN FLOOD (P2 - Urgent Rescue)</option>
              <option value="3">🩹 INJURED / TRAUMA (P2 - Urgent Medical)</option>
              <option value="4">💊 MEDICAL NEED (P3 - Assistance Required)</option>
              <option value="5">🧗 STRANDED GENERAL (P3 - Needs Help)</option>
              <option value="6">📡 CHECK-IN / ALL OK (P4 - Low Priority)</option>
            </select>
          </div>

          {/* People Count */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              Number of People Needing Extraction
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="20"
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
                className="w-full accent-orange-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-2xl font-black text-orange-400 w-12 text-center bg-slate-900 px-3 py-1 rounded border border-slate-700">
                {peopleCount}
              </span>
            </div>
          </div>

          {/* Location & GPS Fix */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-orange-400" />
                GNSS / GPS Coordinates
              </label>
              <button
                type="button"
                onClick={acquireBrowserGps}
                className="text-xs text-orange-400 hover:text-orange-300 font-semibold px-2.5 py-1 rounded bg-orange-950/40 border border-orange-800/40 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Use Live Browser GPS
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Latitude (°N/S)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => {
                    setLatitude(e.target.value);
                    setIsManualGps(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-sm font-mono focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Longitude (°E/W)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => {
                    setLongitude(e.target.value);
                    setIsManualGps(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-sm font-mono focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              <span>{gpsStatus}</span>
            </p>
          </div>

          {/* Big Emergency SOS Button */}
          <button
            type="submit"
            disabled={sending}
            className="w-full btn-primary py-4 text-xl font-black uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #ff6600 0%, #e65100 100%)',
              border: '2px solid #ff8533',
              boxShadow: '0 0 25px rgba(255, 102, 0, 0.4)',
            }}
          >
            <AlertTriangle className="w-6 h-6 animate-bounce" />
            {sending ? 'Transmitting Over LoRa...' : 'SEND EMERGENCY SOS NOW'}
          </button>
        </form>
      ) : (
        /* Active Transmission Status Display */
        <div className="card space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Active Transmission</span>
              <span className="font-mono text-sm font-bold text-white">{activeSOS?.packet_id}</span>
            </div>
            <button
              onClick={resetForm}
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 flex items-center gap-1 border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New SOS
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
            <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 flex flex-col items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>1. SENT</span>
            </div>
            <div className={`p-2.5 rounded border flex flex-col items-center gap-1 ${
              transmissionStage === 'DROPPED'
                ? 'bg-red-950/60 border-red-600/50 text-red-300'
                : 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
            }`}>
              {transmissionStage === 'DROPPED' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>2. GATEWAY RX</span>
            </div>
            <div className={`p-2.5 rounded border flex flex-col items-center gap-1 ${
              transmissionStage === 'PENDING'
                ? 'bg-amber-950/60 border-amber-600/50 text-amber-300 animate-pulse'
                : transmissionStage === 'ACCEPTED'
                ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}>
              <Clock className="w-4 h-4" />
              <span>3. PENDING</span>
            </div>
            <div className={`p-2.5 rounded border flex flex-col items-center gap-1 ${
              transmissionStage === 'ACCEPTED'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-extrabold shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}>
              <ShieldCheck className="w-4 h-4" />
              <span>4. ACCEPTED</span>
            </div>
          </div>

          {/* Stage Details Card */}
          {transmissionStage === 'DROPPED' && (
            <div className="bg-red-950/50 border border-red-700/60 p-4 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <h4 className="text-lg font-bold text-red-300">Packet Dropped in Simulated Channel</h4>
              <p className="text-sm text-slate-300">{activeSOS?.reason}</p>
              <button
                onClick={handleSendSOS}
                className="btn btn-danger text-sm font-semibold mt-2"
              >
                Retry Transmission
              </button>
            </div>
          )}

          {transmissionStage === 'PENDING' && (
            <div className="bg-amber-950/30 border border-amber-700/40 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                <h4 className="text-base font-bold text-amber-300">
                  SOS Pending Responder Triage
                </h4>
              </div>
              <p className="text-sm text-slate-300">
                Your 21-byte emergency packet was validated by the gateway and queued in the IECE engine.
                Awaiting digitally signed acceptance from an authorized rescue commander.
              </p>
              <div className="p-3 bg-slate-950/60 rounded border border-slate-800 text-xs font-mono text-slate-400">
                Assigned Cluster: <span className="text-orange-400 font-bold">{activeSOS?.group_id}</span>
                <br />
                Cluster Summary: <span className="text-slate-200">{activeSOS?.cluster_card}</span>
              </div>
            </div>
          )}

          {/* Accepted & Cryptographically Verified Banner */}
          {transmissionStage === 'ACCEPTED' && ackDetails && (
            <div className="bg-emerald-950/40 border-2 border-emerald-500/70 p-5 rounded-xl space-y-3 shadow-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                <div>
                  <h4 className="text-lg font-extrabold text-emerald-300">
                    HELP ACCEPTED & RESCUE TEAM DISPATCHED
                  </h4>
                  <p className="text-xs text-emerald-200 font-medium">
                    Verified through Ed25519 asymmetric cryptographic signature
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Lead Responder:</span>
                  <span className="font-bold text-white text-sm">{ackDetails.responder_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Estimated Arrival (ETA):</span>
                  <span className="font-bold text-emerald-400 text-sm">~{ackDetails.eta_minutes} minutes</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 block">Ed25519 Signature (Hex):</span>
                  <span className="text-slate-300 break-all select-all text-[11px]">
                    {ackDetails.signed_ack?.signature_hex}
                  </span>
                </div>
              </div>

              {/* Client-side Verification Feedback */}
              {cryptoVerification && (
                <div className="flex items-center gap-2 text-xs bg-emerald-900/30 text-emerald-300 p-2.5 rounded border border-emerald-700/50">
                  <KeyRound className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{cryptoVerification.message}</span>
                </div>
              )}

              {/* Demo Tamper Testing Control */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-400">
                  Evaluator Test: Verify cryptographic tamper rejection
                </span>
                <button
                  type="button"
                  onClick={handleTamperTest}
                  disabled={tampering}
                  className="btn-danger text-xs px-3 py-1.5 rounded flex items-center gap-1.5 font-bold"
                >
                  <ShieldX className="w-3.5 h-3.5" />
                  {tampering ? 'Tampering...' : 'Tamper Acknowledgement'}
                </button>
              </div>
            </div>
          )}

          {/* Tamper Rejection State */}
          {cryptoVerification && !cryptoVerification.isValid && (
            <div className="bg-red-950/60 border-2 border-red-500 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ShieldX className="w-6 h-6 text-red-400 flex-shrink-0" />
                <h4 className="text-base font-black text-red-300 uppercase tracking-wide">
                  FORGED / TAMPERED ACKNOWLEDGEMENT REJECTED!
                </h4>
              </div>
              <p className="text-xs text-slate-200">
                {cryptoVerification.message}
              </p>
              <div className="text-xs bg-slate-950/80 p-2 rounded text-red-300 font-mono">
                Security Policy: Terminal refuses to display "Accepted" without an authentic, mathematically sound Ed25519 signature from an authorized rescue authority. Status remains <strong>PENDING</strong>.
              </div>
            </div>
          )}

          {/* Live Packet Breakdown */}
          {activeSOS?.raw_hex && (
            <PacketInspector
              rawHex={activeSOS.raw_hex}
              breakdown={activeSOS.breakdown}
              packetId={activeSOS.packet_id}
            />
          )}
        </div>
      )}
    </div>
  );
}
