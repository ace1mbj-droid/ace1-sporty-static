// 2FA removed — function disabled intentionally.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export default async (_req: Request): Promise<Response> =>
  new Response(JSON.stringify({ error: "2FA removed" }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    status: 410
  });
