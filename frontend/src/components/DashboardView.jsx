import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Users,
  Shield,
  ShieldCheck,
  Radio,
  Clock,
  Layers,
  CheckCircle,
  AlertTriangle,
  Lock,
  LogIn,
  LogOut,
  ChevronRight,
  Eye,
  KeyRound,
  Compass,
  Activity,
  HeartPulse,
  Flame,
  X,
} from 'lucide-react';
import PacketInspector from './PacketInspector';

export default function DashboardView({
  reports,
  groups,
  onAcceptSos,
  activeResponder,
  onLogin,
  onLogout,
  channelStatus,
}) {
  const [selectedSos, setSelectedSos] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('triage'); // 'triage' or 'groups'
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginResponderId, setLoginResponderId] = useState('RESP-NDRF-01');
  const [acceptingId, setAcceptingId] = useState(null);

  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});

  // Stats calculation
  const totalReports = reports.length;
  const criticalP1Count = reports.filter((r) => r.severity === 1).length;
  const totalClusters = groups.length;
  const acceptedCount = reports.filter((r) => r.status === 'accepted').length;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([13.0827, 80.2707], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | RescueLink',
        maxZoom: 18,
      }).addTo(map);

      leafletMap.current = map;
    }

    const map = leafletMap.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const getPriorityColor = (sev) => {
      switch (sev) {
        case 1: return '#EF4444'; // Red P1
        case 2: return '#FF6A1A'; // Orange P2
        case 3: return '#EAB308'; // Yellow P3
        default: return '#10B981'; // Green P4
      }
    };

    // Plot grouped clusters
    groups.forEach((group) => {
      const color = getPriorityColor(group.severity);
      const isMulti = group.report_count > 1;

      const iconHtml = `
        <div style="
          background: ${color};
          color: white;
          width: ${isMulti ? '36px' : '26px'};
          height: ${isMulti ? '36px' : '26px'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: ${isMulti ? '13px' : '11px'};
          border: 2px solid #0A0F1E;
          box-shadow: 0 0 12px ${color};
          cursor: pointer;
        ">
          ${isMulti ? group.total_people : 'SOS'}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [isMulti ? 36 : 26, isMulti ? 36 : 26],
        iconAnchor: [isMulti ? 18 : 13, isMulti ? 18 : 13],
      });

      const marker = L.marker([group.centroid_lat, group.centroid_lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.4; color: #E8EDF7; background: #121A2F; padding: 4px;">
            <strong style="color: ${color}; font-size: 14px;">${group.emergency_type_label}</strong><br/>
            <span style="font-weight: 700; color: #FFF;">${group.summary_card}</span><br/>
            <span style="color: #93A0BF;">Status: ${group.status.toUpperCase()}</span><br/>
            <span style="color: #627193; font-family: monospace;">${group.centroid_lat.toFixed(4)}, ${group.centroid_lon.toFixed(4)}</span>
          </div>
        `);

      marker.on('click', () => {
        setSelectedGroup(group);
      });

      markersRef.current[group.group_id] = marker;
    });
  }, [groups]);

  const handleAccept = async (sosId) => {
    if (!activeResponder) {
      setShowLoginModal(true);
      return;
    }
    setAcceptingId(sosId);
    try {
      await onAcceptSos(sosId, activeResponder);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    onLogin(loginResponderId);
    setShowLoginModal(false);
  };

  return (
    <div className="dashboard-page-wrapper">
      {/* 4 Compact Stat Cards on Top */}
      <div className="dashboard-stats-grid">
        <div className="stat-card-compact">
          <div className="stat-card-content">
            <span className="stat-card-label">Total SOS Reports</span>
            <span className="stat-card-number">{totalReports}</span>
          </div>
          <div className="stat-card-icon-box" style={{ backgroundColor: 'rgba(255, 106, 26, 0.12)', color: 'var(--accent-orange)' }}>
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card-compact">
          <div className="stat-card-content">
            <span className="stat-card-label">Critical P1 Triage</span>
            <span className="stat-card-number" style={{ color: '#EF4444' }}>{criticalP1Count}</span>
          </div>
          <div className="stat-card-icon-box" style={{ backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }}>
            <HeartPulse className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card-compact">
          <div className="stat-card-content">
            <span className="stat-card-label">Clustered Groups</span>
            <span className="stat-card-number" style={{ color: '#FCD34D' }}>{totalClusters}</span>
          </div>
          <div className="stat-card-icon-box" style={{ backgroundColor: 'var(--color-warning-subtle)', color: '#F59E0B' }}>
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card-compact">
          <div className="stat-card-content">
            <span className="stat-card-label">Accepted Missions</span>
            <span className="stat-card-number" style={{ color: '#10B981' }}>{acceptedCount}</span>
          </div>
          <div className="stat-card-icon-box" style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout (420px Left, Map Right) */}
      <div className="dashboard-main-grid">
        {/* Left Column: Triage List & Cluster Groups */}
        <div className="triage-column">
          <div className="triage-tabs-row" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'triage'}
              onClick={() => setActiveTab('triage')}
              className={`triage-tab-btn ${activeTab === 'triage' ? 'active' : ''}`}
            >
              <Clock className="w-4 h-4" />
              <span>Priority Triage ({reports.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'groups'}
              onClick={() => setActiveTab('groups')}
              className={`triage-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            >
              <Layers className="w-4 h-4" />
              <span>Clusters ({groups.length})</span>
            </button>
          </div>

          {activeTab === 'triage' && (
            <div className="triage-cards-scrollable">
              {reports.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                  <Clock className="w-8 h-8 text-orange-400" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p className="text-muted">No active emergencies in triage queue.</p>
                </div>
              ) : (
                reports.map((item) => {
                  const isSelected = selectedSos?.packet_id === item.packet_id;
                  const priorityClass = item.severity === 1 ? 'p1' : item.severity === 2 ? 'p2' : item.severity === 3 ? 'p3' : 'p4';
                  return (
                    <div
                      key={item.packet_id}
                      onClick={() => setSelectedSos(item)}
                      className={`sos-card-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="sos-card-top">
                        <span className={`badge-priority ${priorityClass}`}>
                          {item.severity_label}
                        </span>
                        <span className="badge-priority" style={{
                          backgroundColor: item.status === 'accepted' ? 'var(--color-success-subtle)' : 'var(--color-warning-subtle)',
                          color: item.status === 'accepted' ? '#6EE7B7' : '#FCD34D',
                          borderColor: item.status === 'accepted' ? 'var(--color-success-border)' : 'var(--color-warning-border)',
                        }}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4 className="sos-card-title">{item.emergency_type_label}</h4>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                          {item.people_count} {item.people_count === 1 ? 'Person' : 'People'}
                        </span>
                      </div>

                      <div className="sos-card-meta">
                        <span>Node #{item.victim_id}</span>
                        <span>{item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="triage-cards-scrollable">
              {groups.map((group) => (
                <div
                  key={group.group_id}
                  onClick={() => setSelectedGroup(group)}
                  className="card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderLeft: '3px solid var(--accent-orange)',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                      {group.group_id}
                    </span>
                    <span className="status-chip" style={{ height: '24px', fontSize: '11px' }}>
                      {group.report_count} Reports Merged
                    </span>
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {group.summary_card}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-family-mono)' }}>
                    <span>Centroid: {group.centroid_lat.toFixed(4)}, {group.centroid_lon.toFixed(4)}</span>
                    <span style={{ color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>{group.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Leaflet Map & Selected Incident Drawer */}
        <div className="map-column">
          <div className="map-wrapper-card">
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

            {/* Dark Styled Map Legend */}
            <div className="map-legend-overlay">
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                Priority Triage Legend
              </span>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#EF4444' }}></span>
                <span>P1 Life Threatening</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#FF6A1A' }}></span>
                <span>P2 Urgent Rescue</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#EAB308' }}></span>
                <span>P3 Needs Help</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#10B981' }}></span>
                <span>P4 Check-in / Safe</span>
              </div>
            </div>
          </div>

          {/* Selected SOS Incident Detail Drawer */}
          {selectedSos && (
            <div className="detail-drawer card-accent-top">
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge-priority ${selectedSos.severity === 1 ? 'p1' : selectedSos.severity === 2 ? 'p2' : selectedSos.severity === 3 ? 'p3' : 'p4'}`}>
                    {selectedSos.severity_label}
                  </span>
                  <h3 className="card-header-title">{selectedSos.emergency_type_label}</h3>
                </div>
                <button onClick={() => setSelectedSos(null)} className="icon-btn-round" aria-label="Close detail panel">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', fontSize: '13px', fontFamily: 'var(--font-family-mono)' }}>
                <div>
                  <span className="text-tertiary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Victim Node</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>#{selectedSos.victim_id}</span>
                </div>
                <div>
                  <span className="text-tertiary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>People</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>{selectedSos.people_count} Person(s)</span>
                </div>
                <div>
                  <span className="text-tertiary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Coordinates</span>
                  <span style={{ color: 'var(--text-primary)' }}>{selectedSos.latitude.toFixed(4)}°, {selectedSos.longitude.toFixed(4)}°</span>
                </div>
                <div>
                  <span className="text-tertiary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Status</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', color: selectedSos.status === 'accepted' ? '#10B981' : '#F59E0B' }}>
                    {selectedSos.status}
                  </span>
                </div>
              </div>

              {/* Action Button: Authorized Responder Only */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                {activeResponder ? (
                  selectedSos.status === 'accepted' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6EE7B7', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--color-success-subtle)', border: '1px solid var(--color-success-border)' }}>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Accepted by {selectedSos.responder_name} (ETA: ~{selectedSos.eta_minutes || 15}m)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAccept(selectedSos.packet_id)}
                      disabled={acceptingId === selectedSos.packet_id}
                      className="btn btn-primary"
                      style={{ height: '42px', padding: '0 20px', fontWeight: 700 }}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{acceptingId === selectedSos.packet_id ? 'Generating Signature...' : 'Accept SOS & Sign Acknowledgement'}</span>
                    </button>
                  )
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <Lock className="w-4 h-4 text-orange-400" />
                    <span>Login as an authorized commander to accept and sign rescue allocations.</span>
                  </div>
                )}
              </div>

              {/* Raw 21-Byte Packet Breakdown Inspector */}
              {selectedSos.raw_hex && (
                <PacketInspector
                  rawHex={selectedSos.raw_hex}
                  breakdown={selectedSos.breakdown}
                  packetId={selectedSos.packet_id}
                />
              )}
            </div>
          )}

          {/* Selected Group Drawer */}
          {selectedGroup && (
            <div className="detail-drawer card-accent-top">
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers className="w-5 h-5 text-orange-500" />
                  <h3 className="card-header-title">Cluster Group: {selectedGroup.group_id}</h3>
                </div>
                <button onClick={() => setSelectedGroup(null)} className="icon-btn-round" aria-label="Close group panel">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p style={{ fontSize: '15px', fontWeight: 700, color: '#6EE7B7', marginBottom: '8px' }}>
                {selectedGroup.summary_card}
              </p>
              <p className="text-helper" style={{ marginBottom: '16px' }}>
                Compatible emergency reports aggregated within a 50-meter radius into a single dispatch target:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedGroup.reports?.map((rep, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedSos(rep)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      Node #{rep.victim_id} ({rep.people_count} People)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span className="font-mono">{rep.latitude.toFixed(4)}°, {rep.longitude.toFixed(4)}°</span>
                      <ChevronRight className="w-4 h-4 text-orange-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Responder Login Modal */}
      {showLoginModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', borderColor: 'var(--accent-orange)' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound className="w-5 h-5 text-orange-500" />
                <h3 className="card-header-title">Responder Authentication</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="icon-btn-round" aria-label="Close modal">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-helper" style={{ marginBottom: '16px' }}>
              Sign in with an authorized responder keypair to unlock Ed25519 digital SOS acceptance.
            </p>

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="responder-select">Authorized Commander</label>
                <select
                  id="responder-select"
                  value={loginResponderId}
                  onChange={(e) => setLoginResponderId(e.target.value)}
                  className="form-control-input"
                  style={{ height: '44px' }}
                >
                  <option value="RESP-NDRF-01">Capt. A. Sharma (NDRF 4th Battalion - Flood Rescue)</option>
                  <option value="RESP-SDRF-02">Inspector M. Rao (SDRF Quick Response - Medical Lead)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="responder-passcode">Commander Passcode</label>
                <input
                  id="responder-passcode"
                  type="password"
                  defaultValue="demo123"
                  className="form-control-input font-mono"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowLoginModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Authenticate Commander
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
