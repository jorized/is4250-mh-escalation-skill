/** Deterministic tests for the decision rules (risk-cues.md part B). Run: node --test poc/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../web/src/engine/rules.ts";
import type { Cues } from "../web/src/engine/cues.ts";

function cues(over: Partial<Omit<Cues, "cssrs">> & { cssrs?: Partial<Cues["cssrs"]> } = {}): Cues {
  const base: Cues = {
    cssrs: { wish_dead: false, active_thoughts: false, method: false, intent: false, plan: false, behaviour_recent: false, behaviour_past: false },
    self_harm_nonsuicidal: false,
    injury_needs_care: false,
    cannot_stay_safe: false,
    harm_to_others: false,
    phq9_items: [],
    persisting: false,
    figurative_risk_language: false,
    uncertain: false,
    retreat: false,
    evidence: [],
  };
  return { ...base, ...over, cssrs: { ...base.cssrs, ...(over.cssrs ?? {}) } };
}

const cases: [string, Cues, number, number][] = [
  ["no cues → routine", cues(), 0, 1],
  ["figurative only → routine, non-event", cues({ figurative_risk_language: true }), 0, 1],
  ["one week sleep + concentration → routine", cues({ phq9_items: ["sleep", "concentration"] }), 0, 1],
  ["persisting appetite + anhedonia → tier 1 / Watch", cues({ phq9_items: ["appetite", "anhedonia"], persisting: true }), 1, 2],
  ["5 PHQ-9 items, not persisting → tier 1 / Watch", cues({ phq9_items: ["sleep", "fatigue", "appetite", "low_mood", "concentration"] }), 1, 2],
  ["wish to be dead → tier 2 / Watch", cues({ cssrs: { wish_dead: true } }), 2, 2],
  ["PHQ-9 item 9 → tier 2 / Watch", cues({ phq9_items: ["thoughts_of_death"] }), 2, 2],
  ["active thoughts → tier 2 / Watch", cues({ cssrs: { active_thoughts: true } }), 2, 2],
  ["non-suicidal self-harm → tier 2 / Watch", cues({ self_harm_nonsuicidal: true }), 2, 2],
  ["method → tier 2 / Escalate", cues({ cssrs: { active_thoughts: true, method: true } }), 2, 3],
  ["past behaviour → tier 2 / Escalate", cues({ cssrs: { behaviour_past: true } }), 2, 3],
  ["intent → tier 3 / Urgent", cues({ cssrs: { intent: true } }), 3, 4],
  ["plan → tier 3 / Urgent", cues({ cssrs: { plan: true } }), 3, 4],
  ["recent behaviour → tier 3 / Urgent", cues({ cssrs: { behaviour_recent: true } }), 3, 4],
  ["injury needing care → tier 3 / Urgent", cues({ injury_needs_care: true }), 3, 4],
  ["cannot stay safe → tier 3 / Urgent", cues({ cannot_stay_safe: true }), 3, 4],
  ["harm to others → tier 3 / Urgent", cues({ harm_to_others: true }), 3, 4],
  ["urgent beats figurative flag", cues({ figurative_risk_language: true, cssrs: { intent: true } }), 3, 4],
];

for (const [name, c, tier, level] of cases) {
  test(name, () => {
    const d = decide(c);
    assert.equal(d.tier, tier);
    assert.equal(d.level, level);
  });
}

test("clarifying question only below tier 3", () => {
  assert.equal(decide(cues({ uncertain: true })).followUp, true);
  assert.equal(decide(cues({ uncertain: true, cssrs: { intent: true } })).followUp, false);
});

test("figurative non-event is flagged for logging", () => {
  assert.equal(decide(cues({ figurative_risk_language: true })).nonEvent, true);
  assert.equal(decide(cues({ figurative_risk_language: true, cssrs: { wish_dead: true } })).nonEvent, false);
});
