import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Optional email notification function.
//
// Matches the project's existing approach:
// - If SendGrid is configured, send server-side.
// - Otherwise, return a `mailto:` fallback (like the Contact Us form).
//
// Env vars (optional):
// - SENDGRID_API_KEY
// - SENDGRID_FROM (email address)
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

function buildMailto(to: string, subject: string, body: string): string {
  const enc = (v: string) => encodeURIComponent(v);
  return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
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

  const getEnv = (key: string): string => {
    try {
      return (globalThis as any)?.Deno?.env?.get?.(key) ?? "";
    } catch {
      return "";
    }
  };

  const SENDGRID_API_KEY = getEnv("SENDGRID_API_KEY");
  const SENDGRID_FROM = getEnv("SENDGRID_FROM");

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

  const textBody = lines.join("\n");

  // Preferred: SendGrid (consistent with existing admin-reset function)
  if (SENDGRID_API_KEY && SENDGRID_FROM) {
    const sgPayload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM },
      subject,
      content: [{ type: "text/plain", value: textBody }],
    };

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sgPayload),
    });

    if (!sgRes.ok) {
      const sgText = await sgRes.text().catch(() => "");
      return json({ error: "Failed to send email", provider: "sendgrid", provider_status: sgRes.status, provider_body: sgText }, 502);
    }

    return json({ ok: true, provider: "sendgrid" });
  }

  // Fallback: mailto link (same idea as Contact Us)
  return json(
    {
      ok: false,
      provider: "mailto",
      hint: "Email provider not configured. Use the mailto link to send from an email client.",
      mailto: buildMailto(to, subject, textBody),
      subject,
      text: textBody,
    },
    501,
  );
};
