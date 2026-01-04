import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Optional email notification function.
//
// This function is intentionally provider-agnostic but currently supports Resend.
//
// Env vars:
// - RESEND_API_KEY: required to actually send
// - EMAIL_FROM: e.g. "ACE#1 <hello@ace1.in>" (required)
//
// Expected JSON body:
// {
//   "to": "customer@example.com",
//   "orderId": "...",
//   "status": "processing|shipped|delivered|cancelled|...",
//   "tracking_number": "..." | null,
//   "shipped_at": "2026-01-04T...Z" | null,
//   "delivered_at": "2026-01-04T...Z" | null
// }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function formatDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("EMAIL_FROM") ?? "";

  if (!resendKey || !from) {
    return json(
      {
        error: "Email not configured",
        hint: "Set RESEND_API_KEY and EMAIL_FROM env vars for this Edge Function.",
      },
      501,
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const to = String(body?.to ?? "").trim();
  const orderId = String(body?.orderId ?? "").trim();
  const status = String(body?.status ?? "").trim() || "updated";
  const tracking = String(body?.tracking_number ?? "").trim();

  if (!to || !orderId) {
    return json({ error: "Missing 'to' or 'orderId'" }, 400);
  }

  const shippedAt = formatDateTime(body?.shipped_at);
  const deliveredAt = formatDateTime(body?.delivered_at);

  const subject = `ACE#1 Order Update: ${orderId}`;
  const lines: string[] = [];
  lines.push(`Your order (${orderId}) has been updated.`);
  lines.push("");
  lines.push(`Status: ${status}`);
  if (tracking) lines.push(`Tracking number: ${tracking}`);
  if (shippedAt) lines.push(`Shipped at: ${shippedAt}`);
  if (deliveredAt) lines.push(`Delivered at: ${deliveredAt}`);
  lines.push("");
  lines.push("Thank you for shopping with ACE#1.");

  const emailPayload = {
    from,
    to: [to],
    subject,
    text: lines.join("\n"),
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  const respText = await resp.text();
  if (!resp.ok) {
    return json({ error: "Failed to send email", provider_status: resp.status, provider_body: respText }, 502);
  }

  return json({ ok: true, provider_body: respText });
};
