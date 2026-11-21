import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Lock,
  Copy,
  Check,
  X,
  FileText,
  UserCheck,
  UserX,
} from 'lucide-react';
import { authFetch } from '../utils/auth';

export default function AdminUsersView({ currentUser, onNavigate }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'audit'
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Password Reset Modal State
  const [resetModalData, setResetModalData] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Role Change Modal State
  const [roleModalData, setRoleModalData] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await authFetch('/api/admin/audit-logs');
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Actions
  const handleApprove = async (userId) => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('User approved and activated successfully');
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Are you sure you want to reject/disable this user account?')) return;
    try {
      const res = await authFetch(`/api/admin/users/${userId}/reject`, { method: 'POST' });
      if (res.ok) {
        showToast('User account rejected');
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await authFetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast(`User status updated to ${nextStatus}`);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      alert('Status update failed: ' + err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showToast(`Role updated to ${newRole}`);
        setRoleModalData(null);
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      alert('Role change failed: ' + err.message);
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Generate a one-time temporary password for ${user.username}? They will be required to change it at next login.`)) {
      return;
    }
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setResetModalData({
          user: user,
          temp_password: data.temp_password,
        });
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      alert('Password reset failed: ' + err.message);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.organisation.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-users-container">
      {/* Top Header Row */}
      <div className="admin-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Responder & User Management
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Admin Control Center: Authorize emergency personnel, enforce role-based access, and review audit logs
          </p>
        </div>

        {/* Tab Switcher & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="triage-tab-pills" style={{ margin: 0 }}>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`triage-pill ${activeTab === 'users' ? 'active' : ''}`}
              style={{ height: '36px', padding: '0 16px' }}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`triage-pill ${activeTab === 'audit' ? 'active' : ''}`}
              style={{ height: '36px', padding: '0 16px' }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Security Audit Logs ({auditLogs.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchUsers();
              fetchAuditLogs();
              showToast('Data refreshed');
            }}
            className="icon-btn-round"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <>
          {/* Search Bar */}
          <div style={{ marginBottom: '16px', maxWidth: '360px', position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, role, organisation..."
              className="input-field"
              style={{ height: '38px', paddingLeft: '34px', fontSize: '13px' }}
            />
            <Search className="w-4 h-4 text-tertiary" style={{ position: 'absolute', left: '10px', top: '11px', pointerEvents: 'none' }} />
          </div>

          {/* Users Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Responder</th>
                  <th>Username / Email</th>
                  <th>Organisation</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      Loading authorized accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPending = u.status === 'pending';
                    const isActive = u.status === 'active';
                    const isDisabled = u.status === 'disabled';

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>{u.id}</div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--accent-orange)', fontWeight: 600 }}>{u.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.email}</div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {u.organisation}
                        </td>
                        <td>
                          <span
                            className="badge-priority"
                            style={{
                              backgroundColor: u.role === 'admin' ? 'rgba(239, 68, 68, 0.15)' : u.role === 'coordinator' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: u.role === 'admin' ? '#F87171' : u.role === 'coordinator' ? '#FCD34D' : '#93C5FD',
                              borderColor: u.role === 'admin' ? 'rgba(239, 68, 68, 0.3)' : u.role === 'coordinator' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className="status-chip"
                            style={{
                              backgroundColor: isActive ? 'var(--color-success-subtle)' : isPending ? 'var(--color-warning-subtle)' : 'var(--color-danger-subtle)',
                              color: isActive ? '#6EE7B7' : isPending ? '#FCD34D' : '#F87171',
                              borderColor: isActive ? 'var(--color-success-border)' : isPending ? 'var(--color-warning-border)' : 'var(--color-danger)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          {u.last_login ? new Date(u.last_login * 1000).toLocaleString() : 'Never'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            {/* Approve / Reject for Pending */}
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(u.id)}
                                  className="btn btn-primary"
                                  style={{ height: '30px', fontSize: '11px', padding: '0 10px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                                  title="Approve access request"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(u.id)}
                                  className="btn btn-secondary"
                                  style={{ height: '30px', fontSize: '11px', padding: '0 8px', color: '#F87171' }}
                                  title="Reject access request"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Enable / Disable toggle */}
                            {!isPending && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u.id, u.status)}
                                className="btn btn-secondary"
                                style={{ height: '30px', fontSize: '11px', padding: '0 10px' }}
                              >
                                {isActive ? 'Disable' : 'Enable'}
                              </button>
                            )}

                            {/* Change Role Button */}
                            <button
                              type="button"
                              onClick={() => setRoleModalData(u)}
                              className="btn btn-secondary"
                              style={{ height: '30px', fontSize: '11px', padding: '0 8px' }}
                              title="Change user permissions role"
                            >
                              Role
                            </button>

                            {/* Reset Password Button */}
                            <button
                              type="button"
                              onClick={() => handleResetPassword(u)}
                              className="btn btn-secondary"
                              style={{ height: '30px', fontSize: '11px', padding: '0 8px' }}
                              title="Generate offline one-time password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Security Action</th>
                <th>User / Subject</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No audit log records recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>
                      {new Date(log.timestamp * 1000).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className="status-chip"
                        style={{
                          backgroundColor: log.action.includes('failed') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: log.action.includes('failed') ? '#F87171' : '#6EE7B7',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.username || log.user_id || 'System'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.ip_address}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* One-Time Temporary Password Display Modal */}
      {resetModalData && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound className="w-5 h-5 text-orange-500" />
                <h3 className="modal-title">Temporary Password Generated</h3>
              </div>
              <button onClick={() => setResetModalData(null)} className="icon-btn-round">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '14px 0 10px' }}>
              A one-time temporary passphrase has been generated for <strong>{resetModalData.user.name}</strong> ({resetModalData.user.username}).
              Provide this to the responder offline. They will be forced to set their own permanent password upon signing in:
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--accent-orange)',
                marginBottom: '16px',
              }}
            >
              <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '1px' }}>
                {resetModalData.temp_password}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(resetModalData.temp_password)}
                className="btn btn-secondary"
                style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
              >
                {copiedPw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPw ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setResetModalData(null)}
              className="btn btn-primary"
              style={{ width: '100%', height: '40px', fontWeight: 700 }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModalData && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Change Role for {roleModalData.username}</h3>
              <button onClick={() => setRoleModalData(null)} className="icon-btn-round">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' }}>
              <button
                type="button"
                onClick={() => handleRoleChange(roleModalData.id, 'responder')}
                className={`btn ${roleModalData.role === 'responder' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', height: '42px' }}
              >
                <strong>Responder</strong> — View dashboard, map, and accept rescue requests
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange(roleModalData.id, 'coordinator')}
                className={`btn ${roleModalData.role === 'coordinator' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', height: '42px' }}
              >
                <strong>Coordinator</strong> — Everything above + override triage priority
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange(roleModalData.id, 'admin')}
                className={`btn ${roleModalData.role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', height: '42px' }}
              >
                <strong>Admin</strong> — Full control, user approvals, and audit logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Confirmation Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--color-success-border)',
            borderRadius: '8px',
            padding: '12px 18px',
            color: '#6EE7B7',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 3000,
          }}
        >
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
