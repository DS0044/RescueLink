import React, { useState } from 'react';
import { Binary, Copy, Check, Info, Cpu } from 'lucide-react';

export default function PacketInspector({ rawHex, breakdown, packetId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!rawHex) return;
    navigator.clipboard.writeText(rawHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!rawHex) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <Binary className="w-8 h-8 text-orange-400" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
        <p className="text-helper">No raw binary packet selected for struct breakdown.</p>
      </div>
    );
  }

  // Format hex into 2-character pairs
  const hexPairs = rawHex.match(/.{1,2}/g) || [];

  return (
    <div className="card card-accent-top" style={{ marginTop: '20px' }}>
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu className="w-5 h-5 text-orange-500" />
          <h3 className="card-header-title">IECE 21-Byte Packet Inspector</h3>
        </div>
        {packetId && (
          <span className="font-mono text-caption" style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--accent-orange)' }}>
            {packetId}
          </span>
        )}
      </div>

      {/* Hex Stream Display */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
            Raw Binary Stream (Exactly 21 Bytes / 42 Hex Chars)
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-ghost"
            style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Hex'}</span>
          </button>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'var(--font-family-mono)',
          fontSize: '13px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          userSelect: 'all',
        }}>
          {hexPairs.map((pair, idx) => {
            let color = '#93A0BF';
            let bg = 'rgba(255, 255, 255, 0.05)';
            if (idx === 0) { color = '#D8B4FE'; bg = 'rgba(168, 85, 247, 0.15)'; }
            else if (idx >= 1 && idx <= 4) { color = '#93C5FD'; bg = 'rgba(59, 130, 246, 0.15)'; }
            else if (idx >= 5 && idx <= 8) { color = '#6EE7B7'; bg = 'rgba(16, 185, 129, 0.15)'; }
            else if (idx >= 9 && idx <= 12) { color = '#5EEAD4'; bg = 'rgba(20, 184, 166, 0.15)'; }
            else if (idx === 13) { color = '#FCA5A5'; bg = 'rgba(239, 68, 68, 0.15)'; }
            else if (idx >= 14 && idx <= 15) { color = '#FDE047'; bg = 'rgba(234, 179, 8, 0.15)'; }
            else if (idx === 16) { color = '#F9A8D4'; bg = 'rgba(244, 114, 182, 0.15)'; }
            else { color = '#C7D2FE'; bg = 'rgba(99, 102, 241, 0.15)'; }

            return (
              <span
                key={idx}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: bg,
                  color: color,
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                title={`Byte ${idx}: 0x${pair}`}
              >
                {pair}
              </span>
            );
          })}
        </div>
      </div>

      {/* Byte-by-byte Breakdown Table */}
      {breakdown && breakdown.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>
                <th style={{ padding: '8px 10px' }}>Offset</th>
                <th style={{ padding: '8px 10px' }}>Hex</th>
                <th style={{ padding: '8px 10px' }}>Field</th>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>Decoded Value</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'var(--font-family-mono)' }}>
              {breakdown.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '9px 10px', color: 'var(--accent-orange)', fontWeight: 600 }}>{item.offset}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.bytes_hex}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-family-sans)', fontWeight: 500, color: 'var(--text-primary)' }}>{item.field}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{item.type}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-family-sans)', fontWeight: 600, color: '#10B981' }}>
                    {item.description || item.raw_value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <Info className="w-4 h-4 text-orange-400" style={{ flexShrink: 0 }} />
        <span>
          <strong>IECE Compact Struct:</strong> Exactly 21 bytes minimize LoRa Time-on-Air to &lt;650ms at SF10 BW125.
        </span>
      </div>
    </div>
  );
}
