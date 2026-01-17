// Supabase Edge Function to handle Razorpay webhooks
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RZ_SECRET
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RZ_SECRET = Deno.env.get('RZ_SECRET') ?? '';
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') ?? '';
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') ?? '';
const ADMIN_ORDER_EMAIL = Deno.env.get('ADMIN_ORDER_EMAIL') ?? 'hello@ace1.in';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY as string, {
  auth: { persistSession: false }
});

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
    console.warn('webhook-razorpay: email not configured; skipping send');
    return;
  }
  if (!to) return;

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: SENDGRID_FROM },
    subject,
    content: [{ type: 'text/plain', value: text }]
  };

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('webhook-razorpay: sendgrid failed', res.status, body);
  }
}

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
          // Idempotency: if we already marked it paid, do nothing.
          if (String(paymentRecord.status || '').toLowerCase() === 'paid') {
            return new Response(JSON.stringify({ ok: true, skipped: 'already_paid' }), { status: 200 });
          }

          await supabase
            .from('payments')
            .update({ status: 'paid', metadata: paymentEntity })
            .eq('id', paymentRecord.id);

          await supabase
            .from('orders')
            .update({ status: 'paid', payment_status: 'paid' })
            .eq('id', paymentRecord.order_id);

          // Email customer + admin (best-effort)
          try {
            const { data: order } = await supabase
              .from('orders')
              .select('id, total_cents, currency, shipping_address')
              .eq('id', paymentRecord.order_id)
              .maybeSingle();

            const customerEmail = String((order as any)?.shipping_address?.email || '').trim();
            const orderId = String((order as any)?.id || paymentRecord.order_id);
            const totalCents = Number((order as any)?.total_cents || 0);
            const currency = String((order as any)?.currency || 'INR');
            const amountInr = (totalCents / 100).toFixed(2);

            const subject = `Payment received: ${orderId}`;
            const bodyText = [
              `Payment received successfully.`,
              `Order ID: ${orderId}`,
              `Status: Paid`,
              `Total: ${currency === 'INR' ? `₹${amountInr}` : `${amountInr} ${currency}`}`
            ].join('\n');

            await Promise.all([
              customerEmail ? sendEmail(customerEmail, subject, bodyText) : Promise.resolve(),
              sendEmail(ADMIN_ORDER_EMAIL, `Order paid: ${orderId}`, bodyText)
            ]);
          } catch (e) {
            console.warn('webhook-razorpay: email send skipped due to error', String(e));
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('webhook-razorpay: unhandled exception', String(err));
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
