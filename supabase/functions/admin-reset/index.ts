// Supabase Edge Function: admin-reset
// This function performs admin-initiated user password reset using the
// SUPABASE_SERVICE_ROLE_KEY. It validates the caller's access token and
// requires the caller to be the admin email (hello@ace1.in) by default.

import { serve } from 'std/server'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

async function getUserFromAccessToken(token: string) {
  if (!token) return null
  const url = `${SUPABASE_URL?.replace(/\/$/, '')}/auth/v1/user`
  const res = await fetch(url!, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) return null
  return res.json()
}

async function findUserIdByEmail(email: string) {
  const url = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}`
  const res = await fetch(url!, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
    }
  })
  if (!res.ok) return null
  const arr = await res.json().catch(() => null)
  if (!arr || arr.length === 0) return null
  return arr[0].id
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Only POST allowed' }), { status: 405 })

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!bearer) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { userId, email, newPassword } = body || {}

    if (!newPassword) return new Response(JSON.stringify({ error: 'Missing newPassword' }), { status: 400 })

    // Validate caller
    const adminUser = await getUserFromAccessToken(bearer)
    if (!adminUser || !adminUser.email) return new Response(JSON.stringify({ error: 'Invalid admin session' }), { status: 403 })
    if (adminUser.email !== 'hello@ace1.in') return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })

    // Determine target id
    let targetId = userId
    if (!targetId) {
      if (!email) return new Response(JSON.stringify({ error: 'Provide userId or email' }), { status: 400 })
      targetId = await findUserIdByEmail(email)
      if (!targetId) return new Response(JSON.stringify({ error: 'Target user not found' }), { status: 404 })
    }

    // Update password via admin API
    const adminUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(targetId)}`
    const updateRes = await fetch(adminUrl!, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY || ''
      },
      body: JSON.stringify({ password: newPassword })
    })

    if (!updateRes.ok) {
      const t = await updateRes.text().catch(() => '')
      console.error('admin update failed', updateRes.status, t)
      return new Response(JSON.stringify({ error: 'Failed to update password' }), { status: 500 })
    }

    // Revoke sessions via REST API
    const sessionsUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/sessions?user_id=eq.${encodeURIComponent(targetId)}`
    await fetch(sessionsUrl!, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
      }
    }).catch((e) => console.warn('session delete warning', e.message))

    // Attempt to fetch target user email for logging/notification
    let targetEmail = email || null
    if (!targetEmail) {
      try {
        const uRes = await fetch(`${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/users?select=email&id=eq.${encodeURIComponent(targetId)}`, {
          method: 'GET',
          headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY || '', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}` }
        })
        if (uRes.ok) {
          const arr = await uRes.json().catch(() => null)
          if (arr && arr.length > 0 && arr[0].email) targetEmail = arr[0].email
        }
      } catch (e) { console.warn('failed fetching target user email', e); }
    }

    // Insert audit log row into password_reset_logs (service_role required)
    try {
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
      const userAgent = req.headers.get('user-agent') || ''
      const logBody = {
        admin_user_id: adminUser?.id || null,
        admin_email: adminUser?.email || null,
        target_user_id: targetId,
        target_email: targetEmail,
        ip_address: ipAddress,
        user_agent: userAgent,
        note: 'admin-reset via function'
      }
      await fetch(`${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/password_reset_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
        },
        body: JSON.stringify(logBody)
      }).catch(e => console.warn('log insert warning', e));
    } catch (e) { console.warn('audit log failed', e); }

    // Optional: send notification email to target user if configured (SendGrid)
    try {
      const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
      const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM')
      if (SENDGRID_API_KEY && SENDGRID_FROM && targetEmail) {
        const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: targetEmail }] }],
            from: { email: SENDGRID_FROM },
            subject: 'Your account password was reset by an administrator',
            content: [{ type: 'text/plain', value: `Hello,

Your account password was recently reset by an administrator. If this was expected, you can sign in with the new password. If you did not request this, please contact support immediately.

-- Team` }]
          })
        })
        if (!sgRes.ok) console.warn('sendgrid failed', await sgRes.text().catch(()=>''))
      }
    } catch (e) { console.warn('email send failed', e) }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error('function error', err)
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
  }
})
