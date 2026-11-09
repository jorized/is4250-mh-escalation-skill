import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { assistantText, RefusalError, runTurn, type ChatMessage, type Turn } from "../lib/llm";
import { EMERGENCY_IDS, HOTLINE_IDS, resolveRoutes, type RouteEntry } from "../lib/routing";
import { OPENING_DISCLOSURE } from "../lib/skill";
import { TEST_MODE } from "../lib/config";
import { checkinDue, dependencySignals, moodOfferDue } from "../lib/signals";
import * as store from "../lib/storage";
import { ContactCard, HandoffCard, SummaryPreview, summaryLines } from "./Cards";
import { DataPanel } from "./DataPanel";
import type { Credentials } from "./Gate";

type Item =
  | { kind: "assistant"; text: string; routes: RouteEntry[]; consent?: { route: RouteEntry; turn: Turn }; answered?: boolean }
  | { kind: "hotline"; routes: RouteEntry[] }
  | { kind: "user"; text: string }
  | { kind: "preview"; route: RouteEntry; lines: string[]; done?: boolean }
  | { kind: "handoff"; route: RouteEntry; lines: string[] }
  | { kind: "error"; text: string };

export function Chat({ creds, onSignOut }: { creds: Credentials; onSignOut: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false);

  // Code-enforced safety state (not left to the model).
  const tierFloor = useRef(0);
  const hotlineShown = useRef(false);
  const handoffs = useRef<string[]>([]);
  const declined = useRef<string[]>([]);
  const sessionMessages = useRef(0);

  const [moodOptIn, setMoodOptIn] = useState(store.moodOptedIn());
  const [mood, setMood] = useState(store.loadMood());
  const [usage, setUsage] = useState(store.loadUsage());

  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [items, busy]);

  // Record this session start (timestamp only).
  useEffect(() => {
    const u = store.loadUsage();
    u.sessions.push(Date.now());
    store.saveUsage(u);
    setUsage(u);
  }, []);

  function sessionState(): string {
    const signals = dependencySignals(usage, sessionMessages.current);
    const now = new Date();
    return [
      "# Session state (from the app, this turn)",
      `- Tier floor: ${tierFloor.current}. Your tier must not be lower than this.`,
      `- Hotline card (SOS 1767, mindline 1771): ${hotlineShown.current ? "ALREADY SHOWN. Refer back to it; do not list it again." : "not shown yet."}`,
      `- Summaries the student approved: ${handoffs.current.join(", ") || "none"}${TEST_MODE ? " (TEST MODE: nothing was actually sent)" : ""}.`,
      `- Student chose "Not now" for: ${declined.current.join(", ") || "none"}.`,
      `- Mood check-in: ${moodOptIn ? `opted in; ${mood.length} entries; pattern offer due: ${moodOfferDue(mood) ? "YES (gentle Tier 1 offer, not an escalation)" : "no"}` : "not opted in"}.`,
      `- Usage signals: ${signals.length ? signals.join("; ") : "none"}.`,
      `- Student's local time: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      `- TEST_MODE: ${TEST_MODE ? "ON" : "OFF"}.`,
    ].join("\n");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    sessionMessages.current += 1;
    const u = { ...usage, messages: [...usage.messages, Date.now()] };
    store.saveUsage(u);
    setUsage(u);

    const nextHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);
    setItems((xs) => [...xs.map((x) => (x.kind === "assistant" ? { ...x, answered: true } : x)), { kind: "user", text: trimmed }]);
    setBusy(true);

    try {
      const turn = await runTurn({ apiKey: creds.apiKey, model: creds.model, history: nextHistory, sessionState: sessionState() });

      // M6: the tier never goes down within a session.
      turn.tier = Math.max(Math.min(Math.max(turn.tier, 0), 3), tierFloor.current);
      tierFloor.current = turn.tier;

      // M1: only routing-table entries; hotline only once (M9).
      let routes = resolveRoutes(turn.route_ids).filter((r) => !hotlineShown.current || !HOTLINE_IDS.includes(r.id));
      if (turn.tier === 3 && !routes.some((r) => EMERGENCY_IDS.includes(r.id))) routes = [...resolveRoutes(EMERGENCY_IDS), ...routes];
      routes = routes.slice(0, 3);

      const newItems: Item[] = [];
      const consentRoute = turn.consent_offer ? resolveRoutes([turn.consent_offer])[0] : undefined;
      newItems.push({
        kind: "assistant",
        text: turn.reply,
        routes: routes.filter((r) => r.id !== consentRoute?.id),
        consent: consentRoute && turn.summary ? { route: consentRoute, turn } : undefined,
      });
      if ((turn.show_hotline || turn.tier >= 2) && !hotlineShown.current) {
        hotlineShown.current = true;
        newItems.push({ kind: "hotline", routes: resolveRoutes(HOTLINE_IDS) });
      }

      setItems((xs) => [...xs, ...newItems]);
      setHistory([...nextHistory, { role: "assistant", content: assistantText(turn) }]);
    } catch (err) {
      setHistory(history); // drop the failed user turn so history stays valid
      setItems((xs) => [...xs, { kind: "error", text: errorText(err) }]);
    } finally {
      setBusy(false);
    }
  }

  function onConsent(item: Extract<Item, { kind: "assistant" }>, choice: "yes" | "no" | "more") {
    const c = item.consent!;
    setItems((xs) => xs.map((x) => (x === item ? { ...x, answered: true } : x)));
    if (choice === "yes") {
      const basis = c.turn.tier === 3 ? "student agreed (Tier 3)" : "student agreed";
      setItems((xs) => [...xs, { kind: "preview", route: c.route, lines: summaryLines(c.turn.summary!, basis) }]);
    } else if (choice === "no") {
      declined.current.push(c.route.unit);
      void send("Not now.");
    } else {
      void send(`Tell me more about ${c.route.unit}.`);
    }
  }

  function onApprove(item: Extract<Item, { kind: "preview" }>, kept: string[]) {
    handoffs.current.push(item.route.unit);
    setItems((xs) => [...xs.map((x) => (x === item ? { ...x, done: true } : x)), { kind: "handoff", route: item.route, lines: kept }]);
  }

  function onPreviewCancel(item: Extract<Item, { kind: "preview" }>) {
    setItems((xs) => xs.map((x) => (x === item ? { ...x, done: true } : x)));
    declined.current.push(item.route.unit);
    void send("Not now.");
  }

  function logMood(score: 1 | 2 | 3 | 4 | 5) {
    const m = [...mood, { at: Date.now(), score }];
    store.saveMood(m);
    setMood(m);
  }

  const showCheckin = moodOptIn && checkinDue(mood);

  return (
    <div className="app">
      <header>
        <div>
          <strong>Student Support Chat</strong>
          {TEST_MODE && <span className="tag test">TEST MODE</span>}
        </div>
        <button className="secondary" onClick={() => setPanel((p) => !p)}>
          Your data
        </button>
      </header>

      {panel && (
        <DataPanel
          moodOptIn={moodOptIn}
          mood={mood}
          usage={usage}
          onToggleMood={(v) => {
            store.setMoodOptIn(v);
            setMoodOptIn(v);
          }}
          onDeleteAll={() => {
            store.deleteMyData();
            setMood([]);
            setMoodOptIn(false);
            setUsage({ messages: [], sessions: [] });
          }}
          onSignOut={() => {
            store.forgetApiKey();
            onSignOut();
          }}
          onClose={() => setPanel(false)}
        />
      )}

      <main className="log">
        <div className="msg bot">{OPENING_DISCLOSURE}</div>

        {showCheckin && (
          <div className="card checkin">
            <div>How has this week been? (optional)</div>
            <div className="actions">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} className="secondary" onClick={() => logMood(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="muted small">1 = very hard, 5 = good. Saved only in this browser.</div>
          </div>
        )}

        {items.map((it, i) => {
          switch (it.kind) {
            case "user":
              return <div key={i} className="msg me">{it.text}</div>;
            case "assistant":
              return (
                <div key={i} className="bot-group">
                  <div className="msg bot">{it.text}</div>
                  {it.routes.map((r) => (
                    <ContactCard key={r.id} route={r} />
                  ))}
                  {it.consent && !it.answered && (
                    <div className="actions choices">
                      <button onClick={() => onConsent(it, "yes")}>Yes, show me the message first</button>
                      <button className="secondary" onClick={() => onConsent(it, "no")}>Not now</button>
                      <button className="secondary" onClick={() => onConsent(it, "more")}>Tell me more</button>
                    </div>
                  )}
                </div>
              );
            case "hotline":
              return (
                <div key={i} className="bot-group">
                  <div className="muted small">If things feel like too much, you can talk to someone right now, any time:</div>
                  {it.routes.map((r) => (
                    <ContactCard key={r.id} route={r} />
                  ))}
                </div>
              );
            case "preview":
              return it.done ? null : (
                <SummaryPreview key={i} unit={it.route.unit} lines={it.lines} onApprove={(k) => onApprove(it, k)} onCancel={() => onPreviewCancel(it)} />
              );
            case "handoff":
              return <HandoffCard key={i} route={it.route} lines={it.lines} />;
            case "error":
              return <div key={i} className="error">{it.text}</div>;
          }
        })}
        {busy && <div className="msg bot typing">…</div>}
        <div ref={bottom} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          rows={2}
          value={input}
          placeholder="Type a message"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      <footer className="muted small">
        In an emergency call 995. Samaritans of Singapore: 1767. This is a student prototype, not a clinical service.
      </footer>
    </div>
  );
}

function errorText(err: unknown): string {
  const fallback = "Something went wrong reaching the AI. If you need help now: call 995, or SOS on 1767.";
  if (err instanceof RefusalError) return "The AI couldn't answer that turn. " + fallback;
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected. Open “Your data” → Forget my API key, and sign in again.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a moment and try again. " + fallback;
  if (err instanceof Anthropic.APIError) return `API error (${err.status ?? "network"}). ` + fallback;
  return fallback;
}
