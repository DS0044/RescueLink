import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
  VolumeX,
  CheckCircle,
  Anchor,
  Truck,
  Flame,
  Plane,
  Footprints,
} from 'lucide-react';
import PacketInspector from './PacketInspector';
import {
  verifySignedAcknowledgement,
  playAlertChime,
  triggerVibration,
} from '../utils/crypto';

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
  const [activeSOS, setActiveSOS] = useState(() => {
    try {
      const saved = localStorage.getItem('rescuelink_victim_sos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [transmissionStage, setTransmissionStage] = useState(() => {
    return localStorage.getItem('rescuelink_victim_stage') || 'IDLE';
  });

  const [missionStatus, setMissionStatus] = useState('pending'); // pending, accepted, en_route, arriving_soon, arrived
  const [ackDetails, setAckDetails] = useState(null);
  const [cryptoVerification, setCryptoVerification] = useState(null);
  const [tampering, setTampering] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('rescuelink_victim_muted') === 'true';
  });
  const [messageHistory, setMessageHistory] = useState([]);
  const [latestMessageBanner, setLatestMessageBanner] = useState(null);
  const [currentEtaMinutes, setCurrentEtaMinutes] = useState(15);
  const [etaReceivedAt, setEtaReceivedAt] = useState(Date.now());

  const lastProcessedMsgId = useRef(null);

  // Emergency options with icons and priority levels
  const emergencyOptions = [
    { id: 1, name: 'Heart Attack', priority: 'P1 Critical', icon: HeartPulse, priorityClass: 'p1' },
    { id: 2, name: 'Trapped in Flood', priority: 'P2 Urgent', icon: Waves, priorityClass: 'p2' },
    { id: 3, name: 'Injured / Trauma', priority: 'P2 Urgent', icon: Bandage, priorityClass: 'p2' },
    { id: 4, name: 'Medical Need', priority: 'P3 Needs Help', icon: Pill, priorityClass: 'p3' },
    { id: 5, name: 'Stranded (General)', priority: 'P3 Needs Help', icon: Compass, priorityClass: 'p3' },
    { id: 6, name: 'Check-in / Safe', priority: 'P4 Check-in', icon: CheckCircle2, priorityClass: 'p4' },
  ];

  // Persist active SOS across refreshes
  useEffect(() => {
    if (activeSOS) {
      localStorage.setItem('rescuelink_victim_sos', JSON.stringify(activeSOS));
      localStorage.setItem('rescuelink_victim_stage', transmissionStage);
    } else {
      localStorage.removeItem('rescuelink_victim_sos');
      localStorage.removeItem('rescuelink_victim_stage');
    }
  }, [activeSOS, transmissionStage]);

  // Persist mute setting
  useEffect(() => {
    localStorage.setItem('rescuelink_victim_muted', String(isMuted));
  }, [isMuted]);

  // Live ETA countdown timer (updates every 60s)
  useEffect(() => {
    if (missionStatus === 'arrived') {
      setCurrentEtaMinutes(0);
      return;
    }
    const timer = setInterval(() => {
      const elapsedMin = Math.floor((Date.now() - etaReceivedAt) / 60000);
      setCurrentEtaMinutes((prev) => Math.max(1, prev - elapsedMin));
    }, 60000);
    return () => clearInterval(timer);
  }, [missionStatus, etaReceivedAt]);

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

  // Poll for downlink messages & acknowledgements
  useEffect(() => {
    if (!activeSOS || transmissionStage === 'DROPPED') {
      return;
    }

    const pollDownlinks = async () => {
      try {
        // 1. Fetch Downlink message history
        const msgRes = await fetch(`/api/sos/${activeSOS.packet_id}/messages`);
        if (msgRes.ok) {
          const messages = await msgRes.json();
          setMessageHistory(messages);

          if (messages.length > 0) {
            const latest = messages[messages.length - 1];

            // If new message arrived
            if (latest.message_id !== lastProcessedMsgId.current) {
              lastProcessedMsgId.current = latest.message_id;

              // Play audio alert chime & trigger vibration
              playAlertChime(isMuted);
              triggerVibration();

              // Verify Ed25519 signature
              const verResult = await verifySignedAcknowledgement({
                payload_hex: latest.payload_hex,
                signature_hex: latest.signature_hex,
                public_key_hex: latest.public_key_hex,
                is_tampered: latest.is_tampered,
                tamper_reason: latest.tamper_reason,
                responder_name: latest.responder_name,
              });
              setCryptoVerification(verResult);

              if (verResult.isValid) {
                setMissionStatus(latest.status);
                setTransmissionStage('ACCEPTED');
                setCurrentEtaMinutes(latest.eta_minutes || 0);
                setEtaReceivedAt(Date.now());

                // Auto-confirm receipt to gateway
                fetch(`/api/sos/${activeSOS.packet_id}/messages/${latest.message_id}/ack`, {
                  method: 'POST',
                }).catch(() => {});
              } else {
                setMissionStatus('pending');
              }
            }
          }
        }

        // 2. Fallback fetch ack endpoint
        const ackRes = await fetch(`/api/sos/${activeSOS.packet_id}/ack`);
        if (ackRes.ok) {
          const ackData = await ackRes.json();
          setAckDetails(ackData);
          if (ackData.accepted && ackData.signed_ack) {
            const ver = await verifySignedAcknowledgement(ackData.signed_ack);
            setCryptoVerification(ver);
            if (ver.isValid) {
              setTransmissionStage('ACCEPTED');
              setMissionStatus(ackData.status || 'accepted');
              if (ackData.eta_minutes !== undefined) {
                setCurrentEtaMinutes(ackData.eta_minutes);
              }
            } else {
              setTransmissionStage('PENDING');
            }
          }
        }
      } catch (err) {
        console.error('Error polling for downlink messages:', err);
      }
    };

    pollDownlinks();
    const interval = setInterval(pollDownlinks, 1800);
    return () => clearInterval(interval);
  }, [activeSOS, transmissionStage, isMuted]);

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
    setMessageHistory([]);

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
        setMissionStatus('pending');
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
      // Corrupt downlink message
      await fetch(`/api/demo/tamper-downlink/${activeSOS.packet_id}?tamper_type=corrupt_signature`, {
        method: 'POST',
      });
      // Also tamper ack endpoint
      await fetch(`/api/demo/tamper-ack/${activeSOS.packet_id}?tamper_type=corrupt_signature`, {
        method: 'POST',
      });

      const ackRes = await fetch(`/api/sos/${activeSOS.packet_id}/ack`);
      const ackData = await ackRes.json();
      setAckDetails(ackData);

      const verResult = await verifySignedAcknowledgement(ackData.signed_ack);
      setCryptoVerification(verResult);
      setTransmissionStage('PENDING');
      setMissionStatus('pending');
    } catch (err) {
      alert(`Tamper request failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  const resetForm = () => {
    setActiveSOS(null);
    setTransmissionStage('IDLE');
    setMissionStatus('pending');
    setAckDetails(null);
    setCryptoVerification(null);
    setMessageHistory([]);
    localStorage.removeItem('rescuelink_victim_sos');
    localStorage.removeItem('rescuelink_victim_stage');
  };

  const selectedCondition = emergencyOptions.find((o) => o.id === emergencyType);

  return (
    <div className="victim-page-wrapper">
      <div className="victim-form-card">
        {/* Page Hero Header with Mute Toggle */}
        <div className="victim-hero-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h1 className="victim-hero-title">Emergency SOS Terminal</h1>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="icon-btn-round"
              title={isMuted ? 'Unmute alert tones' : 'Mute alert tones'}
              style={{ borderColor: isMuted ? '#EF4444' : '#10B981' }}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
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
                    <span className="people-count-num">{peopleCount}</span>
                    <span className="people-count-sub">
                      {peopleCount === 1 ? 'Individual Survivor' : 'Survivors Trapped'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={peopleCount >= 50}
                    onClick={() => setPeopleCount((p) => Math.min(50, p + 1))}
                    className="stepper-btn"
                    aria-label="Increase people count"
                  >
                    +
                  </button>
                </div>

                <input
                  type="range"
                  min="1"
                  max="25"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Number(e.target.value))}
                  className="people-range-slider"
                  aria-label="Adjust number of people"
                />
              </div>
            </div>

            {/* Section 3: GPS Coordinates */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label className="form-section-title" style={{ marginBottom: 0 }}>
                  <Navigation className="w-5 h-5 text-orange-500" />
                  <span>3. Location Coordinates</span>
                </label>
                <button
                  type="button"
                  onClick={acquireBrowserGps}
                  className="btn btn-ghost"
                  style={{ height: '32px', fontSize: '13px' }}
                >
                  <Radio className="w-4 h-4 text-orange-400" />
                  <span>Use Live Browser GPS</span>
                </button>
              </div>

              <div className="location-grid-two">
                <div className="input-field-wrapper">
                  <label htmlFor="input-latitude" className="input-label">Latitude</label>
                  <div className="input-suffix-container">
                    <input
                      id="input-latitude"
                      type="number"
                      step="0.000001"
                      value={latitude}
                      onChange={(e) => {
                        setLatitude(e.target.value);
                        setIsManualGps(true);
                      }}
                      className="input-field font-mono"
                      required
                    />
                    <span className="input-suffix-text">° N/S</span>
                  </div>
                </div>

                <div className="input-field-wrapper">
                  <label htmlFor="input-longitude" className="input-label">Longitude</label>
                  <div className="input-suffix-container">
                    <input
                      id="input-longitude"
                      type="number"
                      step="0.000001"
                      value={longitude}
                      onChange={(e) => {
                        setLongitude(e.target.value);
                        setIsManualGps(true);
                      }}
                      className="input-field font-mono"
                      required
                    />
                    <span className="input-suffix-text">° E/W</span>
                  </div>
                </div>
              </div>

              <span className="text-helper font-mono" style={{ display: 'block', marginTop: '6px' }}>
                Status: {gpsStatus} (GPS Age: {gpsAge}s)
              </span>
            </div>

            {/* Primary Action Button */}
            <div style={{ marginTop: '32px' }}>
              <button
                type="submit"
                disabled={sending}
                className="btn-emergency-sos"
              >
                <Radio className="w-6 h-6 animate-pulse" />
                <span>{sending ? 'ENCODING & TRANSMITTING...' : 'SEND EMERGENCY SOS NOW'}</span>
              </button>
              <p className="text-helper" style={{ textAlign: 'center', marginTop: '10px' }}>
                Encodes data into exactly 21 bytes. Dispatched over simulated SX1276 LoRa channel.
              </p>
            </div>
          </form>
        ) : (
          /* Active SOS Status & Live Progress Stepper */
          <div className="card card-accent-top">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div>
                <span className="badge-priority p2" style={{ marginBottom: '4px' }}>
                  Distress Beacon Active
                </span>
                <h3 className="card-header-title">Node #{activeSOS?.victim_id || '9901'} Telemetry</h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
                style={{ height: '36px', fontSize: '13px' }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>New SOS</span>
              </button>
            </div>

            {/* 4-Step Progress Stepper */}
            <div className="stepper-container">
              <div className={`stepper-step-card ${transmissionStage !== 'IDLE' ? 'completed' : ''}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>1. Encoded</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'LORA_TX' ? 'active' : transmissionStage === 'DROPPED' ? 'failed' : 'completed'}`}>
                {transmissionStage === 'DROPPED' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>2. Gateway RX</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'PENDING' ? 'active' : transmissionStage === 'ACCEPTED' ? 'completed' : ''}`}>
                <Clock className="w-4 h-4" />
                <span>3. Triage</span>
              </div>
              <div className={`stepper-step-card ${transmissionStage === 'ACCEPTED' ? 'completed' : ''}`}>
                <ShieldCheck className="w-4 h-4" />
                <span>4. Verified Ack</span>
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

            {/* SPEC: STRICT PENDING STATE */}
            {transmissionStage === 'PENDING' && (
              <div className="card" style={{ backgroundColor: 'var(--color-warning-subtle)', borderColor: 'var(--color-warning)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock className="w-5 h-5 text-amber-400" />
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#FCD34D' }}>
                    Waiting for a responder. Your SOS is still being sent.
                  </h4>
                </div>
                <p className="text-helper" style={{ color: '#E8EDF7', marginBottom: '14px' }}>
                  Your 21-byte emergency packet is queued in the IECE engine. The terminal refuses to show "Help is coming" before a verified, cryptographically signed responder acceptance is received over the downlink.
                </p>
                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: 'var(--font-family-mono)' }}>
                  <div>Assigned Cluster Group: <strong style={{ color: 'var(--accent-orange)' }}>{activeSOS?.group_id}</strong></div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>Status: <strong>PENDING DISPATCH</strong></div>
                </div>
              </div>
            )}

            {/* SPEC SECTION 4: DYNAMIC MISSION LIFECYCLE CARD (Accepted, En Route, Arriving Soon, Arrived) */}
            {transmissionStage === 'ACCEPTED' && (
              <div className="ack-verified-card">
                <div className="ack-verified-header">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" style={{ flexShrink: 0 }} />
                  <div>
                    {missionStatus === 'accepted' && (
                      <>
                        <h4 className="ack-verified-title">Your SOS has been accepted!</h4>
                        <p className="text-helper" style={{ color: '#A7F3D0' }}>
                          Accepted by {ackDetails?.team_type_label || 'Rescue Team'} ({ackDetails?.responder_name}). Estimated arrival: ~{currentEtaMinutes} min (estimated).
                        </p>
                      </>
                    )}
                    {missionStatus === 'en_route' && (
                      <>
                        <h4 className="ack-verified-title">Rescue team is on the way!</h4>
                        <p className="text-helper" style={{ color: '#A7F3D0' }}>
                          Deployment unit en route. Estimated arrival: <strong>~{currentEtaMinutes} min (estimated)</strong>.
                        </p>
                      </>
                    )}
                    {missionStatus === 'arriving_soon' && (
                      <>
                        <h4 className="ack-verified-title" style={{ color: '#FCD34D' }}>
                          Rescue team is arriving in less than 5 minutes!
                        </h4>
                        <p className="text-helper" style={{ color: '#FDE68A' }}>
                          Stay where you are and keep your light or phone visible. Team is in the immediate vicinity.
                        </p>
                      </>
                    )}
                    {missionStatus === 'arrived' && (
                      <>
                        <h4 className="ack-verified-title" style={{ color: '#6EE7B7' }}>
                          Rescue team has arrived on scene!
                        </h4>
                        <p className="text-helper" style={{ color: '#A7F3D0' }}>
                          First responders have reached your coordinates. Wave or signal to establish visual contact.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Display Responder Instruction Note if present */}
                {(ackDetails?.latest_note || (messageHistory.length > 0 && messageHistory[messageHistory.length - 1].note_text)) && (
                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,106,26,0.12)', border: '1px solid var(--accent-orange)', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent-orange)', marginBottom: '4px' }}>
                      Commander Note from Base:
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                      "{ackDetails?.latest_note || messageHistory[messageHistory.length - 1].note_text}"
                    </div>
                  </div>
                )}

                <div className="ack-meta-grid">
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Lead Responder</span>
                    <span className="ack-meta-value">{ackDetails?.responder_name || 'Capt. A. Sharma'}</span>
                  </div>
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Deployment Unit</span>
                    <span className="ack-meta-value" style={{ color: '#FF6A1A' }}>
                      {ackDetails?.team_type_label || 'Boat Rescue Team'}
                    </span>
                  </div>
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Estimated Arrival</span>
                    <span className="ack-meta-value" style={{ color: missionStatus === 'arrived' ? '#10B981' : '#FCD34D' }}>
                      {missionStatus === 'arrived' ? 'ARRIVED ON SCENE' : `~${currentEtaMinutes} min (estimated)`}
                    </span>
                  </div>
                  <div className="ack-meta-item">
                    <span className="ack-meta-label">Downlink Delivery</span>
                    <span className="ack-meta-value" style={{ color: '#10B981' }}>
                      ✓ Delivered via LoRa
                    </span>
                  </div>
                </div>

                {cryptoVerification && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--color-success-border)', color: '#6EE7B7', marginTop: '14px', marginBottom: '14px' }}>
                    <KeyRound className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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

            {/* Tamper Rejection Alert Banner */}
            {cryptoVerification && !cryptoVerification.isValid && (
              <div className="ack-tamper-rejected-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldX className="w-5 h-5 text-red-400" />
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#FCA5A5' }}>
                    Forged message rejected!
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

            {/* SPEC: MESSAGE HISTORY TIMELINE */}
            {messageHistory.length > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                    Downlink Radio Message Timeline ({messageHistory.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {messageHistory.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
                          {new Date(m.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontWeight: 700, color: m.is_valid ? '#6EE7B7' : '#EF4444' }}>
                          {m.status_label || m.status}
                        </span>
                        {m.eta_minutes !== undefined && m.eta_minutes > 0 && (
                          <span style={{ color: 'var(--accent-orange)' }}>(ETA: ~{m.eta_minutes}m)</span>
                        )}
                      </div>
                      <span className="badge-priority" style={{ fontSize: '10px', height: '20px' }}>
                        {m.is_valid ? '✓ Verified Ed25519' : '✗ Forged'}
                      </span>
                    </div>
                  ))}
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

      {/* Nearest Radio Tower Simulation (visual simulation container) */}
      <section id="tower-sim-panel"></section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="modal-title">Confirm Emergency Broadcast</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="icon-btn-round"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-helper" style={{ margin: '12px 0 16px' }}>
              You are about to transmit a high-priority emergency distress beacon over off-grid LoRa frequencies.
            </p>

            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div>Condition: <strong style={{ color: 'var(--text-primary)' }}>{selectedCondition?.name}</strong></div>
              <div>Priority: <strong style={{ color: 'var(--accent-orange)' }}>{selectedCondition?.priority}</strong></div>
              <div>People Needing Extraction: <strong>{peopleCount} Person(s)</strong></div>
              <div>GPS Coordinates: <strong className="font-mono">{Number(latitude).toFixed(4)}°, {Number(longitude).toFixed(4)}°</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
                style={{ height: '42px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmedSend}
                className="btn btn-primary"
                style={{ height: '42px', fontWeight: 700 }}
              >
                Confirm & Dispatch SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
