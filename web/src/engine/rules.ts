import type { Cues } from "./cues.ts";

/**
 * Decision rules: skill/references/risk-cues.md part B.
 * Pure and deterministic: the same cues always give the same decision.
 */

export type Tier = 0 | 1 | 2 | 3;
export type DeckLevel = 1 | 2 | 3 | 4;

export const DECK_LABELS: Record<DeckLevel, string> = {
  1: "Routine",
  2: "Watch",
  3: "Escalate",
  4: "Urgent",
};

/** Placeholders pending clinician calibration. */
export const PHQ9_RULES = {
  minItemsIfPersisting: 2,
  minItemsAny: 5,
} as const;

export interface Decision {
  tier: Tier;
  level: DeckLevel;
  reasons: string[];
  followUp: boolean;
  nonEvent: boolean; // figurative-only language, logged rather than escalated
}

export function decide(c: Cues): Decision {
  const s = c.cssrs;
  const hits = (pairs: [boolean, string][]) => pairs.filter(([v]) => v).map(([, name]) => name);

  const urgent = hits([
    [s.intent, "C-SSRS intent"],
    [s.plan, "C-SSRS plan"],
    [s.behaviour_recent, "C-SSRS behaviour (past 3 months)"],
    [c.injury_needs_care, "injury or overdose needing care"],
    [c.cannot_stay_safe, "cannot stay safe"],
    [c.harm_to_others, "intent to harm others"],
  ]);
  if (urgent.length) return done(3, 4, urgent, c);

  const escalate = hits([
    [s.method, "C-SSRS thoughts with a method"],
    [s.behaviour_past, "C-SSRS behaviour (over 3 months ago)"],
  ]);
  if (escalate.length) return done(2, 3, escalate, c);

  const watch = hits([
    [s.active_thoughts, "C-SSRS active suicidal thoughts"],
    [s.wish_dead, "C-SSRS wish to be dead"],
    [c.self_harm_nonsuicidal, "non-suicidal self-harm"],
    [c.phq9_items.includes("thoughts_of_death"), "PHQ-9 item 9 (thoughts of death)"],
  ]);
  if (watch.length) return done(2, 2, watch, c);

  const n = new Set(c.phq9_items).size;
  if ((c.persisting && n >= PHQ9_RULES.minItemsIfPersisting) || n >= PHQ9_RULES.minItemsAny) {
    return done(1, 2, [`${n} PHQ-9 items${c.persisting ? ", persisting 2+ weeks" : ""}`], c);
  }

  return done(0, 1, c.figurative_risk_language ? ["figurative risk language only (non-event)"] : [], c);
}

function done(tier: Tier, level: DeckLevel, reasons: string[], c: Cues): Decision {
  return {
    tier,
    level,
    reasons,
    followUp: c.uncertain && tier < 3,
    nonEvent: tier === 0 && c.figurative_risk_language,
  };
}
