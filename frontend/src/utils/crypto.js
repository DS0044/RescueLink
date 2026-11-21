/**
 * RescueLink Client-side Cryptographic Verification
 * Verifies Ed25519 digital signatures on responder acknowledgements.
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
 * (sorted keys, no spaces between tokens)
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
 * Verifies an Ed25519 signed acknowledgement payload on the client side.
 * Returns { isValid: boolean, message: string, details: object }
 */
export async function verifySignedAcknowledgement(signedAck) {
  try {
    if (!signedAck) {
      return { isValid: false, message: 'No acknowledgement payload provided.' };
    }

    if (signedAck.is_tampered) {
      return {
        isValid: false,
        message: `REJECTED: ${signedAck.tamper_reason || 'Tampered payload detected'}`,
        isTampered: true,
      };
    }

    const { payload, signature_hex, public_key_hex } = signedAck;
    if (!payload || !signature_hex || !public_key_hex) {
      return { isValid: false, message: 'Incomplete acknowledgement cryptographic structure.' };
    }

    const canonicalJson = canonicalPayloadString(payload);
    const msgBytes = new TextEncoder().encode(canonicalJson);
    const sigBytes = hexToBytes(signature_hex);
    const pubBytes = hexToBytes(public_key_hex);

    if (sigBytes.length !== 64) {
      return { isValid: false, message: `Invalid Ed25519 signature length (${sigBytes.length} bytes, expected 64).` };
    }
    if (pubBytes.length !== 32) {
      return { isValid: false, message: `Invalid Ed25519 public key length (${pubBytes.length} bytes, expected 32).` };
    }

    // Verify using noble-ed25519
    const isValid = await ed.verifyAsync(sigBytes, msgBytes, pubBytes);

    if (isValid) {
      return {
        isValid: true,
        message: `Verified: Digitally signed by authorized responder (${payload.responder_name || payload.responder_id})`,
        responder: payload.responder_name,
        eta: payload.eta_minutes,
        timestamp: payload.timestamp,
        signaturePreview: signature_hex.substring(0, 16) + '...',
      };
    } else {
      return {
        isValid: false,
        message: 'CRYPTOGRAPHIC FAILURE: Ed25519 signature does not match payload! Possible spoofing or payload forgery.',
      };
    }
  } catch (err) {
    return {
      isValid: false,
      message: `Signature verification exception: ${err.message}`,
    };
  }
}
