import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  ShieldAlert,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { loginUser } from '../utils/auth';

export default function LoginView({ onLoginSuccess, onNavigate, redirectTarget = 'dashboard' }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const usernameInputRef = useRef(null);

  useEffect(() => {
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!usernameOrEmail.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(usernameOrEmail.trim(), password, rememberMe, honeypot);
      if (onLoginSuccess) {
        onLoginSuccess(data.user, redirectTarget);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts quick-fill helper for live evaluation
  const handleQuickFill = (u, p) => {
    setUsernameOrEmail(u);
    setPassword(p);
    setErrorMessage('');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-card-header">
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 106, 26, 0.12)',
              border: '1.5px solid var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <Shield className="w-7 h-7 text-orange-500" />
          </div>
          <h2 className="auth-card-title">Rescue Team Sign In</h2>
          <p className="auth-card-subtitle">Authorised disaster response personnel only</p>
        </div>

        {/* Inline Error Banner */}
        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Honeypot field (hidden from screen reader and visual layout) */}
          <input
            type="text"
            name="security_honeypot_field"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="honeypot-field"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {/* Username or Email */}
          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="auth-username">
              Username or Official Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-username"
                ref={usernameInputRef}
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="e.g. admin or commander@ndrf.gov.in"
                className="input-field"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-field-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="input-label" htmlFor="auth-password" style={{ marginBottom: 0 }}>
                Password
              </label>
            </div>
            <div className="password-input-wrapper">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter responder passphrase"
                className="input-field"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Keep me signed in */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              id="auth-remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
            />
            <label htmlFor="auth-remember-me" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Keep me signed in on this device (30 days)
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              height: '46px',
              fontSize: '14px',
              fontWeight: 800,
              width: '100%',
              marginTop: '4px',
              boxShadow: '0 4px 14px rgba(255, 106, 26, 0.4)',
            }}
          >
            {loading ? (
              <span>Verifying credentials...</span>
            ) : (
              <>
                <span>Sign In to Response Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link to Request Access */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>Need responder access? </span>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-orange)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Request responder access
          </button>
        </div>

        {/* Live Evaluator Quick-Fill Section */}
        <div className="demo-accounts-pill-box">
          <div className="demo-pill-title">
            <KeyRound className="w-3.5 h-3.5 text-orange-400" />
            <span>Evaluation Demo Logins (Click to Fill)</span>
          </div>
          <div className="demo-pill-grid">
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('admin', 'RescueAdmin@2026!')}
              title="Incident Commander (Full Admin Access)"
            >
              <strong>Admin (Capt. Sharma)</strong>
              <span>Full control & users</span>
            </div>
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('coordinator_rao', 'RescueCoord@2026!')}
              title="Disaster Coordinator (Priority Override + Triage)"
            >
              <strong>Coordinator (Insp. Rao)</strong>
              <span>Triage & override</span>
            </div>
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('responder_singh', 'RescueResp@2026!')}
              title="Field Responder (View + Accept SOS)"
            >
              <strong>Responder (Hav. Singh)</strong>
              <span>Field operations</span>
            </div>
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('volunteer_kiran', 'RescueVolunteer@2026!')}
              title="Pending Approval Account"
            >
              <strong>Pending (Kiran Kumar)</strong>
              <span>Tests 403 approval gate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
