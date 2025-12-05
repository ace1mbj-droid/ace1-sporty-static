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

const app = express();
app.use(bodyParser.json());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
