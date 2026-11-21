import React from 'react';
import {
  Radio,
  MapPin,
  Cpu,
  Layers,
  ShieldCheck,
  ArrowRight,
  Satellite,
  Compass,
  Zap,
} from 'lucide-react';

export default function LandingView({ onNavigate }) {
  return (
    <div className="landing-wrapper">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-pill-tag">
          <Satellite className="w-4 h-4" />
          <span>ASTRA Hackathon • Off-Grid Emergency Coordination</span>
        </div>

        <h1 className="hero-main-title">
          Zero-Cellular Survival Telemetry for <span className="hero-accent-text">Disaster Zones</span>
        </h1>

        <p className="hero-lead-text">
          When mobile towers collapse in catastrophic floods, RescueLink encodes life-saving distress beacons into 
          <strong> 21-byte compact LoRa packets</strong>, preempts critical medical triage, clusters nearby victims, and delivers 
          cryptographically verified responder acknowledgements.
        </p>

        <div className="hero-actions-row">
          <button
            onClick={() => onNavigate('victim')}
            className="btn btn-primary"
            style={{ height: '50px', padding: '0 24px', fontSize: '16px' }}
          >
            <Radio className="w-5 h-5" />
            <span>Open Victim Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('dashboard')}
            className="btn btn-secondary"
            style={{ height: '50px', padding: '0 24px', fontSize: '16px' }}
          >
            <MapPin className="w-5 h-5 text-orange-500" />
            <span>Open Rescue Dashboard</span>
          </button>
        </div>
      </section>

      {/* 3 Core Architecture Features */}
      <section className="features-grid">
        <div className="feature-card">
          <div className="feature-icon-wrapper">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="feature-title">Ultra-Compact 21-Byte Packets</h3>
          <p className="feature-body">
            Replaces bloated JSON payloads with an exact 21-byte binary struct. Microdegree coordinates, bit-packed emergency severity, 
            and GPS fix age minimize LoRa Time-on-Air to under 650ms for maximum penetration and battery life.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-wrapper">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="feature-title">IECE Priority & Spatial Clustering</h3>
          <p className="feature-body">
            Preemptive heap queues prioritize life-threatening cardiac emergencies (P1) ahead of routine stranded calls. 
            Compatible reports within 50 meters are automatically merged into unified rescue clusters to prevent dispatch fragmentation.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-wrapper">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="feature-title">Ed25519 Asymmetric Signatures</h3>
          <p className="feature-body">
            Authorized commanders sign emergency acceptances using private keys. The victim terminal independently validates the signature 
            against the public key before confirming help is on the way, actively rejecting forged or tampered messages.
          </p>
        </div>
      </section>

      {/* How It Works Horizontal Strip */}
      <section className="how-it-works-card">
        <h2 className="text-section-title" style={{ textAlign: 'center' }}>
          Mission Architecture: End-to-End Resilience
        </h2>
        <p className="text-helper" style={{ textAlign: 'center', marginTop: '6px' }}>
          Seamless flow from handheld survival terminal to national disaster response teams.
        </p>

        <div className="how-it-works-grid">
          <div className="how-step-item">
            <span className="how-step-number">STEP 01</span>
            <h4 className="how-step-title">Victim Transmission</h4>
            <p className="how-step-desc">
              Victim terminal captures GNSS coordinates and encodes condition into 21 bytes. No SIM or cell towers required.
            </p>
          </div>

          <div className="how-step-item">
            <span className="how-step-number">STEP 02</span>
            <h4 className="how-step-title">LoRa RF Propagation</h4>
            <p className="how-step-desc">
              868.1 MHz CSS modulation travels through flooded terrain to battery-backed or satellite-linked gateways.
            </p>
          </div>

          <div className="how-step-item">
            <span className="how-step-number">STEP 03</span>
            <h4 className="how-step-title">IECE Intelligent Triage</h4>
            <p className="how-step-desc">
              Engine sorts by medical urgency, groups nearby victims into cluster cards, and plots live on OpenStreetMap.
            </p>
          </div>

          <div className="how-step-item">
            <span className="how-step-number">STEP 04</span>
            <h4 className="how-step-title">Verified Downlink</h4>
            <p className="how-step-desc">
              Commander cryptographically signs rescue allocation. Victim terminal verifies signature before showing accepted.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
