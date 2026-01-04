// Supabase Edge Function to handle Razorpay webhooks
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RZ_SECRET
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RZ_SECRET = Deno.env.get('RZ_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY as string, {
  auth: { persistSession: false }
});

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function verifyRazorpaySignature(body: string, signatureHeader: string): Promise<boolean> {
  if (!RZ_SECRET) {
    console.error('webhook-razorpay: Missing RZ_SECRET');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(RZ_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = toHex(new Uint8Array(digest));
  const provided = signatureHeader.trim().toLowerCase();

  return timingSafeEqual(expected, provided);
}

export async function handler(req: Request): Promise<Response> {
  try {
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) return new Response('Missing signature', { status: 400 });

    const body = await req.text();
    const valid = await verifyRazorpaySignature(body, signature);
    if (!valid) {
      console.warn('webhook-razorpay: invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (_err) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const eventName = payload?.event;
    if (eventName === 'payment.captured') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorOrderId = paymentEntity?.order_id;
      if (razorOrderId) {
        const { data: paymentRecord, error: paymentError } = await supabase
          .from('payments')
          .select('id, order_id, status')
          .eq('provider_order_id', razorOrderId)
          .limit(1)
          .maybeSingle();

        if (paymentError) {
          console.error('webhook-razorpay: payment lookup failed', paymentError.message);
        } else if (paymentRecord) {
          await supabase
            .from('payments')
            .update({ status: 'paid', metadata: paymentEntity })
            .eq('id', paymentRecord.id);

          await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', paymentRecord.order_id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('webhook-razorpay: unhandled exception', String(err));
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
