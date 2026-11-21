import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { changeUserPassword, evaluatePasswordStrength } from '../utils/auth';

export default function ChangePasswordModal({ isOpen, isForced = false, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const strength = evaluatePasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 10) {
      setErrorMessage('New password must be at least 10 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await changeUserPassword(currentPassword, newPassword, confirmPassword);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound className="w-5 h-5 text-orange-500" />
            <h3 className="modal-title">
              {isForced ? 'Set Permanent Password' : 'Change Password'}
            </h3>
          </div>
          {!isForced && (
            <button onClick={onClose} className="icon-btn-round" aria-label="Close dialog">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isForced && (
          <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#FCD34D', fontSize: '12px', margin: '12px 0' }}>
            <strong>Security Notice:</strong> An administrator reset your password. You must set a permanent password before proceeding.
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" style={{ margin: '12px 0' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="curr-pw">
              Current Passphrase
            </label>
            <input
              id="curr-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
              required
              disabled={loading}
            />
          </div>

          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="new-pw">
              New Password (≥10 characters)
            </label>
            <div className="password-input-wrapper">
              <input
                id="new-pw"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="input-field-wrapper">
            <label className="input-label" htmlFor="conf-pw">
              Confirm New Password
            </label>
            <input
              id="conf-pw"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              required
              disabled={loading}
            />
          </div>

          {newPassword && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-tertiary">Strength:</span>
                <strong style={{ color: strength.color }}>{strength.label}</strong>
              </div>
              <div className="password-meter-bar">
                <div className="password-meter-fill" style={{ width: `${strength.score}%`, backgroundColor: strength.color }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {!isForced && (
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ height: '40px' }}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: '40px' }}>
              {loading ? 'Updating Password...' : 'Save & Revoke Other Sessions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
