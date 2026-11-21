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
  HeartPulse,
  Waves,
  Bandage,
  Pill,
  Compass,
  Check,
  HelpCircle,
  X,
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
  const [gpsStatus, setGpsStatus] = useState('Manual Fallback (Chennai Basin)');

  // Submission & Transmission state
  const [sending, setSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeSOS, setActiveSOS] = useState(null);
  const [transmissionStage, setTransmissionStage] = useState('IDLE'); // IDLE, LORA_TX, GATEWAY_RX, PENDING, ACCEPTED, DROPPED
  const [ackDetails, setAckDetails] = useState(null);
  const [cryptoVerification, setCryptoVerification] = useState(null);
  const [tampering, setTampering] = useState(false);

  // Emergency options with icons and priority levels
  const emergencyOptions = [
    { id: 1, name: 'Heart Attack', priority: 'P1 Critical', icon: HeartPulse, priorityClass: 'p1' },
    { id: 2, name: 'Trapped in Flood', priority: 'P2 Urgent', icon: Waves, priorityClass: 'p2' },
    { id: 3, name: 'Injured / Trauma', priority: 'P2 Urgent', icon: Bandage, priorityClass: 'p2' },
    { id: 4, name: 'Medical Need', priority: 'P3 Needs Help', icon: Pill, priorityClass: 'p3' },
    { id: 5, name: 'Stranded (General)', priority: 'P3 Needs Help', icon: Compass, priorityClass: 'p3' },
    { id: 6, name: 'Check-in / Safe', priority: 'P4 Check-in', icon: CheckCircle2, priorityClass: 'p4' },
  ];

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
            const verResult = await verifySignedAcknowledgement(data.signed_ack);
            setCryptoVerification(verResult);

            if (verResult.isValid) {
              setTransmissionStage('ACCEPTED');
            } else {
              setTransmissionStage('PENDING');
            }
          }
        }
      } catch (err) {
        console.error('Error polling for ack:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSOS, transmissionStage]);

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleConfirmedSend = async () => {
    setShowConfirmModal(false);
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
      await fetch(`/api/demo/tamper-ack/${activeSOS.packet_id}?tamper_type=modify_field`, {
        method: 'POST',
      });
      const ackRes = await fetch(`/api/sos/${activeSOS.packet_id}/ack`);
      const ackData = await ackRes.json();
      setAckDetails(ackData);

      const verResult = await verifySignedAcknowledgement(ackData.signed_ack);
      setCryptoVerification(verResult);
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

  const selectedCondition = emergencyOptions.find((o) => o.id === emergencyType);

  return (
    <div className="victim-page-wrapper">
      <div className="victim-form-card">
        {/* Page Hero Header */}
        <div className="victim-hero-header">
          <h1 className="victim-hero-title">Emergency SOS Terminal</h1>
          <p className="victim-hero-desc">
            Direct off-grid distress beacon. Encodes your survival telemetry into an ultra-compact 21-byte LoRa packet.
          </p>
        </div>

        {/* SOS Form or Active Transmission Status */}
        {transmissionStage === 'IDLE' ? (
          <form onSubmit={handleOpenConfirm} className="card card-accent-top">
            {/* Section 1: Emergency Condition */}
            <div className="form-group">
              <label className="form-section-title">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <span>1. Emergency Condition</span>
              </label>
              <div className="emergency-grid" role="radiogroup" aria-label="Select emergency condition">
                {emergencyOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = emergencyType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setEmergencyType(opt.id)}
                      className={`emergency-card-btn ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="emergency-card-top">
                        <Icon className="emergency-card-icon" />
                        <span className={`badge-priority ${opt.priorityClass}`}>
                          {opt.priority}
                        </span>
                      </div>
                      <span className="emergency-card-name">{opt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: People Extraction */}
            <div className="form-group">
              <label className="form-section-title">
                <Users className="w-5 h-5 text-orange-500" />
                <span>2. People Needing Extraction</span>
              </label>

              <div className="people-control-card">
                <div className="people-stepper-row">
                  <button
                    type="button"
                    disabled={peopleCount <= 1}
                    onClick={() => setPeopleCount((p) => Math.max(1, p - 1))}
                    className="stepper-btn"
                    aria-label="Decrease people count"
                  >
                    -
                  </button>

                  <div className="people-count-display">
                    <span className="people-number-large">{peopleCount}</span>
                    <span className="people-label-small">
                      {peopleCount === 1 ? 'Person' : 'People Total'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={peopleCount >= 20}
                    onClick={() => setPeopleCount((p) => Math.min(20, p + 1))}
                    className="stepper-btn"
                    aria-label="Increase people count"
                  >
                    +
                  </button>
                </div>

                <input
                  type="range"
                  min="1"
                  max="20"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Number(e.target.value))}
                  className="custom-range-slider"
                  aria-label="People count slider"
                />
              </div>
            </div>

            {/* Section 3: Location & Coordinates */}
            <div className="form-group">
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <span className="form-section-title" style={{ margin: 0 }}>
                  <Navigation className="w-5 h-5 text-orange-500" />
                  <span>3. Location & GNSS Coordinates</span>
                </span>
                <button
                  type="button"
                  onClick={acquireBrowserGps}
                  className="btn btn-ghost"
                  style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Use Live Browser GPS</span>
                </button>
              </div>

              <div className="location-inputs-grid">
                <div>
                  <label htmlFor="latitude" className="form-label">
                    <span>Latitude</span>
                  </label>
                  <div className="input-suffix-wrapper">
                    <input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      value={latitude}
                      onChange={(e) => {
                        setLatitude(e.target.value);
                        setIsManualGps(true);
                      }}
                      className="form-control-input font-mono"
                      required
                    />
                    <span className="input-suffix">° N/S</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="longitude" className="form-label">
                    <span>Longitude</span>
                  </label>
                  <div className="input-suffix-wrapper">
                    <input
                      id="longitude"
                      type="number"
                      step="0.000001"
                      value={longitude}
                      onChange={(e) => {
                        setLongitude(e.target.value);
                        setIsManualGps(true);
                      }}
                      className="form-control-input font-mono"
                      required
                    />
                    <span className="input-suffix">° E/W</span>
                  </div>
                </div>
              </div>

              <div className="gps-status-badge">
                <span className="status-dot" style={{ backgroundColor: '#10B981' }}></span>
                <span>{gpsStatus}</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button type="submit" disabled={sending} className="btn-emergency-sos">
              <AlertTriangle className="w-6 h-6" />
              <span>{sending ? 'Encoding 21-Byte Packet...' : 'SEND EMERGENCY SOS NOW'}</span>
            </button>
          </form>
        ) : (
          /* Active Transmission State */
          <div className="card card-accent-top">
            <div className="card-header">
              <div>
                <span className="text-helper" style={{ display: 'block' }}>Active Emergency Transmission</span>
                <span className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeSOS?.packet_id}
                </span>
              </div>
              <button onClick={resetForm} className="btn btn-secondary" style={{ height: '36px', padding: '0 12px', fontSize: '13px' }}>
                <RotateCcw className="w-4 h-4" />
                <span>New SOS</span>
              </button>
            </div>

            {/* 4-Step Progress Stepper */}
            <div className="stepper-progress-grid" aria-live="polite">
              <div className="stepper-step-card completed">
                <CheckCircle2 className="w-4 h-4" />
                <span>1. Sent</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'DROPPED' ? 'dropped' : 'completed'}`}>
                {transmissionStage === 'DROPPED' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>2. Gateway RX</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'PENDING' ? 'active' : transmissionStage === 'ACCEPTED' ? 'completed' : ''}`}>
                <Clock className="w-4 h-4" />
                <span>3. Pending</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'ACCEPTED' ? 'completed' : ''}`}>
                <ShieldCheck className="w-4 h-4" />
                <span>4. Accepted</span>
              </div>
            </div>

            {/* Packet Dropped Banner */}
            {transmissionStage === 'DROPPED' && (
              <div className="card" style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger)', marginBottom: '24px', textAlign: 'center' }}>
                <AlertCircle className="w-8 h-8 text-red-400" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#FCA5A5' }}>Packet Dropped in Simulated Channel</h4>
                <p className="text-helper" style={{ margin: '4px 0 16px' }}>{activeSOS?.reason}</p>
                <button onClick={handleConfirmedSend} className="btn btn-danger" style={{ height: '40px' }}>
                  Retry Transmission
                </button>
              </div>
            )}

            {/* Pending State */}
            {transmissionStage === 'PENDING' && (
              <div className="card" style={{ backgroundColor: 'var(--color-warning-subtle)', borderColor: 'var(--color-warning)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock className="w-5 h-5 text-amber-400" />
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#FCD34D' }}>
                    SOS Pending Responder Triage
                  </h4>
                </div>
                <p className="text-helper" style={{ color: '#E8EDF7', marginBottom: '14px' }}>
                  Your 21-byte emergency packet was validated by the gateway and prioritized in the IECE engine. 
                  Awaiting digitally signed acceptance from an authorized rescue commander.
                </p>
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: 'var(--font-family-mono)' }}>
                  <div>Assigned Cluster: <strong style={{ color: 'var(--accent-orange)' }}>{activeSOS?.group_id}</strong></div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>{activeSOS?.cluster_card}</div>
                </div>
              </div>
            )}

            {/* Accepted & Verified State */}
            {transmissionStage === 'ACCEPTED' && ackDetails && (
              <div className="ack-verified-card">
                <div className="ack-verified-header">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" style={{ flexShrink: 0 }} />
                  <div>
                    <h4 className="ack-verified-title">Help Accepted & Rescue Team Dispatched</h4>
                    <p className="text-helper" style={{ color: '#A7F3D0' }}>
                      Verified through Ed25519 asymmetric cryptographic signature
                    </p>
                  </div>
                </div>

                <div className="ack-meta-grid">
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Lead Responder</span>
                    <span className="ack-meta-value">{ackDetails.responder_name}</span>
                  </div>
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Estimated Arrival</span>
                    <span className="ack-meta-value" style={{ color: '#10B981' }}>~{ackDetails.eta_minutes} Minutes</span>
                  </div>
                  <div className="ack-sig-preview">
                    Ed25519 Signature: {ackDetails.signed_ack?.signature_hex}
                  </div>
                </div>

                {cryptoVerification && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--color-success-border)', color: '#6EE7B7', marginBottom: '16px' }}>
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>{cryptoVerification.message}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="text-helper">Evaluator Test: Verify cryptographic tamper rejection</span>
                  <button
                    type="button"
                    onClick={handleTamperTest}
                    disabled={tampering}
                    className="btn btn-danger"
                    style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
                  >
                    <ShieldX className="w-4 h-4" />
                    <span>{tampering ? 'Tampering...' : 'Tamper Acknowledgement'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tamper Rejection Alert */}
            {cryptoVerification && !cryptoVerification.isValid && (
              <div className="ack-tamper-rejected-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldX className="w-5 h-5 text-red-400" />
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#FCA5A5' }}>
                    Forged / Tampered Acknowledgement Rejected!
                  </h4>
                </div>
                <p className="text-helper" style={{ color: '#E8EDF7', marginBottom: '10px' }}>
                  {cryptoVerification.message}
                </p>
                <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: '#F87171', fontSize: '12px', fontFamily: 'var(--font-family-mono)' }}>
                  Security Policy: Terminal refuses to display "Accepted" without an authentic, mathematically sound Ed25519 signature from an authorized rescue authority. Status remains <strong>PENDING</strong>.
                </div>
              </div>
            )}

            {/* 21-Byte Packet Breakdown Inspector */}
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

      {/* Confirmation Step Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', borderColor: 'var(--accent-orange)' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="card-header-title">Confirm SOS Broadcast</h3>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="icon-btn-round" aria-label="Close confirmation dialog">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-body" style={{ marginBottom: '16px' }}>
              Are you sure you want to broadcast an emergency distress signal for <strong>{peopleCount} {peopleCount === 1 ? 'person' : 'people'}</strong> experiencing <strong>{selectedCondition?.name}</strong>?
            </p>

            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: 'var(--font-family-mono)', marginBottom: '20px' }}>
              <div>Coordinates: {Number(latitude).toFixed(4)}° N, {Number(longitude).toFixed(4)}° E</div>
              <div style={{ marginTop: '4px' }}>Priority: <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>{selectedCondition?.priority}</span></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmedSend} className="btn btn-primary" style={{ backgroundColor: '#DC2626', borderColor: '#EF4444' }}>
                Yes, Broadcast SOS Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
