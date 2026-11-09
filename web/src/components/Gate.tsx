import { useEffect, useState } from "react";
import { DEFAULT_MODEL, GATE_SHA256, MODELS, PROXY_MODEL, PROXY_URL } from "../lib/config";
import * as store from "../lib/storage";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Credentials =
  | { mode: "proxy"; basicAuth: string; model: string }
  | { mode: "key"; apiKey: string; model: string };

type Step = "password" | "key";

export function Gate({ onReady }: { onReady: (c: Credentials) => void }) {
  const [step, setStep] = useState<Step>(!PROXY_URL && store.gatePassed() ? "key" : "password");
  const [ownKey, setOwnKey] = useState(!PROXY_URL); // proxy mode by default when a proxy exists
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [apiKey, setApiKey] = useState(store.loadApiKey());
  const [model, setModel] = useState(store.loadModel(DEFAULT_MODEL));
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // Already signed in through the proxy in this tab: go straight in.
  useEffect(() => {
    const saved = PROXY_URL ? store.loadProxyAuth() : "";
    if (saved) onReady({ mode: "proxy", basicAuth: saved, model: PROXY_MODEL });
  }, [onReady]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (PROXY_URL && !ownKey) {
      // Real check, done by the Worker.
      const basicAuth = btoa(`${user}:${pass}`);
      setChecking(true);
      try {
        const res = await fetch(`${PROXY_URL}/auth-check`, { headers: { Authorization: `Basic ${basicAuth}` } });
        if (res.status === 401) return setError("That username or password isn't right.");
        if (res.status === 429) return setError("Too many attempts. Wait a minute and try again.");
        if (!res.ok) return setError(`The server couldn't sign you in (error ${res.status}).`);
        store.saveProxyAuth(basicAuth);
        onReady({ mode: "proxy", basicAuth, model: PROXY_MODEL });
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setChecking(false);
      }
      return;
    }

    // Own-key mode: soft, browser-side gate only.
    const ok = (await sha256(user)) === GATE_SHA256 && (await sha256(pass)) === GATE_SHA256;
    if (!ok) return setError("That username or password isn't right.");
    store.markGatePassed();
    setStep("key");
  }

  function submitKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim().startsWith("sk-ant-")) return setError("That doesn't look like an Anthropic API key (sk-ant-…).");
    store.saveApiKey(apiKey.trim(), remember);
    store.saveModel(model);
    onReady({ mode: "key", apiKey: apiKey.trim(), model });
  }

  return (
    <main className="gate">
      <h1>Student Support Chat</h1>
      <p className="muted">IS4250 prototype. Test version: nothing is sent to any school or service.</p>

      {step === "password" ? (
        <form onSubmit={submitPassword} className="card">
          <label>
            Username
            <input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button type="submit" disabled={checking}>
            {checking ? "Checking…" : "Sign in"}
          </button>
          {PROXY_URL && (
            <label className="row small muted">
              <input type="checkbox" checked={ownKey} onChange={(e) => setOwnKey(e.target.checked)} />
              Use my own Anthropic API key instead (team testing)
            </label>
          )}
        </form>
      ) : (
        <form onSubmit={submitKey} className="card">
          <label>
            Anthropic API key
            <input type="password" placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </label>
          <p className="muted small">
            Your key stays in this browser and is sent only to Anthropic. It is never in the site's code. Use a key with a
            low spend limit.
          </p>
          <label className="row">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Start</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
