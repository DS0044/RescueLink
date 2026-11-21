/**
 * Authentication and Session Management Service
 * Communicates with backend using HttpOnly secure cookies and JWT tokens.
 */

let _cachedToken = null;

export const setSessionToken = (token) => {
  _cachedToken = token;
};

export const getSessionToken = () => {
  return _cachedToken;
};

/**
 * Signs in user with username or email and password.
 */
export async function loginUser(usernameOrEmail, password, rememberMe = false, honeypot = '') {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username_or_email: usernameOrEmail,
      password: password,
      remember_me: rememberMe,
      honeypot: honeypot || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Sign in failed');
  }

  if (data.token) {
    setSessionToken(data.token);
  }
  return data;
}

/**
 * Registers new access request (account created as 'pending').
 */
export async function registerUser(payload) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Registration request failed');
  }
  return data;
}

/**
 * Fetches current authenticated user profile.
 */
export async function getCurrentUser() {
  const headers = {};
  if (_cachedToken) {
    headers['Authorization'] = `Bearer ${_cachedToken}`;
  }

  const res = await fetch('/api/auth/me', { headers });
  if (!res.ok) {
    if (res.status === 401) {
      // Try refresh
      try {
        const refreshed = await refreshSessionToken();
        if (refreshed) {
          return await getCurrentUser();
        }
      } catch {
        return null;
      }
    }
    return null;
  }
  return await res.json();
}

/**
 * Refreshes JWT token using HttpOnly refresh token cookie.
 */
export async function refreshSessionToken() {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setSessionToken(data.token);
      }
      return data;
    }
  } catch (err) {
    console.error('Refresh token failed:', err);
  }
  return null;
}

/**
 * Signs out current user and revokes refresh token.
 */
export async function logoutUser() {
  _cachedToken = null;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
}

/**
 * Changes authenticated user password.
 */
export async function changeUserPassword(currentPassword, newPassword, confirmPassword) {
  const headers = { 'Content-Type': 'application/json' };
  if (_cachedToken) {
    headers['Authorization'] = `Bearer ${_cachedToken}`;
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Password change failed');
  }
  if (data.token) {
    setSessionToken(data.token);
  }
  return data;
}

/**
 * Password strength evaluator (0 to 100) and live rule checks.
 */
export function evaluatePasswordStrength(password) {
  if (!password) {
    return {
      score: 0,
      label: 'Too short',
      color: '#64748B',
      rules: {
        length: false,
        letter: false,
        number: false,
        special: false,
        notCommon: true,
      },
    };
  }

  const commonPasswords = ['password123', 'admin12345', '1234567890', 'qwerty12345', 'rescuelink123', 'letmein12345'];
  const rules = {
    length: password.length >= 10,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
    notCommon: !commonPasswords.includes(password.toLowerCase()),
  };

  let validCount = Object.values(rules).filter(Boolean).length;
  let score = Math.min(100, validCount * 20 + Math.min(20, password.length * 2));

  let label = 'Weak';
  let color = '#EF4444';

  if (rules.length && rules.notCommon && validCount >= 4) {
    label = 'Strong';
    color = '#10B981';
  } else if (rules.length && validCount >= 3) {
    label = 'Moderate';
    color = '#F59E0B';
  }

  return { score, label, color, rules };
}
