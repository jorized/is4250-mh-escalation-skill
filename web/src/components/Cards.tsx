import { useState } from "react";
import type { Turn } from "../lib/llm";
import { mailtoHref, telHref, type RouteEntry } from "../lib/routing";
import { TEST_MODE } from "../lib/config";

export function ContactCard({ route, summaryText }: { route: RouteEntry; summaryText?: string }) {
  return (
    <div className="contact">
      <div className="contact-name">
        {route.unit}
        {!route.verified && <span className="tag">unverified</span>}
      </div>
      {route.hours && <div className="muted small">{route.hours}</div>}
      {route.access && <div className="muted small">{route.access}</div>}
      <div className="actions">
        {route.phone && <a className="btn" href={telHref(route.phone)}>Call {route.phone}</a>}
        {route.email && (
          <a className="btn" href={mailtoHref(route.email, "Request for support", summaryText ?? "")}>
            Email{summaryText ? " with summary" : ""}
          </a>
        )}
        {route.booking_url && (
          <a className="btn" href={route.booking_url} target="_blank" rel="noreferrer">
            Book
          </a>
        )}
        {!route.phone && !route.email && !route.booking_url && (
          <span className="muted small">Contact details not added yet.</span>
        )}
      </div>
    </div>
  );
}

export type Summary = NonNullable<Turn["summary"]>;

export function summaryLines(s: Summary, consentBasis: string): string[] {
  const lines = [
    `Safety status now: ${s.safety_status}`,
    `Main concerns: ${s.main_concerns}`,
    s.how_long && `How long: ${s.how_long}`,
    s.already_tried && `Already tried: ${s.already_tried}`,
    s.asking_for && `Asking for: ${s.asking_for}`,
    s.contact_preference && `Contact preference: ${s.contact_preference}`,
    `Consent basis: ${consentBasis}`,
  ];
  return lines.filter((l): l is string => Boolean(l));
}

/** M4: the student sees the exact summary and can remove lines before approving. */
export function SummaryPreview({
  unit,
  lines,
  onApprove,
  onCancel,
}: {
  unit: string;
  lines: string[];
  onApprove: (kept: string[]) => void;
  onCancel: () => void;
}) {
  const [keep, setKeep] = useState(lines.map(() => true));
  const locked = (l: string) => l.startsWith("Consent basis");
  return (
    <div className="card preview">
      <div className="preview-title">This is exactly what {unit} would receive. Untick anything you want removed.</div>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            <label className="row">
              <input
                type="checkbox"
                checked={keep[i]}
                disabled={locked(l)}
                onChange={() => setKeep(keep.map((k, j) => (j === i ? !k : k)))}
              />
              <span className={keep[i] ? "" : "struck"}>{l}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="muted small">Your chat itself is never included.</p>
      <div className="actions">
        <button onClick={() => onApprove(lines.filter((_, i) => keep[i]))}>Okay, send it</button>
        <button className="secondary" onClick={onCancel}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** M10: every simulated escalation carries the label and the summary. */
export function HandoffCard({ route, lines }: { route: RouteEntry; lines: string[] }) {
  const text = lines.join("\n");
  return (
    <div className="card handoff">
      {TEST_MODE ? (
        <div className="testlabel">
          [TEST MODE: nothing was sent to {route.unit}. This is the summary that would have been sent.]
        </div>
      ) : (
        <div className="testlabel">Summary shared with {route.unit}.</div>
      )}
      <pre>{text}</pre>
      <p className="small">You can still reach them yourself. These links are real:</p>
      <ContactCard route={route} summaryText={text} />
    </div>
  );
}
