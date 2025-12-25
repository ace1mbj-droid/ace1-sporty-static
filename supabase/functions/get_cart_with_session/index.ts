import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CartItem {
  id: string
  product_id: string
  quantity: number
  size?: string
  session_id: string
  products?: {
    id: string
    name: string
    price_cents: number
    image_url?: string
    inventory?: Array<{
      stock: number
      size: string
    }>
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session ID required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // With service role key, RLS is bypassed, so we can query directly
    // Find the cart record for this session
    const { data: carts, error: cartErr } = await supabase
      .from('shopping_carts')
      .select('id')
      .eq('session_id', session_id)
      .limit(1)

    if (cartErr) {
      console.error('Cart lookup error:', cartErr)
      return new Response(
        JSON.stringify({ success: false, error: cartErr.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!carts || carts.length === 0) {
      // No cart exists for this session
      return new Response(
        JSON.stringify({ success: true, data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cartId = carts[0].id

    // Query the cart_items for this cart and include product and inventory info
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        size,
        products ( id, name, price_cents, image_url, inventory ( stock, size ) )
      `)
      .eq('cart_id', cartId)

    if (error) {
      console.error('Cart items query error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Keep response shape compatible with frontend (products property expected)
    return new Response(
      JSON.stringify({ success: true, data: data || [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
