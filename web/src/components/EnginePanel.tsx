import type { Cues } from "../engine/cues.ts";
import { DECK_LABELS, type Decision, type Tier } from "../engine/rules.ts";

export interface EngineEntry {
  message: string;
  cues: Cues | null;
  decision: Decision | null;
  tier: Tier;
}

function trueCues(c: Cues): string[] {
  const out = Object.entries(c.cssrs)
    .filter(([, v]) => v)
    .map(([k]) => `C-SSRS ${k}`);
  for (const k of ["self_harm_nonsuicidal", "injury_needs_care", "cannot_stay_safe", "harm_to_others", "persisting", "figurative_risk_language", "uncertain", "retreat"] as const) {
    if (c[k]) out.push(k);
  }
  if (c.phq9_items.length) out.push(`PHQ-9: ${c.phq9_items.join(", ")}`);
  return out;
}

/** TEST MODE only: shows the slide-5 pipeline (cues → rules → tier) for each student message. */
export function EnginePanel({ entries, onClose }: { entries: EngineEntry[]; onClose: () => void }) {
  return (
    <div className="card panel">
      <div className="panel-head">
        <strong>Escalation engine (test mode only)</strong>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="small muted">Never shown to students in a real deployment. Cues come from the model; the tier comes from fixed rules.</p>
      {entries.length === 0 && <p className="small">No messages yet.</p>}
      <ol className="engine-log">
        {entries.map((e, i) => (
          <li key={i} className="small">
            <div className="engine-msg">“{e.message}”</div>
            {e.cues && e.decision ? (
              <>
                <div>Cues: {trueCues(e.cues).join(" · ") || "none"}</div>
                <div>
                  Rules → tier {e.decision.tier} / level {e.decision.level} {DECK_LABELS[e.decision.level]}
                  {e.decision.reasons.length ? ` (${e.decision.reasons.join("; ")})` : ""}
                </div>
                <div>
                  <strong>Acted on: tier {e.tier}</strong>
                  {e.tier > e.decision.tier ? " (session floor or mood pattern)" : ""}
                  {e.decision.followUp ? " · clarifying question" : ""}
                  {e.decision.nonEvent ? " · logged non-event" : ""}
                </div>
              </>
            ) : (
              <div>Engine unavailable; model judged the tier (floor {e.tier}).</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
