#!/usr/bin/env node
/*
 * Lightweight admin server for performing secure admin-only actions that
 * require Supabase service_role privileges. This server exposes a single
 * endpoint POST /api/admin/reset-user-password which will update a user's
 * password using the Supabase Admin API and delete their sessions.
 *
 * Security: requests must include an Authorization: Bearer <access-token>
 * header containing a valid admin user access token (the server will verify
 * the token with Supabase). The server also requires the SUPABASE_SERVICE_ROLE_KEY
 * to be present in the environment to perform admin updates.
 */

const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';
const COOKIE_NAME = 'ace1_session_token';

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET; // optional: legacy static secret

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  // Do not exit so the dev can still inspect docs; runtime calls will fail explicitly.
}

async function getUserFromAccessToken(token) {
  // Hit the Supabase user endpoint to return the user associated with the access token
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function getSessionById(sessionId) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=jwt_token,expires_at&limit=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Failed to fetch session', res.status, body);
    return null;
  }

  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getSessionByToken(jwtToken) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sessions?jwt_token=eq.${encodeURIComponent(jwtToken)}&select=user_data,expires_at&limit=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getActiveTotpSecret() {
  // Prefer DB secret; fallback to env legacy
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/admin_totp_secrets?active=eq.true&order=created_at.desc&limit=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (res.ok) {
    const data = await res.json().catch(() => []);
    if (Array.isArray(data) && data.length > 0) {
      return data[0].secret_base32;
    }
  }
  return ADMIN_TOTP_SECRET || null;
}

async function authenticateAdminFromCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const session = await getSessionByToken(token);
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at) < new Date()) return null;
  const user = session.user_data || {};
  const isAdmin = user.role === 'admin' || user.email === 'hello@ace1.in';
  return isAdmin ? user : null;
}

// Issue httpOnly cookie for session
app.post('/api/session/set-cookie', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Server missing configuration' });

    const session = await getSessionById(sessionId);
    if (!session || !session.jwt_token) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check expiry
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    res.cookie(COOKIE_NAME, session.jwt_token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      expires: session.expires_at ? new Date(session.expires_at) : undefined
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('set-cookie error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Clear httpOnly cookie
app.post('/api/session/clear-cookie', (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/'
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('clear-cookie error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin TOTP verification (server-side, uses env secret)
app.post('/api/admin/verify-totp', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || code.trim().length < 6) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    const secret = await getActiveTotpSecret();
    if (!secret) return res.status(500).json({ error: 'TOTP not configured' });

    const ok = authenticator.check(code.trim(), secret);
    if (!ok) return res.status(401).json({ error: 'Invalid or expired code' });

    return res.json({ success: true });
  } catch (err) {
    console.error('verify-totp error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get active TOTP secret and QR (admin-only via cookie)
app.get('/api/admin/totp/active', async (req, res) => {
  try {
    const adminUser = await authenticateAdminFromCookie(req);
    if (!adminUser) return res.status(401).json({ error: 'Unauthorized' });

    const secret = await getActiveTotpSecret();
    if (!secret) return res.status(404).json({ error: 'No secret configured' });

    const label = encodeURIComponent('ACE#1 Admin');
    const issuer = encodeURIComponent('ACE1');
    const otpauth_url = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
    const qrDataUrl = await QRCode.toDataURL(otpauth_url);

    return res.json({ success: true, secret, otpauth_url, qrDataUrl });
  } catch (err) {
    console.error('get active totp error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Rotate TOTP secret (admin-only via cookie)
app.post('/api/admin/totp/rotate', async (req, res) => {
  try {
    const adminUser = await authenticateAdminFromCookie(req);
    if (!adminUser) return res.status(401).json({ error: 'Unauthorized' });

    const newSecret = authenticator.generateSecret();

    // Deactivate existing active secrets
    await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/admin_totp_secrets?active=eq.true`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active: false })
    }).catch(() => {});

    // Insert new active secret
    const insertRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/admin_totp_secrets`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ secret_base32: newSecret, active: true })
    });

    if (!insertRes.ok) {
      const body = await insertRes.text().catch(() => '');
      console.error('Failed to insert new TOTP secret', insertRes.status, body);
      return res.status(500).json({ error: 'Failed to rotate secret' });
    }

    const label = encodeURIComponent('ACE#1 Admin');
    const issuer = encodeURIComponent('ACE1');
    const otpauth_url = `otpauth://totp/${label}?secret=${newSecret}&issuer=${issuer}`;
    const qrDataUrl = await QRCode.toDataURL(otpauth_url);

    return res.json({ success: true, secret: newSecret, otpauth_url, qrDataUrl });
  } catch (err) {
    console.error('rotate totp error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/reset-user-password', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const { userId, email, newPassword } = req.body || {};

    if (!token) return res.status(401).json({ error: 'Missing admin access token' });
    if (!newPassword) return res.status(400).json({ error: 'Missing newPassword' });

    // Verify that the caller is an admin (hello@ace1.in by policy) using the provided token
    const adminUser = await getUserFromAccessToken(token);
    if (!adminUser || !adminUser.email) return res.status(403).json({ error: 'Failed to validate admin session' });
    if (adminUser.email !== 'hello@ace1.in') return res.status(403).json({ error: 'Not authorized' });

    // Determine target user id
    let targetId = userId;
    if (!targetId && email) {
      // find user by email in the users table
      const usersRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      const users = await usersRes.json().catch(() => null);
      if (!users || users.length === 0) return res.status(404).json({ error: 'Target user not found' });
      targetId = users[0].id;
    }

    if (!targetId) return res.status(400).json({ error: 'Missing target user id or email' });

    // Update password using Supabase admin API
    const updateUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(targetId)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (!updateRes.ok) {
      const body = await updateRes.text().catch(() => '');
      console.error('Admin update failed', updateRes.status, body);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Delete sessions for the user to force re-login
    const deleteSessionsUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sessions?user_id=eq.${encodeURIComponent(targetId)}`;
    await fetch(deleteSessionsUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY
      }
    }).catch((e) => console.warn('Session delete warning', e.message));

    return res.json({ success: true });

  } catch (err) {
    console.error('Reset password API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Admin helper running on port ${port}`));
