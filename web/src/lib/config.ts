/** M10: one switch. Anything other than the literal "false" keeps test mode on. */
export const TEST_MODE = import.meta.env.VITE_TEST_MODE !== "false";

/**
 * Cloudflare Worker that holds the API key (proxy/). When set, users sign in
 * with the shared password only, and the password is checked by the Worker.
 * When empty, the app falls back to "bring your own API key".
 */
export const PROXY_URL: string = (import.meta.env.VITE_PROXY_URL ?? "").replace(/\/$/, "");
export const PROXY_MODEL = "claude-haiku-5-5";

export const MODELS = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
] as const;

export const DEFAULT_MODEL: string = import.meta.env.VITE_DEFAULT_MODEL ?? "claude-haiku-5-5";

/**
 * Bring-your-own-key mode only: a soft gate that runs in the browser and can be
 * bypassed by reading the bundle. In proxy mode the Worker checks the password.
 */
export const GATE_SHA256 = "8ad154188f7d6acd10d68e59fb76f8e20f7eed596848f8871570ac7a8f971ed3";
