/**
 * RescueLink Client-side Cryptographic Verification & Geospatial Utilities
 * - Verifies Ed25519 digital signatures on responder acknowledgements and 16B downlink packets.
 * - Provides Web Audio alert chimes & tactile vibration for message alerts.
 * - Provides offline Haversine distance, compass bearing, and GPX/KML exporters.
 */
import * as ed from '@noble/ed25519';

// Configure sha512 for @noble/ed25519 using Web Crypto API
if (!ed.etc.sha512Sync) {
  ed.etc.sha512Async = async (...messages) => {
    const concatenated = new Uint8Array(messages.reduce((acc, m) => acc + m.length, 0));
    let offset = 0;
    for (const m of messages) {
      concatenated.set(m, offset);
      offset += m.length;
    }
    const hashBuffer = await crypto.subtle.digest('SHA-512', concatenated);
    return new Uint8Array(hashBuffer);
  };
}

/**
 * Format payload object into canonical deterministic JSON string
 */
export function canonicalPayloadString(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const sortedKeys = Object.keys(payload).sort();
  const sortedObj = {};
  for (const k of sortedKeys) {
    sortedObj[k] = payload[k];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Converts hex string to Uint8Array
 */
export function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verifies an Ed25519 signed acknowledgement or downlink message.
 * Supports both 16-byte binary payload (payload_hex) and JSON payload.
 */
export async function verifySignedAcknowledgement(signedAck) {
  try {
    if (!signedAck) {
      return { isValid: false, message: 'No acknowledgement payload provided.' };
    }

    if (signedAck.is_tampered) {
      return {
        isValid: false,
        message: `REJECTED: ${signedAck.tamper_reason || 'Tampered payload or signature detected'}`,
        isTampered: true,
      };
    }

    const { payload, payload_hex, signature_hex, public_key_hex } = signedAck;
    if ((!payload && !payload_hex) || !signature_hex || !public_key_hex) {
      return { isValid: false, message: 'Incomplete acknowledgement cryptographic structure.' };
    }

    let msgBytes;
    if (payload_hex && payload_hex.length === 32) {
      // Compact 16-byte binary radio downlink payload
      msgBytes = hexToBytes(payload_hex);
    } else if (payload) {
      // Canonical JSON payload
      const canonicalJson = canonicalPayloadString(payload);
      msgBytes = new TextEncoder().encode(canonicalJson);
    } else {
      return { isValid: false, message: 'Unsupported payload representation.' };
    }

    const sigBytes = hexToBytes(signature_hex);
    const pubBytes = hexToBytes(public_key_hex);

    if (sigBytes.length !== 64) {
      return { isValid: false, message: `Invalid Ed25519 signature length (${sigBytes.length} bytes, expected 64).` };
    }
    if (pubBytes.length !== 32) {
      return { isValid: false, message: `Invalid Ed25519 public key length (${pubBytes.length} bytes, expected 32).` };
    }

    const isValid = await ed.verifyAsync(sigBytes, msgBytes, pubBytes);

    if (isValid) {
      const respName = payload?.responder_name || signedAck?.responder_name || 'Authorized Responder';
      return {
        isValid: true,
        message: `Verified: Digitally signed by authorized responder (${respName})`,
        responder: respName,
        eta: payload?.eta_minutes ?? signedAck?.eta_minutes,
        timestamp: payload?.timestamp ?? signedAck?.timestamp,
        signaturePreview: signature_hex.substring(0, 16) + '...',
      };
    } else {
      return {
        isValid: false,
        message: 'CRYPTOGRAPHIC FAILURE: Ed25519 signature does not match payload! Forged or tampered message rejected.',
      };
    }
  } catch (err) {
    return {
      isValid: false,
      message: `Signature verification error: ${err.message}`,
    };
  }
}

/**
 * Synthesizes a clean two-tone alert chime using Web Audio API.
 * No external audio files or network requests required.
 */
export function playAlertChime(isMuted = false) {
  if (isMuted) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First tone (E5: 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone (G5: 783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0.16, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Audio context may be restricted by autoplay policy
  }
}

/**
 * Triggers short haptic vibration on mobile devices
 */
export function triggerVibration() {
  try {
    if (navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([180, 80, 180]);
    }
  } catch (e) {
    // Vibration not supported
  }
}

/**
 * Calculate Great Circle Distance in kilometers (Haversine formula)
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate initial compass bearing from Point 1 to Point 2 in degrees (0-360) and cardinal direction.
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180.0) * Math.cos((lat2 * Math.PI) / 180.0);
  const x =
    Math.cos((lat1 * Math.PI) / 180.0) * Math.sin((lat2 * Math.PI) / 180.0) -
    Math.sin((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180.0);
  const deg = ((Math.atan2(y, x) * 180.0) / Math.PI + 360.0) % 360.0;

  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const cardIndex = Math.round(deg / 45.0);
  return {
    degrees: Math.round(deg),
    cardinal: cardinals[cardIndex],
    formatted: `${Math.round(deg)}° (${cardinals[cardIndex]})`,
  };
}

/**
 * Client-side GPX XML generator
 */
export function downloadGpx(sos) {
  const name = `RescueLink_${sos.packet_id || sos.victim_id}`;
  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RescueLink Offline Emergency System" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Emergency SOS Extraction Waypoint</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <wpt lat="${sos.latitude}" lon="${sos.longitude}">
    <name>${sos.emergency_type_label || 'Emergency SOS'} (Node #${sos.victim_id})</name>
    <desc>Priority: ${sos.severity_label || 'P1'} | People: ${sos.people_count || 1} | GPS Age: ${sos.gps_age_sec || 0}s</desc>
    <sym>Emergency</sym>
  </wpt>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Client-side KML generator
 */
export function downloadKml(sos) {
  const name = `RescueLink_${sos.packet_id || sos.victim_id}`;
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>RescueLink Emergency Evacuation Target</description>
    <Placemark>
      <name>${sos.emergency_type_label || 'Emergency SOS'} (#${sos.victim_id})</name>
      <description>Priority: ${sos.severity_label || 'P1'}, People: ${sos.people_count || 1}</description>
      <Point>
        <coordinates>${sos.longitude},${sos.latitude},0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.kml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
