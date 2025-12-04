declare const Deno: any;

const HCAPTCHA_SECRET_KEY = Deno.env.get('HCAPTCHA_SECRET_KEY') ?? '';
const HCAPTCHA_SITE_KEY = Deno.env.get('HCAPTCHA_SITE_KEY') ?? '';
const ALLOWED_ORIGINS = (Deno.env.get('BOT_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((value: string) => value.trim())
  .filter(Boolean);

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function buildResponse(body: Record<string, unknown>, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...DEFAULT_HEADERS,
      'Access-Control-Allow-Origin': origin
    }
  });
}

function resolveOrigin(requestOrigin: string | null): { originHeader: string; allowed: boolean } {
  if (!requestOrigin) {
    return { originHeader: '*', allowed: true };
  }

  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(requestOrigin)) {
    return { originHeader: requestOrigin, allowed: true };
  }

  return { originHeader: requestOrigin, allowed: false };
}

function extractClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    ''
  );
}

async function verifyWithHCaptcha(token: string, remoteip: string) {
  const payload = new URLSearchParams({
    secret: HCAPTCHA_SECRET_KEY,
    response: token
  });

  if (HCAPTCHA_SITE_KEY) {
    payload.set('sitekey', HCAPTCHA_SITE_KEY);
  }

  if (remoteip) {
    payload.set('remoteip', remoteip);
  }

  const response = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  });

  const data = await response.json() as Record<string, unknown> & { success?: boolean };
  return { response, data };
}

export async function handler(req: Request): Promise<Response> {
  const { originHeader, allowed } = resolveOrigin(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return buildResponse({ ok: true }, 200, allowed ? originHeader : '*');
  }

  if (!allowed) {
    return buildResponse({ success: false, error: 'Origin not allowed' }, 403, originHeader);
  }

  if (!HCAPTCHA_SECRET_KEY) {
    console.error('verify-hcaptcha: Missing HCAPTCHA_SECRET_KEY');
    return buildResponse({ success: false, error: 'Server misconfigured' }, 500, originHeader);
  }

  if (req.method !== 'POST') {
    return buildResponse({ success: false, error: 'Method not allowed' }, 405, originHeader);
  }

  let body: { token?: string; action?: string };
  try {
    body = await req.json();
  } catch (_err) {
    return buildResponse({ success: false, error: 'Invalid JSON payload' }, 400, originHeader);
  }

  if (!body?.token) {
    return buildResponse({ success: false, error: 'Missing hCaptcha token' }, 400, originHeader);
  }

  const remoteip = extractClientIp(req);

  try {
    const { data } = await verifyWithHCaptcha(body.token, remoteip);
    const success = Boolean(data.success);
    const status = success ? 200 : 400;

    const errorCodes = Array.isArray((data as Record<string, unknown>)['error-codes'])
      ? (data as Record<string, unknown>)['error-codes']
      : [];

    const responsePayload = {
      success,
      hostname: data.hostname ?? null,
      challenge_ts: data.challenge_ts ?? null,
      score: data.score ?? null,
      errorCodes,
      action: body.action ?? null
    };

    if (!success) {
      console.warn('verify-hcaptcha: Validation failed', responsePayload);
    }

    return buildResponse(responsePayload, status, originHeader);
  } catch (error) {
    console.error('verify-hcaptcha: Unexpected error', error);
    return buildResponse({ success: false, error: 'Verification unavailable' }, 502, originHeader);
  }
}

Deno.serve(handler);
