import React, { useState } from 'react';
import {
  Shield,
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Check,
} from 'lucide-react';
import { registerUser, evaluatePasswordStrength } from '../utils/auth';

export default function RegisterView({ onNavigate }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [role, setRole] = useState('responder');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const strength = evaluatePasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        organisation: organisation.trim(),
        role: role,
        password: password,
        confirm_password: confirmPassword,
        honeypot: honeypot || undefined,
      });

      setSuccessMessage(res.message || 'Your request was sent. An administrator must approve your account before you can sign in.');
    } catch (err) {
      setErrorMessage(err.message || 'Registration request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card auth-card-wide">
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
            <UserPlus className="w-7 h-7 text-orange-500" />
          </div>
          <h2 className="auth-card-title">Request Responder Access</h2>
          <p className="auth-card-subtitle">Register credentials for authorized disaster response operations</p>
        </div>

        {/* Success Confirmation Banner */}
        {successMessage ? (
          <div className="auth-success-banner" role="status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>Access Request Submitted!</span>
            </div>
            <p style={{ margin: '4px 0 12px', color: 'var(--text-secondary)' }}>
              {successMessage}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="btn btn-primary"
              style={{ height: '42px', fontWeight: 700 }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </button>
          </div>
        ) : (
          <>
            {/* Inline Error Banner */}
            {errorMessage && (
              <div className="auth-error-banner" role="alert">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Anti-spam Honeypot */}
              <input
                type="text"
                name="user_personal_website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="honeypot-field"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* Full Name & Username */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-name">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Havildar D. Singh"
                    className="input-field"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-username">
                    Username (3-24 chars)
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. responder_singh"
                    className="input-field"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email & Organisation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-email">
                    Official Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. name@ndrf.gov.in"
                    className="input-field"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-org">
                    Organisation / Agency
                  </label>
                  <input
                    id="reg-org"
                    type="text"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    placeholder="e.g. NDRF, Fire Dept, NGO"
                    className="input-field"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Role Requested */}
              <div className="input-field-wrapper">
                <label className="input-label">Role Requested</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('responder')}
                    className={`btn ${role === 'responder' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: '38px', fontSize: '13px' }}
                  >
                    <span>Field Responder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('coordinator')}
                    className={`btn ${role === 'coordinator' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: '38px', fontSize: '13px' }}
                  >
                    <span>Disaster Coordinator</span>
                  </button>
                </div>
              </div>

              {/* Password & Confirm */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-password">
                    Password (≥10 chars)
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 10 characters"
                      className="input-field"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle-btn"
                      aria-label="Toggle password view"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="input-field-wrapper">
                  <label className="input-label" htmlFor="reg-confirm">
                    Confirm Password
                  </label>
                  <input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="input-field"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Strength Meter & Live Checklist */}
              {password && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Password Strength:</span>
                    <strong style={{ color: strength.color }}>{strength.label}</strong>
                  </div>
                  <div className="password-meter-bar">
                    <div
                      className="password-meter-fill"
                      style={{ width: `${strength.score}%`, backgroundColor: strength.color }}
                    />
                  </div>
                  <div className="password-rules-list">
                    <span className={`password-rule-item ${strength.rules.length ? 'valid' : 'invalid'}`}>
                      {strength.rules.length ? <Check className="w-3 h-3" /> : '•'} 10+ characters
                    </span>
                    <span className={`password-rule-item ${strength.rules.letter ? 'valid' : 'invalid'}`}>
                      {strength.rules.letter ? <Check className="w-3 h-3" /> : '•'} Contains letters
                    </span>
                    <span className={`password-rule-item ${strength.rules.number ? 'valid' : 'invalid'}`}>
                      {strength.rules.number ? <Check className="w-3 h-3" /> : '•'} Contains numbers
                    </span>
                    <span className={`password-rule-item ${passwordsMatch ? 'valid' : 'invalid'}`}>
                      {passwordsMatch ? <Check className="w-3 h-3" /> : '•'} Passwords match
                    </span>
                  </div>
                </div>
              )}

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
                }}
              >
                {loading ? 'Submitting registration...' : 'Submit Access Request'}
              </button>
            </form>

            {/* Back to Login */}
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Already registered? </span>
              <button
                type="button"
                onClick={() => onNavigate('login')}
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
                Sign in here
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
