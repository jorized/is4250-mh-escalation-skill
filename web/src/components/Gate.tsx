import { useState } from "react";
import { DEFAULT_MODEL, GATE_SHA256, MODELS } from "../lib/config";
import { gatePassed, loadApiKey, loadModel, markGatePassed, saveApiKey, saveModel } from "../lib/storage";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Credentials {
  apiKey: string;
  model: string;
}

export function Gate({ onReady }: { onReady: (c: Credentials) => void }) {
  const [passed, setPassed] = useState(gatePassed());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [apiKey, setApiKey] = useState(loadApiKey());
  const [model, setModel] = useState(loadModel(DEFAULT_MODEL));
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    const ok = (await sha256(user)) === GATE_SHA256 && (await sha256(pass)) === GATE_SHA256;
    if (!ok) return setError("That username or password isn't right.");
    markGatePassed();
    setPassed(true);
    setError("");
  }

  function submitKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim().startsWith("sk-ant-")) return setError("That doesn't look like an Anthropic API key (sk-ant-…).");
    saveApiKey(apiKey.trim(), remember);
    saveModel(model);
    onReady({ apiKey: apiKey.trim(), model });
  }

  return (
    <main className="gate">
      <h1>Student Support Chat</h1>
      <p className="muted">IS4250 prototype. Test version: nothing is sent to any school or service.</p>

      {!passed ? (
        <form onSubmit={submitGate} className="card">
          <label>
            Username
            <input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button type="submit">Continue</button>
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
