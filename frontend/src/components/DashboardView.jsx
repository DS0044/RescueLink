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
  Copy,
  Check,
  Download,
  ExternalLink,
  Target,
  Maximize2,
  Navigation,
  Send,
  Truck,
  Anchor,
  Plane,
  Footprints,
} from 'lucide-react';
import PacketInspector from './PacketInspector';
import {
  haversineDistanceKm,
  calculateBearing,
  downloadGpx,
  downloadKml,
} from '../utils/crypto';

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
  const [acceptingSos, setAcceptingSos] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const [isOfflineGrid, setIsOfflineGrid] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState('');

  // Responder Acceptance Form State
  const [selectedTeamType, setSelectedTeamType] = useState(1); // 1: Boat, 2: Ambulance, 3: Fire, 4: Heli, 5: Foot
  const [customEta, setCustomEta] = useState(15);
  const [selectedNoteCode, setSelectedNoteCode] = useState(1);
  const [customNoteText, setCustomNoteText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Configurable Rescue Base Station
  const [baseStation, setBaseStation] = useState({
    lat: 13.0827,
    lon: 80.2707,
    label: 'State Disaster Operations Base (Cooum)',
  });

  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});
  const accuracyCircleRef = useRef(null);
  const routeLineRef = useRef(null);
  const baseMarkerRef = useRef(null);
  const groupCirclesRef = useRef([]);
  const cardRefs = useRef({});

  // Team types configuration
  const teamTypes = [
    { id: 1, name: 'Boat Rescue Team', speed: 20, icon: Anchor },
    { id: 2, name: 'Ambulance / Medical', speed: 40, icon: Truck },
    { id: 3, name: 'Fire & Rescue Unit', speed: 35, icon: Flame },
    { id: 4, name: 'Air Rescue (Helicopter)', speed: 150, icon: Plane },
    { id: 5, name: 'Foot Patrol Team', speed: 5, icon: Footprints },
  ];

  const notePresets = [
    { code: 1, text: 'Stay where you are' },
    { code: 2, text: 'Move to higher ground' },
    { code: 3, text: 'Show a light or signal' },
    { code: 4, text: 'Stay on roof / elevated structure' },
    { code: 5, text: 'Conserve phone battery' },
    { code: 6, text: 'Help is right outside' },
  ];

  // Stats calculation
  const totalReports = reports.length;
  const criticalP1Count = reports.filter((r) => r.severity === 1).length;
  const totalClusters = groups.length;
  const acceptedCount = reports.filter((r) => r.status === 'accepted' || r.status === 'en_route' || r.status === 'arriving_soon' || r.status === 'arrived').length;

  const getPriorityColor = (sev) => {
    switch (sev) {
      case 1: return '#EF4444'; // Red P1
      case 2: return '#FF6A1A'; // Orange P2
      case 3: return '#EAB308'; // Yellow P3
      default: return '#10B981'; // Green P4
    }
  };

  // Keyboard navigation: Esc clears selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedSos(null);
        setSelectedGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync selection when reports update
  useEffect(() => {
    if (selectedSos) {
      const updated = reports.find((r) => r.packet_id === selectedSos.packet_id);
      if (updated) {
        setSelectedSos(updated);
      }
    }
  }, [reports]);

  // Recalculate suggested ETA when acceptance modal opens or team type changes
  useEffect(() => {
    if (acceptingSos && baseStation) {
      const dist = haversineDistanceKm(
        baseStation.lat,
        baseStation.lon,
        acceptingSos.latitude,
        acceptingSos.longitude
      );
      const team = teamTypes.find((t) => t.id === selectedTeamType) || teamTypes[0];
      const travelHours = dist / team.speed;
      const travelMin = travelHours * 60;
      const suggested = Math.max(1, Math.round(travelMin + 2));
      setCustomEta(suggested);
    }
  }, [acceptingSos, selectedTeamType, baseStation]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([baseStation.lat, baseStation.lon], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | RescueLink Offline Engine',
        maxZoom: 18,
      }).addTo(map);

      // Click empty map area clears selection
      map.on('click', (e) => {
        // Only clear if clicked directly on map canvas
        if (e.originalEvent.target.tagName !== 'BUTTON' && !e.originalEvent.target.closest('.custom-leaflet-marker')) {
          setSelectedSos(null);
          setSelectedGroup(null);
        }
      });

      leafletMap.current = map;
    }
  }, []);

  // Update Base Station Marker on Map
  useEffect(() => {
    const map = leafletMap.current;
    const L = window.L;
    if (!map || !L) return;

    if (baseMarkerRef.current) {
      baseMarkerRef.current.remove();
    }

    const baseHtml = `
      <div style="
        background: #0A0F1E;
        color: #FF6A1A;
        border: 2px solid #FF6A1A;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 14px rgba(255, 106, 26, 0.6);
        cursor: pointer;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
      </div>
    `;

    const baseIcon = L.divIcon({
      className: 'custom-base-marker',
      html: baseHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([baseStation.lat, baseStation.lon], { icon: baseIcon, zIndexOffset: 900 })
      .addTo(map)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 13px; color: #E8EDF7; background: #121A2F; padding: 6px;">
          <strong style="color: #FF6A1A; font-size: 14px;">Rescue Operations Base</strong><br/>
          <span>${baseStation.label}</span><br/>
          <span style="font-family: monospace; color: #93A0BF;">${baseStation.lat.toFixed(4)}°, ${baseStation.lon.toFixed(4)}°</span>
        </div>
      `);

    baseMarkerRef.current = marker;
  }, [baseStation]);

  // Render SOS & Cluster Markers on the Map
  useEffect(() => {
    const map = leafletMap.current;
    const L = window.L;
    if (!map || !L) return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // Clear previous group sub-circles
    groupCirclesRef.current.forEach((c) => c.remove());
    groupCirclesRef.current = [];

    // Micro-offset map for duplicate/overlapping coordinates
    const coordUsage = {};

    reports.forEach((rep) => {
      let lat = rep.latitude;
      let lon = rep.longitude;

      if (!lat || !lon || isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
        return;
      }

      const coordKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
      if (coordUsage[coordKey]) {
        // Offset slightly (~12 meters) so both markers remain selectable
        const offsetIdx = coordUsage[coordKey];
        lat += (offsetIdx % 2 === 0 ? 1 : -1) * 0.00012 * Math.ceil(offsetIdx / 2);
        lon += (offsetIdx % 2 === 1 ? 1 : -1) * 0.00012 * Math.ceil(offsetIdx / 2);
        coordUsage[coordKey] += 1;
      } else {
        coordUsage[coordKey] = 1;
      }

      const isSelected = selectedSos?.packet_id === rep.packet_id;
      const isDimmed = selectedSos && !isSelected;
      const color = getPriorityColor(rep.severity);

      // Pulse ring and size change when selected
      const size = isSelected ? 38 : 26;
      const iconHtml = `
        <div class="${isSelected ? 'selected-marker-pulse' : ''} ${isDimmed ? 'dimmed-marker' : ''}" style="
          background: ${color};
          color: white;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: ${isSelected ? '14px' : '11px'};
          border: 2px solid #0A0F1E;
          box-shadow: 0 0 ${isSelected ? '20px' : '8px'} ${color};
          cursor: pointer;
          transition: all 0.25s ease;
        ">
          ${rep.people_count > 1 ? rep.people_count : 'SOS'}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      // GPS Fix Age Status text and color
      const age = rep.gps_age_sec || 0;
      let ageColor = '#10B981';
      let ageText = `${age}s ago (Live GNSS)`;
      let ageWarning = '';
      if (age >= 300) {
        ageColor = '#EF4444';
        ageText = `${Math.floor(age / 60)}m ago`;
        ageWarning = '<div style="color: #F87171; font-size: 11px; margin-top: 4px; font-weight: 700;">⚠ Location may be outdated (>5m fix)</div>';
      } else if (age >= 60) {
        ageColor = '#F59E0B';
        ageText = `${Math.floor(age / 60)}m ${age % 60}s ago`;
      }

      const marker = L.marker([lat, lon], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      }).addTo(map);

      // Popup card matching specs
      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 13px; line-height: 1.4; color: #E8EDF7; background: #121A2F; padding: 6px; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: ${color}; font-size: 14px;">${rep.emergency_type_label}</strong>
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); font-weight: 700; color: ${color};">${rep.severity_label}</span>
          </div>
          <div style="margin-bottom: 4px; font-weight: 600;">People in distress: <strong style="color: #FF6A1A;">${rep.people_count}</strong></div>
          <div style="font-family: monospace; font-size: 12px; color: #93A0BF; margin-bottom: 4px;">
            ${lat.toFixed(6)}°, ${lon.toFixed(6)}°
          </div>
          <div style="font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${ageColor}; display: inline-block;"></span>
            <span>GPS Age: <strong style="color: ${ageColor}">${ageText}</strong></span>
          </div>
          ${ageWarning}
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: #6EE7B7;">
            Status: <strong>${(rep.status || 'pending').toUpperCase()}</strong> ${rep.eta_minutes ? `(~${rep.eta_minutes}m ETA)` : ''}
          </div>
        </div>
      `);

      marker.on('click', () => {
        handleSelectSos(rep, false);
      });

      markersRef.current[rep.packet_id] = marker;
    });

    // If a cluster is selected, draw individual victim dots and cluster area
    if (selectedGroup && selectedGroup.reports) {
      const groupColor = getPriorityColor(selectedGroup.severity);
      // Group radius circle (50m)
      const groupCircle = L.circle([selectedGroup.centroid_lat, selectedGroup.centroid_lon], {
        radius: 50,
        color: groupColor,
        fillColor: groupColor,
        fillOpacity: 0.12,
        dashArray: '6, 6',
      }).addTo(map);
      groupCirclesRef.current.push(groupCircle);

      // Render individual sub-victim dots
      selectedGroup.reports.forEach((subRep, sIdx) => {
        const subHtml = `
          <div style="
            background: #10B981;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 8px #10B981;
          "></div>
        `;
        const subIcon = L.divIcon({
          className: 'sub-victim-dot',
          html: subHtml,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const subMarker = L.marker([subRep.latitude, subRep.longitude], { icon: subIcon })
          .addTo(map)
          .bindTooltip(`Victim #${subRep.victim_id} (${subRep.people_count} person)`, { direction: 'top' });
        groupCirclesRef.current.push(subMarker);
      });
    }
  }, [reports, selectedSos, selectedGroup]);

  // Handle SOS Selection: Fly map, draw accuracy circle & route line
  const handleSelectSos = (sos, shouldScrollList = true) => {
    setSelectedSos(sos);
    setSelectedGroup(null);
    setSrAnnouncement(`Selected SOS Node ${sos.victim_id} at coordinates ${sos.latitude.toFixed(4)}, ${sos.longitude.toFixed(4)}`);

    const map = leafletMap.current;
    const L = window.L;
    if (!map || !L) return;

    const lat = sos.latitude;
    const lon = sos.longitude;

    if (lat && lon && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
      // 1. Smooth flyTo (600ms, zoom 16)
      map.flyTo([lat, lon], 16, { animate: true, duration: 0.6 });

      // 2. Open marker popup
      const marker = markersRef.current[sos.packet_id];
      if (marker) {
        marker.openPopup();
      }

      // 3. Draw Accuracy / Uncertainty Circle
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
      }
      const age = sos.gps_age_sec || 0;
      const radius = Math.min(500, Math.max(10, Math.round(10 + 1.5 * age)));
      const priorityColor = getPriorityColor(sos.severity);

      const circle = L.circle([lat, lon], {
        radius: radius,
        color: priorityColor,
        fillColor: priorityColor,
        fillOpacity: 0.15,
        dashArray: '6, 6',
        weight: 2,
      }).addTo(map);

      circle.bindTooltip(`Estimated position area (~${radius}m uncertainty)`, {
        permanent: false,
        direction: 'center',
      });
      accuracyCircleRef.current = circle;

      // 4. Draw Route Line from Base Station
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }
      const distKm = haversineDistanceKm(baseStation.lat, baseStation.lon, lat, lon);
      const bearingInfo = calculateBearing(baseStation.lat, baseStation.lon, lat, lon);

      const line = L.polyline(
        [
          [baseStation.lat, baseStation.lon],
          [lat, lon],
        ],
        {
          color: '#FF6A1A',
          weight: 2.5,
          dashArray: '8, 8',
          opacity: 0.85,
        }
      ).addTo(map);

      line.bindTooltip(
        `Straight-line direct vector: ${distKm.toFixed(2)} km (${bearingInfo.cardinal}) - Not a road route`,
        { permanent: false, direction: 'top' }
      );
      routeLineRef.current = line;
    }

    // Scroll corresponding card into view in triage list
    if (shouldScrollList && cardRefs.current[sos.packet_id]) {
      cardRefs.current[sos.packet_id].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  };

  // Clear Map Selection Elements when deselecting
  useEffect(() => {
    if (!selectedSos) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    }
  }, [selectedSos]);

  // Map Controls: Fit All Markers
  const handleFitAll = () => {
    const map = leafletMap.current;
    const L = window.L;
    if (!map || !L || reports.length === 0) return;

    const validCoords = reports
      .filter((r) => r.latitude && r.longitude && !isNaN(r.latitude) && !isNaN(r.longitude))
      .map((r) => [r.latitude, r.longitude]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // Map Controls: Focus Critical (P1 & P2 only)
  const handleFocusCritical = () => {
    const map = leafletMap.current;
    const L = window.L;
    if (!map || !L) return;

    const criticalCoords = reports
      .filter((r) => (r.severity === 1 || r.severity === 2) && r.latitude && r.longitude)
      .map((r) => [r.latitude, r.longitude]);

    if (criticalCoords.length > 0) {
      const bounds = L.latLngBounds(criticalCoords);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      handleFitAll();
    }
  };

  // Map Controls: Set Rescue Base at current map center
  const handleSetBaseHere = () => {
    const map = leafletMap.current;
    if (!map) return;
    const center = map.getCenter();
    setBaseStation({
      lat: Number(center.lat.toFixed(6)),
      lon: Number(center.lng.toFixed(6)),
      label: 'Field Responder Mobile Base Station',
    });
  };

  // Copy coordinates to clipboard
  const handleCopyCoordinates = (lat, lon) => {
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCoord(true);
      setTimeout(() => setCopiedCoord(false), 2000);
    }
  };

  // Open Accept Modal
  const initiateAccept = (sos) => {
    if (!activeResponder) {
      setShowLoginModal(true);
      return;
    }
    setAcceptingSos(sos);
    setShowAcceptModal(true);
  };

  // Confirm Acceptance and dispatch signed downlink
  const handleConfirmAcceptance = async () => {
    if (!acceptingSos) return;
    setUpdatingStatus(true);
    try {
      const payload = {
        responder_id: activeResponder.id,
        responder_name: activeResponder.name,
        team_type: Number(selectedTeamType),
        eta_minutes: Number(customEta),
        note_code: Number(selectedNoteCode),
        note_text: customNoteText || undefined,
      };

      const res = await fetch(`/api/sos/${acceptingSos.packet_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setShowAcceptModal(false);
        setAcceptingSos(null);
        if (onAcceptSos) onAcceptSos(data);
      } else {
        const err = await res.json();
        alert(`Acceptance failed: ${err.detail || 'Error'}`);
      }
    } catch (err) {
      alert(`Acceptance error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Advance Mission Lifecycle Status (En Route, Arriving Soon, Arrived)
  const handleUpdateStatus = async (sosId, nextStatus, overrideEta = null) => {
    setUpdatingStatus(true);
    try {
      const payload = {
        status: nextStatus,
        responder_id: activeResponder?.id || 'RESP-NDRF-01',
        eta_minutes: overrideEta,
      };
      const res = await fetch(`/api/sos/${sosId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Status update failed: ${err.detail || 'State Machine Restriction'}`);
      }
    } catch (err) {
      alert(`Status update error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    onLogin(loginResponderId);
    setShowLoginModal(false);
  };

  // Selected SOS Location Math
  const hasValidLocation =
    selectedSos &&
    selectedSos.latitude &&
    selectedSos.longitude &&
    !isNaN(selectedSos.latitude) &&
    !isNaN(selectedSos.longitude) &&
    (selectedSos.latitude !== 0 || selectedSos.longitude !== 0);

  const directDistance = hasValidLocation
    ? haversineDistanceKm(baseStation.lat, baseStation.lon, selectedSos.latitude, selectedSos.longitude)
    : null;

  const bearing = hasValidLocation
    ? calculateBearing(baseStation.lat, baseStation.lon, selectedSos.latitude, selectedSos.longitude)
    : null;

  return (
    <div className="dashboard-page-wrapper">
      {/* Screen Reader Live Region */}
      <div aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>

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
                  const isAccepted = item.status === 'accepted' || item.status === 'en_route' || item.status === 'arriving_soon' || item.status === 'arrived';

                  return (
                    <div
                      key={item.packet_id}
                      ref={(el) => (cardRefs.current[item.packet_id] = el)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectSos(item, false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectSos(item, false);
                        }
                      }}
                      className={`sos-card-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="sos-card-top">
                        <span className={`badge-priority ${priorityClass}`}>
                          {item.severity_label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.team_type_label && (
                            <span className="badge-priority" style={{ backgroundColor: 'rgba(255,106,26,0.1)', color: 'var(--accent-orange)' }}>
                              {item.team_type_label.split(' ')[0]}
                            </span>
                          )}
                          <span
                            className="badge-priority"
                            style={{
                              backgroundColor: isAccepted ? 'var(--color-success-subtle)' : 'var(--color-warning-subtle)',
                              color: isAccepted ? '#6EE7B7' : '#FCD34D',
                              borderColor: isAccepted ? 'var(--color-success-border)' : 'var(--color-warning-border)',
                            }}
                          >
                            {(item.status || 'pending').replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
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

                      {item.eta_minutes !== undefined && item.eta_minutes !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#10B981', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                          <span>Est. Arrival: <strong>~{item.eta_minutes} min (estimated)</strong></span>
                          <span>Delivery: <strong>{item.delivery_status || 'delivered'}</strong></span>
                        </div>
                      )}
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
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedSos(null);
                    const map = leafletMap.current;
                    if (map) {
                      map.flyTo([group.centroid_lat, group.centroid_lon], 16, { animate: true, duration: 0.6 });
                    }
                  }}
                  className="card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${getPriorityColor(group.severity)}`,
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
            {/* Multi-Select & Map Action Bar */}
            <div className="map-actions-overlay">
              <button type="button" onClick={handleFitAll} className="map-action-pill" title="Fit all active emergencies on map">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Show All ({reports.length})</span>
              </button>
              <button type="button" onClick={handleFocusCritical} className="map-action-pill" title="Zoom to P1 and P2 high severity incidents">
                <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                <span>Focus Critical ({criticalP1Count})</span>
              </button>
              <button type="button" onClick={handleSetBaseHere} className="map-action-pill" title="Relocate responder command base to map center">
                <Target className="w-3.5 h-3.5 text-orange-400" />
                <span>Set Base Here</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOfflineGrid(!isOfflineGrid)}
                className="map-action-pill"
                style={{ borderColor: isOfflineGrid ? '#FF6A1A' : undefined }}
                title="Toggle offline simulated grid overlay"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{isOfflineGrid ? 'Grid: Active' : 'Offline Grid'}</span>
              </button>
            </div>

            {/* Offline Grid Canvas Fallback when toggled */}
            {isOfflineGrid && (
              <div className="offline-grid-overlay">
                <div className="offline-scale-badge">
                  OFFLINE TACTICAL GRID | SCALE: 1:50,000 | DATUM: WGS84
                </div>
              </div>
            )}

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

          {/* Selected SOS Incident Detail Drawer / Bottom Sheet */}
          {selectedSos && (
            <div className="detail-drawer card-accent-top">
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge-priority ${selectedSos.severity === 1 ? 'p1' : selectedSos.severity === 2 ? 'p2' : selectedSos.severity === 3 ? 'p3' : 'p4'}`}>
                    {selectedSos.severity_label}
                  </span>
                  <h3 className="card-header-title">{selectedSos.emergency_type_label} (Node #{selectedSos.victim_id})</h3>
                </div>
                <button
                  onClick={() => setSelectedSos(null)}
                  className="icon-btn-round"
                  aria-label="Close detail panel (Esc)"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SPEC SECTION 2: LOCATION FIX & GEOSPATIAL PANEL */}
              <div className="location-drawer-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      Location Fix & Direct Vector
                    </span>
                  </div>
                  <span className="status-chip" style={{ height: '22px', fontSize: '11px' }}>
                    {selectedSos.gps_age_sec <= 60 ? 'Live GNSS Fix' : 'Buffered Location'}
                  </span>
                </div>

                {hasValidLocation ? (
                  <>
                    <div className="location-coord-row">
                      <div>
                        <span className="text-tertiary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                          WGS84 Coordinates (6 Decimals)
                        </span>
                        <span className="location-coord-text">
                          {selectedSos.latitude.toFixed(6)}° N, {selectedSos.longitude.toFixed(6)}° E
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCoordinates(selectedSos.latitude, selectedSos.longitude)}
                        className="btn btn-secondary"
                        style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                      >
                        {copiedCoord ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCoord ? 'Copied!' : 'Copy Coordinates'}</span>
                      </button>
                    </div>

                    <div className="location-metrics-grid">
                      <div className="location-metric-box">
                        <span className="text-tertiary">GPS Fix Age</span>
                        <span style={{ color: selectedSos.gps_age_sec >= 300 ? '#EF4444' : selectedSos.gps_age_sec >= 60 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>
                          {selectedSos.gps_age_sec || 0}s ago
                        </span>
                      </div>
                      <div className="location-metric-box">
                        <span className="text-tertiary">Direct Distance</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                          {directDistance ? `${directDistance.toFixed(2)} km` : 'Calculating...'}
                        </span>
                      </div>
                      <div className="location-metric-box">
                        <span className="text-tertiary">Bearing Vector</span>
                        <span style={{ color: '#FF6A1A', fontWeight: 700 }}>
                          {bearing ? bearing.formatted : 'N/A'}
                        </span>
                      </div>
                      <div className="location-metric-box">
                        <span className="text-tertiary">Position Uncertainty</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                          ±{Math.min(500, Math.max(10, Math.round(10 + 1.5 * (selectedSos.gps_age_sec || 0))))}m
                        </span>
                      </div>
                    </div>

                    {/* Offline Straight-line direct route note */}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Navigation className="w-3.5 h-3.5 text-orange-400" />
                      <span>Straight-line distance (not a road route) from {baseStation.label}.</span>
                    </div>

                    {/* External Map Links & GPX/KML Download Buttons */}
                    <div className="location-export-row">
                      <a
                        href={`https://www.google.com/maps?q=${selectedSos.latitude},${selectedSos.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-export-ghost"
                        title="View on Google Maps (Online only)"
                      >
                        <ExternalLink className="w-3 h-3 text-orange-400" />
                        <span>Google Maps</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>(Online)</span>
                      </a>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${selectedSos.latitude}&mlon=${selectedSos.longitude}#map=16/${selectedSos.latitude}/${selectedSos.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-export-ghost"
                        title="View on OpenStreetMap (Online only)"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        <span>OpenStreetMap</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>(Online)</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => downloadGpx(selectedSos)}
                        className="btn-export-ghost"
                        title="Download waypoint as GPX file for handheld GPS / ATAK"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download GPX</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadKml(selectedSos)}
                        className="btn-export-ghost"
                        title="Download KML file for Google Earth"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download KML</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger)', color: '#F87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Location unavailable: Valid coordinates were not established in the received radio telemetry packet.</span>
                  </div>
                )}
              </div>

              {/* RESPONDER MISSION DISPATCH & STATUS MACHINE CONTROLS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    Responder Mission State Machine
                  </span>
                  {selectedSos.delivery_status && (
                    <span className="status-chip" style={{ height: '22px', fontSize: '11px', color: '#10B981' }}>
                      Downlink: {selectedSos.delivery_status}
                    </span>
                  )}
                </div>

                {activeResponder ? (
                  selectedSos.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => initiateAccept(selectedSos)}
                      className="btn btn-primary"
                      style={{ height: '44px', fontWeight: 700 }}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Accept SOS & Sign Downlink Acknowledgement</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--color-success-subtle)', border: '1px solid var(--color-success-border)', color: '#6EE7B7', fontSize: '13px' }}>
                        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>
                          Assigned to: <strong>{selectedSos.responder_name}</strong> ({selectedSos.team_type_label || 'Boat Team'}) | ETA: ~{selectedSos.eta_minutes || 0}m (estimated)
                        </span>
                      </div>

                      {/* Action buttons for En Route -> Arriving Soon -> Arrived */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={updatingStatus || selectedSos.status === 'en_route'}
                          onClick={() => handleUpdateStatus(selectedSos.packet_id, 'en_route')}
                          className="btn btn-secondary"
                          style={{ height: '36px', fontSize: '12px', flex: 1 }}
                        >
                          <Navigation className="w-3.5 h-3.5 text-orange-400" />
                          <span>Mark En Route</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingStatus || selectedSos.status === 'arriving_soon'}
                          onClick={() => handleUpdateStatus(selectedSos.packet_id, 'arriving_soon', 4)}
                          className="btn btn-secondary"
                          style={{ height: '36px', fontSize: '12px', flex: 1 }}
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Arriving Soon (&lt;5m)</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingStatus || selectedSos.status === 'arrived'}
                          onClick={() => handleUpdateStatus(selectedSos.packet_id, 'arrived', 0)}
                          className="btn btn-secondary"
                          style={{ height: '36px', fontSize: '12px', flex: 1, borderColor: '#10B981', color: '#10B981' }}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Mark Arrived</span>
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
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
                    onClick={() => handleSelectSos(rep, true)}
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
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        Victim #{rep.victim_id} - {rep.emergency_type_label}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-family-mono)' }}>
                        {rep.latitude.toFixed(4)}°, {rep.longitude.toFixed(4)}° ({rep.gps_age_sec}s age)
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>
                      {rep.people_count} Person(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESPONDER ACCEPTANCE MODAL */}
      {showAcceptModal && acceptingSos && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <h3 className="modal-title">Authorize Mission & Sign Downlink</h3>
              </div>
              <button onClick={() => setShowAcceptModal(false)} className="icon-btn-round">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
              <div>
                <label className="input-label">Lead Responder (Authenticated)</label>
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', fontSize: '13px', color: '#6EE7B7', fontWeight: 600 }}>
                  {activeResponder.name} ({activeResponder.id})
                </div>
              </div>

              <div>
                <label className="input-label">Select Deployment Team Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {teamTypes.map((team) => {
                    const Icon = team.icon;
                    const isSelected = selectedTeamType === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamType(team.id)}
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ height: '38px', fontSize: '12px', justifyContent: 'flex-start', padding: '0 10px' }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{team.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Estimated Arrival (Minutes)</label>
                  <span style={{ fontSize: '11px', color: '#10B981' }}>Haversine Auto-Calculated</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={customEta}
                  onChange={(e) => setCustomEta(e.target.value)}
                  className="input-field font-mono"
                  style={{ height: '40px' }}
                />
              </div>

              <div>
                <label className="input-label">Downlink Instruction Note (Preset Code)</label>
                <select
                  value={selectedNoteCode}
                  onChange={(e) => setSelectedNoteCode(Number(e.target.value))}
                  className="input-field"
                  style={{ height: '40px' }}
                >
                  {notePresets.map((np) => (
                    <option key={np.code} value={np.code}>
                      Code {np.code}: "{np.text}"
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAcceptModal(false)} className="btn btn-secondary" style={{ height: '40px' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmAcceptance}
                disabled={updatingStatus}
                className="btn btn-primary"
                style={{ height: '40px' }}
              >
                {updatingStatus ? 'Signing Downlink...' : 'Sign & Transmit over LoRa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responder Login Modal */}
      {showLoginModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound className="w-5 h-5 text-orange-500" />
                <h3 className="modal-title">Responder Authentication</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="icon-btn-round" aria-label="Close dialog">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <p className="text-helper">
                Only authenticated rescue commanders holding an Ed25519 cryptographic key pair can approve SOS dispatches and issue verified digital signatures to victim nodes.
              </p>

              <div className="input-field-wrapper">
                <label className="input-label">Select Responder Identity</label>
                <select
                  value={loginResponderId}
                  onChange={(e) => setLoginResponderId(e.target.value)}
                  className="input-field"
                  style={{ height: '42px' }}
                >
                  <option value="RESP-NDRF-01">Capt. A. Sharma (NDRF 4th Bn - Flood Lead)</option>
                  <option value="RESP-SDRF-02">Inspector M. Rao (SDRF - Medical & Evac)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowLoginModal(false)} className="btn btn-secondary" style={{ height: '40px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
                  Authenticate & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
