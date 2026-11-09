import type { MoodEntry, UsageLog } from "../lib/storage";

export function DataPanel(props: {
  moodOptIn: boolean;
  mood: MoodEntry[];
  usage: UsageLog;
  onToggleMood: (v: boolean) => void;
  onDeleteAll: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const { moodOptIn, mood, usage } = props;
  return (
    <div className="card panel">
      <div className="panel-head">
        <strong>Your data in this browser</strong>
        <button className="secondary" onClick={props.onClose}>
          Close
        </button>
      </div>
      <p className="small">
        Your chat is not saved. When you close this tab it is gone. This browser keeps only what is listed below.
      </p>
      <label className="row">
        <input type="checkbox" checked={moodOptIn} onChange={(e) => props.onToggleMood(e.target.checked)} />
        Weekly mood check-in (optional)
      </label>
      <div className="small">
        <div>Mood check-ins: {mood.length === 0 ? "none" : mood.map((m) => `${new Date(m.at).toLocaleDateString()}: ${m.score}/5`).join(", ")}</div>
        <div>
          Message times recorded: {usage.messages.length} (times only, no content). Used to notice very heavy or late-night use.
        </div>
      </div>
      <div className="actions">
        <button className="danger" onClick={props.onDeleteAll}>
          Delete all my data
        </button>
        <button className="secondary" onClick={props.onSignOut}>
          Forget my API key
        </button>
      </div>
    </div>
  );
}
