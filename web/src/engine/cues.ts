import { z } from "zod";

/** Cues anchored to PHQ-9 and the C-SSRS screener. Definitions: skill/references/risk-cues.md */
export const PHQ9_ITEMS = [
  "anhedonia",
  "low_mood",
  "sleep",
  "fatigue",
  "appetite",
  "worthlessness",
  "concentration",
  "psychomotor",
  "thoughts_of_death",
] as const;

export const CueSchema = z.object({
  cssrs: z.object({
    wish_dead: z.boolean(),
    active_thoughts: z.boolean(),
    method: z.boolean(),
    intent: z.boolean(),
    plan: z.boolean(),
    behaviour_recent: z.boolean().describe("attempt, interrupted/aborted attempt or preparatory act in the past 3 months"),
    behaviour_past: z.boolean().describe("any such behaviour more than 3 months ago"),
  }),
  self_harm_nonsuicidal: z.boolean(),
  injury_needs_care: z.boolean(),
  cannot_stay_safe: z.boolean(),
  harm_to_others: z.boolean(),
  phq9_items: z.array(z.enum(PHQ9_ITEMS)),
  persisting: z.boolean().describe("symptoms described as lasting about two weeks or more"),
  figurative_risk_language: z.boolean(),
  uncertain: z.boolean().describe("risk language present but unclear; one clarifying question needed"),
  retreat: z.boolean().describe("student retracted or minimised something said earlier"),
  evidence: z.array(z.object({ cue: z.string(), words: z.string() })),
});

export type Cues = z.infer<typeof CueSchema>;
