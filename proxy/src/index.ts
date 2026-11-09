/**
 * IS4250 proxy: lets the GitHub Pages site call Claude without exposing a key.
 *
 *   browser ──(password, no key)──▶ this Worker ──(secret key)──▶ api.anthropic.com
 *
 * - Real password check (HTTP Basic credentials, checked server-side).
 * - Only the Pages origin may call it (CORS).
 * - Only POST /v1/messages, only allowed models, max_tokens capped.
 * - Per-IP rate limit. Set a spend limit on the Anthropic side too.
 * - Logs nothing about message content.
 */

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ANTHROPIC_API_KEY: string; // secret
  APP_PASSWORD: string; // secret
  APP_USER: string;
  ALLOWED_ORIGINS: string;
  ALLOWED_MODELS: string;
  MAX_TOKENS_CAP: string;
  LIMITER?: RateLimiter;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin") ?? "";
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const originOk = allowedOrigins.includes(origin);
    const cors: Record<string, string> = originOk
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          // The SDK sends several x-stainless-* headers; allow what the browser asks for.
          "Access-Control-Allow-Headers": req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : {};

    if (req.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!originOk) return json(403, "This site isn't allowed to use the proxy.", cors);

    if (env.LIMITER) {
      const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json(429, "Too many requests. Wait a minute and try again.", cors);
    }

    // No WWW-Authenticate header on purpose: the app shows its own sign-in, not the browser popup.
    if (!(await authorized(req, env))) return json(401, "Wrong username or password.", cors);

    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/auth-check") return json(200, "ok", cors);
    if (req.method !== "POST" || url.pathname !== "/v1/messages") return json(404, "Not found.", cors);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(400, "Body must be JSON.", cors);
    }

    const allowedModels = env.ALLOWED_MODELS.split(",").map((s) => s.trim());
    if (typeof body.model !== "string" || !allowedModels.includes(body.model)) {
      return json(400, `Model not allowed through the proxy. Allowed: ${allowedModels.join(", ")}.`, cors);
    }
    const cap = Number(env.MAX_TOKENS_CAP) || 16000;
    body.max_tokens = Math.min(Number(body.max_tokens) || cap, cap);

    const headers = new Headers({
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": req.headers.get("anthropic-version") ?? "2023-06-01",
    });
    const beta = req.headers.get("anthropic-beta");
    if (beta) headers.set("anthropic-beta", beta);

    const upstream = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body) });

    // Pass Anthropic's response through unchanged (status and body), plus CORS.
    const out = new Headers(cors);
    out.set("content-type", upstream.headers.get("content-type") ?? "application/json");
    const requestId = upstream.headers.get("request-id");
    if (requestId) out.set("request-id", requestId);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

async function authorized(req: Request, env: Env): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Basic ") || !env.APP_PASSWORD) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  return timingSafeEqual(decoded, `${env.APP_USER}:${env.APP_PASSWORD}`);
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  // Hash both so the comparison is constant-length, then compare byte by byte.
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(status: number, message: string, cors: Record<string, string>): Response {
  // Same error shape as the Anthropic API, so the SDK reports it normally.
  const body = status === 200 ? { ok: true } : { type: "error", error: { type: "proxy_error", message } };
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
