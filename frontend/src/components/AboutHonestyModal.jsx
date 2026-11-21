import React from 'react';
import { Shield, Radio, Satellite, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AboutHonestyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4 overflow-y-auto">
      <div className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 border border-orange-500/50 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Satellite className="w-6 h-6 text-orange-500" />
            <h3 className="text-xl font-black text-white">RESCUE LINK | System Architecture & Honesty Disclosure</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        {/* Honesty Disclosure Banner */}
        <div className="p-4 rounded-xl bg-orange-950/40 border border-orange-600/50 space-y-2">
          <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>ASTRA Hackathon Scope & Operational Honesty</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            The current live prototype uses <strong>terrestrial LoRa (SX1276/SX1278)</strong> and <strong>GNSS (GPS/NavIC)</strong> positioning.
            It is <strong>NOT direct satellite transmission from handheld devices</strong> (which requires dedicated L/S band or phased array satellite terminals).
            Direct low-Earth-orbit (LEO) satellite gateway backhaul (e.g. Astrocast, FossaSat, Starlink Direct-to-Cell) is modeled as the backhaul layer for isolated gateway relays.
          </p>
        </div>

        {/* Real vs Simulated Comparison Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Real vs. Simulated Subsystem Audit
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Subsystem</th>
                  <th className="py-2.5 px-3">Status in Demo</th>
                  <th className="py-2.5 px-3">Technical Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">IECE 21-Byte Packet Engine</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">100% REAL</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Exact 21-byte binary struct encoding, microdegree packing & unpacking</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">IECE Priority Queue (P1-P4)</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">100% REAL</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Preemptive triage heap ordering critical cardiac P1 ahead of P3</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">Duplicate Cluster Grouping</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">100% REAL</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Haversine 50m spatial & temporal clustering preserving victim reports</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">Ed25519 Cryptographic Signatures</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">100% REAL</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Asymmetric responder signing and browser verification with tamper detection</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">LoRa Physical Layer (Default)</td>
                  <td className="py-2 px-3 text-amber-400 font-bold">SOFTWARE SIMULATED</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Accurate Time-on-Air, configurable packet loss, RSSI/SNR jitter</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">Hardware LoRa Gateway</td>
                  <td className="py-2 px-3 text-cyan-400 font-bold">SUPPORTED (C++ / ESP32)</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Optional ESP32 + SX1276 C++ firmware and serial bridge included in repo</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-white">Satellite Backhaul Link</td>
                  <td className="py-2 px-3 text-slate-400 font-bold">ROADMAP / FUTURE</td>
                  <td className="py-2 px-3 font-sans text-slate-300">Gateway-to-LEO uplink relay (Astrocast / Iridium / NavIC)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="btn btn-primary text-xs py-2 px-4 font-bold">
            Close Audit Overview
          </button>
        </div>
      </div>
    </div>
  );
}
