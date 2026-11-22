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
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { loginUser } from '../utils/auth';

export default function LoginView({ onLoginSuccess, onNavigate, redirectTarget = 'dashboard' }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
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
      setErrorMessage('Please enter your Responder ID or Username.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(usernameOrEmail.trim(), password);
      if (onLoginSuccess) {
        onLoginSuccess(data.user, redirectTarget);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid ID or password');
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts quick-fill helper
  const handleQuickFill = (u, p) => {
    setUsernameOrEmail(u);
    setPassword(p);
    setErrorMessage('');
    // Auto-login on quick fill click
    loginUser(u, p).then((data) => {
      if (onLoginSuccess) {
        onLoginSuccess(data.user, redirectTarget);
      }
    });
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-card-header">
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255, 106, 26, 0.14)',
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
          <p className="auth-card-subtitle">Simple, instant access for disaster response teams</p>
        </div>

        {/* Default credentials banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#10B981',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Default ID: <strong>admin</strong> | Password: <strong>admin</strong></span>
        </div>

        {/* Inline Error Banner */}
        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Responder ID */}
          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="auth-username">
              Responder ID / Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-username"
                ref={usernameInputRef}
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="e.g. admin or responder"
                className="input-field"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="auth-password">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="e.g. admin"
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
              marginTop: '6px',
              boxShadow: '0 4px 14px rgba(255, 106, 26, 0.4)',
              cursor: 'pointer',
            }}
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick 1-Click Fill Chips */}
        <div className="demo-accounts-pill-box">
          <div className="demo-pill-title">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>1-Click Quick Access</span>
          </div>
          <div className="demo-pill-grid">
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('admin', 'admin')}
              title="Click to sign in as Administrator"
              style={{ cursor: 'pointer' }}
            >
              <strong>Admin Commander</strong>
              <span>ID: admin | Pass: admin</span>
            </div>
            <div
              className="demo-account-chip"
              onClick={() => handleQuickFill('responder', 'responder')}
              title="Click to sign in as Field Responder"
              style={{ cursor: 'pointer' }}
            >
              <strong>Field Responder</strong>
              <span>ID: responder | Pass: responder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
