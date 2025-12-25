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

    // Query the cart_items for this cart
    const { data: items, error: itemsErr } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, size, added_at')
      .eq('cart_id', cartId)

    if (itemsErr) {
      console.error('Cart items query error:', itemsErr)
      return new Response(
        JSON.stringify({ success: false, error: itemsErr.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch product details and inventories separately to avoid schema relationship cache issues
    const productIds = items.map(i => i.product_id);

    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, name, price_cents')
      .in('id', productIds)

    if (productsErr) {
      console.error('Products lookup error:', productsErr)
      return new Response(
        JSON.stringify({ success: false, error: productsErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: productImages, error: imgErr } = await supabase
      .from('product_images')
      .select('product_id, storage_path, alt, position')
      .in('product_id', productIds)

    if (imgErr) {
      console.error('Product images lookup error:', imgErr)
      return new Response(
        JSON.stringify({ success: false, error: imgErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: inventoryRows, error: invErr } = await supabase
      .from('inventory')
      .select('product_id, stock, size')
      .in('product_id', productIds)

    if (invErr) {
      console.error('Inventory lookup error:', invErr)
      return new Response(
        JSON.stringify({ success: false, error: invErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Assemble products with inventory grouped by product_id
    const inventoryMap = {} as Record<string, Array<{stock:number,size:string}>>;
    (inventoryRows || []).forEach(row => {
      inventoryMap[row.product_id] = inventoryMap[row.product_id] || [];
      inventoryMap[row.product_id].push({ stock: row.stock, size: row.size });
    });

    const shaped = (items || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size,
      added_at: item.added_at,
      products: (products || []).find(p => p.id === item.product_id) ? { ... (products || []).find(p => p.id === item.product_id), inventory: inventoryMap[item.product_id] || [] } : null
    }));

    return new Response(
      JSON.stringify({ success: true, data: shaped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
