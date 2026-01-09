import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

    // Validate caller is admin
    const adminUser = await getUserFromAccessToken(bearer)
    if (!adminUser || !adminUser.email) return new Response(JSON.stringify({ error: 'Invalid admin session' }), { status: 403 })
    if (adminUser.email !== 'hello@ace1.in') return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { action, product, inventory, image_url, userId, email, newPassword } = body || {}

    if (action === 'save_product') {
      if (!product) return new Response(JSON.stringify({ error: 'Missing product data' }), { status: 400 })

      // Save product using service role
      const productUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/products`
      const productRes = await fetch(productUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
        },
        body: JSON.stringify(product)
      })

      if (!productRes.ok) {
        const text = await productRes.text().catch(() => null)
        return new Response(JSON.stringify({ error: `Failed to save product: ${text || productRes.status}` }), { status: 500 })
      }

      const savedProduct = await productRes.json().catch(() => null)
      if (!savedProduct || savedProduct.length === 0) {
        return new Response(JSON.stringify({ error: 'Product save returned no data' }), { status: 500 })
      }

      const productId = savedProduct[0].id

      // Save inventory if provided
      if (inventory && Array.isArray(inventory)) {
        for (const inv of inventory) {
          const invData = {
            product_id: productId,
            size: inv.size,
            stock: inv.stock || 0
          }
          const invUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/inventory`
          await fetch(invUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
            },
            body: JSON.stringify(invData)
          }).catch(e => console.warn('Inventory save warning:', e.message))
        }
      }

      // Save image if provided
      if (image_url) {
        const imgData = {
          product_id: productId,
          image_url: image_url
        }
        const imgUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/product_images`
        await fetch(imgUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
          },
          body: JSON.stringify(imgData)
        }).catch(e => console.warn('Image save warning:', e.message))
      }

      return new Response(JSON.stringify({ success: true, product_id: productId }), { status: 200 })

    } else if (action === 'reset_password') {
      // Handle password reset (similar to admin-reset)
      if (!newPassword) return new Response(JSON.stringify({ error: 'Missing newPassword' }), { status: 400 })

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

      // Revoke sessions
      const sessionsUrl = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/sessions?user_id=eq.${encodeURIComponent(targetId)}`
      await fetch(sessionsUrl!, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
        }
      }).catch((e) => console.warn('session delete warning', e.message))

      return new Response(JSON.stringify({ success: true }), { status: 200 })

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    }

  } catch (err) {
    console.error('Admin save error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
})