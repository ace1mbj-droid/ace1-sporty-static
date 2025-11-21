// Use the deno/npm import prefix for bundling in Supabase Functions
import { createClient } from 'npm:@supabase/supabase-js';

// This Edge Function is intended to run in Supabase Edge Functions environment (Deno).
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RZ_KEY, RZ_SECRET

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RZ_KEY = Deno.env.get('RZ_KEY') ?? '';
const RZ_SECRET = Deno.env.get('RZ_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export async function handler(req: Request): Promise<Response> {
  try {
    // Authenticate user token (optional): client will send Bearer token
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    const userId = userData.user.id;

    const body = await req.json();
    const { cart, shipping } = body;
    if (!cart || cart.length === 0) return new Response(JSON.stringify({ error: 'Cart empty' }), { status: 400 });

    // Recalculate price server-side
    const ids = cart.map((c: any) => c.id);
    const { data: products } = await supabase.from('products').select('id, price_cents').in('id', ids);

    let calculatedTotal = 0;
    for (const item of cart) {
      const product = products.find((p: any) => p.id === item.id);
      if (!product) return new Response(JSON.stringify({ error: `Product not found: ${item.id}` }), { status: 400 });
      calculatedTotal += product.price_cents * item.qty;
    }

    // Create order with service role (bypass RLS)
    const { data: order, error: orderError } = await supabase.from('orders').insert([{ user_id: userId, total_cents: calculatedTotal, currency: 'INR', shipping_address: shipping }]).select().single();
    if (orderError) return new Response(JSON.stringify({ error: orderError.message }), { status: 500 });

    // Insert order items
    const orderItems = cart.map((c: any) => ({ order_id: order.id, product_id: c.id, size: c.size, qty: c.qty, price_cents: (products.find((p:any) => p.id === c.id).price_cents) }));
    await supabase.from('order_items').insert(orderItems);

    // Create Razorpay order
    const razorBody = { amount: calculatedTotal, currency: 'INR', receipt: order.id };
    const authHeader = 'Basic ' + btoa(`${RZ_KEY}:${RZ_SECRET}`);
    const razorResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(razorBody)
    });
    const razorData = await razorResp.json();

    // Insert payment record (created)
    await supabase.from('payments').insert([{ order_id: order.id, provider: 'razorpay', provider_order_id: razorData.id, status: 'created', amount_cents: calculatedTotal }]);

    return new Response(JSON.stringify({ orderId: order.id, razor: razorData }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
