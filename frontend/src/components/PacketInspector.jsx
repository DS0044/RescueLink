import React, { useState } from 'react';
import { Binary, Copy, Check, Info, ShieldAlert, Cpu } from 'lucide-react';

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
      <div className="card text-center p-6 text-slate-400">
        <Binary className="w-8 h-8 mx-auto mb-2 opacity-40 text-orange-400" />
        <p className="text-sm">No raw packet selected for byte breakdown.</p>
      </div>
    );
  }

  // Format hex into 2-character pairs for display
  const hexPairs = rawHex.match(/.{1,2}/g) || [];

  return (
    <div className="card space-y-4" style={{ borderLeft: '4px solid #ff6600' }}>
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-bold text-white tracking-wide">
            IECE Compact 21-Byte Packet Inspector
          </h3>
        </div>
        {packetId && (
          <span className="font-mono text-xs px-2 py-1 rounded bg-slate-800 text-orange-400 border border-slate-700">
            {packetId}
          </span>
        )}
      </div>

      {/* Hex Stream Display */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Raw Binary Stream (Exactly 21 Bytes / 42 Hex Chars)
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-medium px-2 py-1 rounded bg-orange-950/40 border border-orange-800/40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Hex'}
          </button>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-sm tracking-wider flex flex-wrap gap-1.5 select-all">
          {hexPairs.map((pair, idx) => (
            <span
              key={idx}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                idx === 0
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                  : idx >= 1 && idx <= 4
                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                  : idx >= 5 && idx <= 8
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                  : idx >= 9 && idx <= 12
                  ? 'bg-teal-950/80 text-teal-300 border border-teal-800/50'
                  : idx === 13
                  ? 'bg-red-950/80 text-red-300 border border-red-800/50'
                  : idx >= 14 && idx <= 15
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                  : idx === 16
                  ? 'bg-pink-950/80 text-pink-300 border border-pink-800/50'
                  : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
              }`}
              title={`Byte ${idx}: 0x${pair}`}
            >
              {pair}
            </span>
          ))}
        </div>
      </div>

      {/* Byte-by-byte Breakdown Table */}
      {breakdown && breakdown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase bg-slate-900/60">
                <th className="py-2 px-3">Offset</th>
                <th className="py-2 px-3">Hex</th>
                <th className="py-2 px-3">Field</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Decoded Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {breakdown.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 text-orange-400 font-semibold">{item.offset}</td>
                  <td className="py-2.5 px-3 font-bold text-white tracking-widest">{item.bytes_hex}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-200">{item.field}</td>
                  <td className="py-2.5 px-3 text-slate-400">{item.type}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-emerald-400">
                    {item.description || item.raw_value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded border border-slate-800">
        <Info className="w-4 h-4 text-orange-400 flex-shrink-0" />
        <span>
          <strong>IECE Optimization:</strong> The entire emergency payload fits in <strong>21 bytes</strong>,
          minimizing LoRa Time-on-Air (ToA) to &lt;650ms at SF10 BW125 for maximum range and low battery drain.
        </span>
      </div>
    </div>
  );
}
