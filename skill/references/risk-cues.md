# Risk cues: what to extract, and the rules that set the tier

> Working draft. Cues are anchored to items of two validated screeners (PHQ-9 and the C-SSRS screener). We map existing screener items to actions; we do not create a new clinical classification. The thresholds marked *placeholder* need clinician confirmation.

The engine works in two steps:

1. **Extract cues** from the last ~20 messages (this file, part A).
2. **Apply fixed rules** to the cues to set the tier (part B). Rules, not judgment, decide the level, so the decision is the same every time for the same cues.

The web MVP does step 2 in code (`web/src/engine/rules.ts`). In a white-label deployment, apply part B yourself, exactly as written.

## A. Cues

Mark a cue **true only if the student said it**, about themselves, in this conversation. Do not infer from tone alone.

### C-SSRS screener cues

| Cue | True when the student says… | Examples |
|---|---|---|
| `wish_dead` | they wish they were dead, could go to sleep and not wake up, or disappear for good | "sometimes I wish I could just not wake up", "everyone would be fine without me" |
| `active_thoughts` | they are having thoughts of killing themselves (no method, intent or plan yet) | "I keep thinking about killing myself", "I want to unalive myself, not joking" |
| `method` | they have thought about **how** they would do it, without saying they intend to act | "I've thought about jumping from my block", "I know where the pills are" |
| `intent` | they intend to act on the thoughts, with or without a plan | "I'm going to do it", "I've decided" |
| `plan` | they have worked out details: when, where or how, and mean to carry it out | "tonight, after everyone's asleep" |
| `behaviour_recent` | in the **past 3 months** they made an attempt, started one and stopped, were stopped, or prepared (e.g. collected pills, wrote a note, researched lethal amounts) | "I took a bunch of pills last month" |
| `behaviour_past` | any of the above **more than 3 months ago** | "I tried two years ago" |

### Other safety cues

| Cue | True when |
|---|---|
| `self_harm_nonsuicidal` | they hurt themselves to cope, without wanting to die (cutting, burning, hitting) |
| `injury_needs_care` | an injury or overdose may need medical care **now** |
| `cannot_stay_safe` | they say they cannot keep themselves safe |
| `harm_to_others` | they intend to harm someone else |

### PHQ-9 items (`phq9_items`)

List each that the student describes: `anhedonia` (little interest or pleasure), `low_mood`, `sleep`, `fatigue`, `appetite`, `worthlessness` (feeling a failure or a burden), `concentration`, `psychomotor` (slowed down or restless), `thoughts_of_death`.

`persisting` = true if they say it has lasted about **two weeks or more**.

### Interpretation rules

- **Figures of speech are not cues.** "This assignment makes me want to shoot myself", "kms this lab", "dying inside lol" are figurative when the surrounding messages are light, joking or about a task. Set `figurative_risk_language = true` and leave the cues false. If you can't tell, set `uncertain = true` instead and leave the cues false: the bot will ask.
- **Euphemisms count.** "unalive", "kms" said seriously, "not be around", "end it", "disappear for good".
- **Fiction that mirrors the student counts as real** ("a story about a uni student like me who wants to disappear"). Mark the cues.
- **A retraction does not erase a cue.** If they said it earlier and then "forget it, I'm fine", "just a story", "joking", the cue stays true; set `retreat = true`.
- **Only the student's own words.** Ignore the assistant's lines except as context.
- `evidence`: for each true cue, a few words from the student's message (internal only; never shown to the student or put in a summary).

## B. Rules (first match wins)

| Tier | Deck level | Rule |
|---|---|---|
| **3** Imminent | **4 Urgent** | `intent` or `plan` or `behaviour_recent` or `injury_needs_care` or `cannot_stay_safe` or `harm_to_others` |
| **2** Ideation / self-harm | **3 Escalate** | `method` or `behaviour_past` |
| **2** Ideation / self-harm | **2 Watch** | `active_thoughts` or `wish_dead` or `self_harm_nonsuicidal` or `thoughts_of_death` in phq9_items |
| **1** Persistent strain | **2 Watch** | `persisting` and 2+ PHQ-9 items, or 5+ PHQ-9 items *(placeholder)* |
| **0** Everyday stress | **1 Routine** | anything else, including figurative-only language (logged as a non-event) |

Then:

- **The tier never goes down within a conversation** (the floor is the highest tier so far).
- A repeated-low mood pattern (`thresholds.md`) lifts tier 0 to tier 1: an offer, not an escalation.
- If `uncertain` is true and the tier is below 3, the next reply asks **one** clarifying question.
- Only tier 3 may act over a "No" (`tier3.md`). Deck level 3 (Escalate) means a warm handoff to central counselling **with consent**; it does not override a refusal.
