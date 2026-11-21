import React from 'react';
import { Clock, AlertTriangle, LogOut } from 'lucide-react';

export default function InactivityWarningModal({ isOpen, secondsRemaining, onStayLoggedIn, onLogoutNow }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: '420px', border: '1.5px solid var(--accent-orange)' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
            <h3 className="modal-title">Session Inactivity Warning</h3>
          </div>
        </div>

        <div style={{ margin: '16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 10px' }}>
            You have been inactive for nearly 30 minutes. To protect rescue telemetry and unauthorized access, your session will automatically terminate in:
          </p>
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 106, 26, 0.12)',
              border: '1px solid var(--accent-orange)',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--accent-orange)',
              fontFamily: 'var(--font-family-mono)',
            }}
          >
            {secondsRemaining}s
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onLogoutNow}
            className="btn btn-secondary"
            style={{ height: '40px' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Now</span>
          </button>
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="btn btn-primary"
            style={{ height: '40px', fontWeight: 700 }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
