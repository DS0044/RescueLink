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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Check if L is loaded from unpkg
    const L = window.L;
    if (!L) return;

    if (!leafletMap.current) {
      // Chennai flood basin center
      const map = L.map(mapRef.current).setView([13.0827, 80.2707], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | RescueLink Offline Layer',
        maxZoom: 18,
      }).addTo(map);

      leafletMap.current = map;
    }

    const map = leafletMap.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // Priority color mapping
    const getPriorityColor = (sev) => {
      switch (sev) {
        case 1: return '#ef4444'; // Red P1
        case 2: return '#f97316'; // Orange P2
        case 3: return '#eab308'; // Yellow P3
        default: return '#06b6d4'; // Cyan P4
      }
    };

    // Plot grouped clusters
    groups.forEach((group) => {
      const color = getPriorityColor(group.severity);
      const isMulti = group.report_count > 1;

      // Custom HTML Marker for Leaflet
      const iconHtml = `
        <div style="
          background: ${color};
          color: white;
          width: ${isMulti ? '38px' : '28px'};
          height: ${isMulti ? '38px' : '28px'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: ${isMulti ? '13px' : '11px'};
          border: 3px solid #0f172a;
          box-shadow: 0 0 15px ${color};
          cursor: pointer;
        ">
          ${isMulti ? group.total_people : 'SOS'}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [isMulti ? 38 : 28, isMulti ? 38 : 28],
        iconAnchor: [isMulti ? 19 : 14, isMulti ? 19 : 14],
      });

      const marker = L.marker([group.centroid_lat, group.centroid_lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
            <strong style="color: ${color}; font-size: 13px;">${group.emergency_type_label}</strong><br/>
            <span style="font-weight: bold; color: #fff;">${group.summary_card}</span><br/>
            <span style="color: #94a3b8;">Status: ${group.status.toUpperCase()}</span><br/>
            <span style="color: #94a3b8;">Coords: ${group.centroid_lat.toFixed(4)}, ${group.centroid_lon.toFixed(4)}</span>
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
    <div className="space-y-6">
      {/* Top Bar with Responder Status */}
      <div className="card flex items-center justify-between flex-wrap gap-4" style={{ borderLeft: '4px solid #ff6600' }}>
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-black text-white tracking-wide">RESCUE COORDINATION DASHBOARD</h2>
          </div>
          <p className="text-xs text-slate-300">
            Intelligent Emergency Communication Engine (IECE) prioritized triage & real-time dispatch map
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeResponder ? (
            <div className="flex items-center gap-3 bg-slate-900/90 px-3.5 py-2 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <div className="text-left text-xs">
                  <span className="text-emerald-400 font-bold block">{activeResponder.responder_name}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{activeResponder.role}</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="text-xs text-slate-400 hover:text-red-400 ml-2"
                title="Sign out responder"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              Responder Login
            </button>
          )}

          <span className={`badge ${channelStatus?.is_simulated ? 'badge-simulated' : 'badge-real'}`}>
            {channelStatus?.is_simulated ? 'SIMULATED LINK' : 'REAL LORA'}
          </span>
        </div>
      </div>

      {/* Main Grid: Left = Map & Cluster Summary, Right = Priority Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Leaflet Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card p-2 h-[450px] relative rounded-xl overflow-hidden border border-slate-700">
            <div ref={mapRef} className="w-full h-full rounded-lg" />
            <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur p-2.5 rounded-lg border border-slate-700 text-xs space-y-1 font-semibold">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Priority Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> P1 Life Threatening</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span> P2 Urgent Rescue</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> P3 Needs Help</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-500"></span> P4 Check-in</div>
            </div>
          </div>

          {/* Selected SOS or Cluster Detail Panel */}
          {selectedSos ? (
            <div className="card space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    selectedSos.severity === 1 ? 'bg-red-950 text-red-300 border-red-700' :
                    selectedSos.severity === 2 ? 'bg-orange-950 text-orange-300 border-orange-700' :
                    selectedSos.severity === 3 ? 'bg-yellow-950 text-yellow-300 border-yellow-700' :
                    'bg-cyan-950 text-cyan-300 border-cyan-700'
                  }`}>
                    {selectedSos.severity_label}
                  </span>
                  <h4 className="font-bold text-white text-base">{selectedSos.emergency_type_label}</h4>
                </div>
                <button
                  onClick={() => setSelectedSos(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Victim Device:</span>
                  <span className="text-white font-bold">Node #{selectedSos.victim_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">People:</span>
                  <span className="text-orange-400 font-bold">{selectedSos.people_count} person(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Coordinates:</span>
                  <span className="text-slate-200">{selectedSos.latitude.toFixed(4)}, {selectedSos.longitude.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status:</span>
                  <span className={`font-bold uppercase ${
                    selectedSos.status === 'accepted' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {selectedSos.status}
                  </span>
                </div>
              </div>

              {/* Action Button: Only visible if Authorized Responder is logged in */}
              <div className="flex items-center justify-between pt-2">
                {activeResponder ? (
                  selectedSos.status === 'accepted' ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded border border-emerald-800">
                      <ShieldCheck className="w-4 h-4" />
                      Accepted by {selectedSos.responder_name} (ETA: ~{selectedSos.eta_minutes || 15}m)
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAccept(selectedSos.packet_id)}
                      disabled={acceptingId === selectedSos.packet_id}
                      className="btn btn-primary text-xs py-2 px-4 flex items-center gap-2 font-bold"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {acceptingId === selectedSos.packet_id ? 'Generating Signature...' : 'Accept SOS & Sign Acknowledgement'}
                    </button>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded border border-slate-800">
                    <Lock className="w-3.5 h-3.5 text-orange-400" />
                    <span>Login as an authorized responder to accept this emergency.</span>
                  </div>
                )}
              </div>

              {/* Raw 21-Byte Packet Breakdown */}
              {selectedSos.raw_hex && (
                <PacketInspector
                  rawHex={selectedSos.raw_hex}
                  breakdown={selectedSos.breakdown}
                  packetId={selectedSos.packet_id}
                />
              )}
            </div>
          ) : selectedGroup ? (
            /* Selected Group Detail Panel */
            <div className="card space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-orange-400" />
                  <h4 className="font-bold text-white text-base">Cluster Group: {selectedGroup.group_id}</h4>
                </div>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Close
                </button>
              </div>
              <p className="text-sm font-semibold text-emerald-300">
                {selectedGroup.summary_card}
              </p>
              <div className="text-xs text-slate-400">
                All individual victim reports aggregated within a 50-meter radius into a single response target:
              </div>

              <div className="space-y-2">
                {selectedGroup.reports?.map((rep, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedSos(rep)}
                    className="p-2.5 rounded bg-slate-900 hover:bg-slate-800/80 cursor-pointer border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="font-mono">
                      <span className="text-white font-bold">Node #{rep.victim_id}</span> ({rep.people_count} people)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{rep.latitude.toFixed(4)}, {rep.longitude.toFixed(4)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Priority Triage Queue & Duplicate Groups */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tabs: Triage vs Groups */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('triage')}
              className={`flex-1 py-2 rounded-md transition-all ${
                activeTab === 'triage' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              IECE Priority Queue ({reports.length})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2 rounded-md transition-all ${
                activeTab === 'groups' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cluster Groups ({groups.length})
            </button>
          </div>

          {/* Tab 1: Priority Queue */}
          {activeTab === 'triage' && (
            <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
              {reports.length === 0 ? (
                <div className="card text-center p-8 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-orange-400" />
                  <p>No active emergencies in queue.</p>
                </div>
              ) : (
                reports.map((item) => (
                  <div
                    key={item.packet_id}
                    onClick={() => setSelectedSos(item)}
                    className={`card p-3.5 hover:border-orange-500/80 cursor-pointer transition-all ${
                      selectedSos?.packet_id === item.packet_id ? 'border-orange-500 bg-slate-850' : ''
                    }`}
                    style={{
                      borderLeft: `4px solid ${
                        item.severity === 1 ? '#ef4444' :
                        item.severity === 2 ? '#f97316' :
                        item.severity === 3 ? '#eab308' : '#06b6d4'
                      }`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        item.severity === 1 ? 'bg-red-950/80 text-red-300' :
                        item.severity === 2 ? 'bg-orange-950/80 text-orange-300' :
                        item.severity === 3 ? 'bg-yellow-950/80 text-yellow-300' :
                        'bg-cyan-950/80 text-cyan-300'
                      }`}>
                        {item.severity_label}
                      </span>
                      <span className={`text-[11px] font-bold uppercase font-mono ${
                        item.status === 'accepted' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{item.emergency_type_label}</h4>
                      <span className="font-mono text-xs text-orange-400 font-bold">
                        {item.people_count} {item.people_count === 1 ? 'person' : 'people'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Node #{item.victim_id}</span>
                      <span>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Duplicate Cluster Groups */}
          {activeTab === 'groups' && (
            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {groups.map((group) => (
                <div
                  key={group.group_id}
                  onClick={() => setSelectedGroup(group)}
                  className="card p-3.5 hover:border-orange-500 cursor-pointer space-y-2 border-l-4 border-l-orange-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-orange-400">{group.group_id}</span>
                    <span className="badge bg-slate-900 text-slate-300 border-slate-700">
                      {group.report_count} Reports Merged
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{group.summary_card}</h4>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Centroid: {group.centroid_lat.toFixed(4)}, {group.centroid_lon.toFixed(4)}</span>
                    <span className="text-emerald-400 font-bold uppercase">{group.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responder Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="card max-w-md w-full space-y-4 border border-orange-500/50 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-white">Authorized Responder Authentication</h3>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Sign in with an official responder keypair to unlock cryptographic Ed25519 SOS acceptance.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">Select Authorized Responder</label>
                <select
                  value={loginResponderId}
                  onChange={(e) => setLoginResponderId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-sm font-semibold focus:border-orange-500 focus:outline-none"
                >
                  <option value="RESP-NDRF-01">Capt. A. Sharma (NDRF 4th Battalion - Flood Rescue)</option>
                  <option value="RESP-SDRF-02">Inspector M. Rao (SDRF Quick Response - Medical Lead)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">Responder Passcode</label>
                <input
                  type="password"
                  defaultValue="demo123"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-sm font-mono focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="btn btn-secondary text-xs py-2 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 font-bold">
                  Authenticate Responder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
