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
    console.log('create-order: handler start -', new Date().toISOString());
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('create-order: missing authorization token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    const userId = userData.user.id;

    const body = await req.json();
    const { cart, shipping } = body;
    if (!cart || cart.length === 0) {
      console.error('create-order: cart empty or missing');
      return new Response(JSON.stringify({ error: 'Cart empty' }), { status: 400 });
    }

    // Recalculate price server-side and validate product availability
    const ids = cart.map((c: any) => c.id);
    console.log('create-order: fetching product info for ids=', ids);
    // include availability fields and inventory so the server enforces business rules
    const { data: products } = await supabase.from('products').select('id, price_cents, is_locked, status, inventory(stock, size)').in('id', ids);

    let calculatedTotal = 0;
    for (const item of cart) {
      const product = products.find((p: any) => p.id === item.id);
      if (!product) return new Response(JSON.stringify({ error: `Product not found: ${item.id}` }), { status: 400 });

      // Enforce server-side availability checks (security boundary)
      if (product.is_locked) {
        return new Response(JSON.stringify({ error: `Product is locked/unavailable: ${item.id}` }), { status: 400 });
      }
      
      // Calculate stock from inventory table (supports per-size stock)
      const inventory = product.inventory || [];
      let availableStock = 0;
      if (item.size) {
        // Check stock for specific size
        const sizeInventory = inventory.find((inv: any) => inv.size === item.size);
        availableStock = sizeInventory?.stock || 0;
      } else {
        // Total stock across all sizes
        availableStock = inventory.reduce((sum: number, inv: any) => sum + (inv.stock || 0), 0);
      }
      
      if (availableStock < item.qty) {
        return new Response(JSON.stringify({ error: `Insufficient stock for product: ${item.id}` }), { status: 400 });
      }
      // If product uses a status enum, ensure it's 'available'
      if (product.status && String(product.status).toLowerCase() !== 'available') {
        return new Response(JSON.stringify({ error: `Product not available: ${item.id}` }), { status: 400 });
      }

      calculatedTotal += product.price_cents * item.qty;
    }

    // Create order with service role (bypass RLS)
    const { data: order, error: orderError } = await supabase.from('orders').insert([{ user_id: userId, total_cents: calculatedTotal, currency: 'INR', shipping_address: shipping }]).select().single();
    if (orderError) {
      console.error('create-order: failed to create order', orderError.message);
      return new Response(JSON.stringify({ error: orderError.message }), { status: 500 });
    }
    console.log('create-order: created order id=', order.id);

    // Insert order items
    const orderItems = cart.map((c: any) => ({ order_id: order.id, product_id: c.id, size: c.size, qty: c.qty, price_cents: (products.find((p:any) => p.id === c.id).price_cents) }));
    await supabase.from('order_items').insert(orderItems);

    // Deduct stock from inventory for each item
    for (const item of cart) {
      if (item.size) {
        // Deduct from specific size
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, stock')
          .eq('product_id', item.id)
          .eq('size', item.size)
          .single();
        
        if (inv) {
          await supabase
            .from('inventory')
            .update({ stock: Math.max(0, inv.stock - item.qty) })
            .eq('id', inv.id);
        }
      } else {
        // Deduct from first available inventory entry
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, stock')
          .eq('product_id', item.id)
          .gt('stock', 0)
          .order('stock', { ascending: false })
          .limit(1)
          .single();
        
        if (inv) {
          await supabase
            .from('inventory')
            .update({ stock: Math.max(0, inv.stock - item.qty) })
            .eq('id', inv.id);
        }
      }
    }

    // Create Razorpay order
    const razorBody = { amount: calculatedTotal, currency: 'INR', receipt: order.id };
    const authHeader = 'Basic ' + btoa(`${RZ_KEY}:${RZ_SECRET}`);
    // Call Razorpay with a timeout. If Razorpay is slow/unavailable we should fail fast and return a clear error
    console.log('create-order: creating razorpay order', { razorBody });
    // Allow tests to ask the function to skip contacting external payment
    // providers (deterministic, faster) by sending header 'x-e2e-skip-razorpay: 1'
    const e2eSkip = req.headers.get('x-e2e-skip-razorpay');
    const controller = new AbortController();
    // Increase timeout slightly to be more tolerant in production while still
    // protecting the function from long hangs. Tests can skip the call.
    const timeoutMs = 30000; // 30s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let razorResp: Response;
    let razorData: any = null;
    try {
      if (e2eSkip === '1' || e2eSkip === 'true') {
        // Create a deterministic stub for testing and avoid external call
        razorData = { id: `e2e_stub_${Date.now()}`, amount: calculatedTotal, currency: 'INR', status: 'created' };
        console.log('create-order: skipping razorpay call due to E2E header, stubbed razorData', razorData);
      } else {
        razorResp = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(razorBody),
          signal: controller.signal
        });
        razorData = await razorResp.json();
        console.log('create-order: razorpay response', { status: razorResp.status, body: razorData });
      }
    } catch (e) {
      console.error('create-order: razorpay request failed', String(e));
      if ((e as Error).name === 'AbortError') {
        // Timeout
        return new Response(JSON.stringify({ error: 'Payment provider timeout' }), { status: 504 });
      }
      // Return generic error message to avoid exposing stack traces to clients
      return new Response(JSON.stringify({ error: 'Payment provider error' }), { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    // Insert payment record (created)
    try {
      await supabase.from('payments').insert([{ order_id: order.id, provider: 'razorpay', provider_order_id: razorData?.id ?? null, status: 'created', amount_cents: calculatedTotal }]);
    } catch (e) {
      console.error('create-order: failed to insert payment record', String(e));
      // continue — we already created the order; surface a 500 so caller knows about partial failure
      // Return generic error message to avoid exposing stack traces to clients
      return new Response(JSON.stringify({ error: 'Failed to record payment' }), { status: 500 });
    }

    return new Response(JSON.stringify({ orderId: order.id, razor: razorData }), { status: 200 });
  } catch (err) {
    console.error('create-order: unhandled exception', String(err));
    // Return generic error message to avoid exposing stack traces to clients
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
