# Proof of concept: can an LLM consistently recognise risk signals?

Deck slide 8: *"An LLM rates ~20 labelled transcripts; we compare with ground truth for misses and over-escalations."* No model is trained. This **tests** the same engine the web app runs:

```
transcript (last ~20 messages)
   → LLM extracts C-SSRS / PHQ-9 cues      web/src/engine/extract.ts  (prompt: skill/references/risk-cues.md)
   → fixed rules pick the level            web/src/engine/rules.ts    (deterministic, unit-tested)
   → compare with the label, N times each  poc/run.ts → poc/results/
```

## Files

| File | What |
|---|---|
| `vignettes.json` | 25 illustrative vignettes (slide 7 examples, personas, figurative traps, hard cases) with **team draft** labels |
| `vignettes-for-raters.md` | Blind sheet (no labels) for clinicians. Regenerate with `npm run raters` |
| `run.ts` | Runs the engine over the vignettes and writes a report |
| `metrics.ts` | Misses, over-escalations, consistency, weighted kappa |
| `*.test.ts` | Tests for the rules and the metrics (no API calls) |

## Run it

From `poc/` (after `npm install` in `web/`, which provides the SDK):

```bash
npm test                                   # rules + metrics, offline
npm run mock                               # whole pipeline with simulated predictions, offline
export ANTHROPIC_API_KEY=sk-ant-...
node run.ts --only v01,v02 --runs 1        # 2 calls: check it works and what it costs
node run.ts                                # full run: 25 vignettes × 5 runs = 125 calls
```

Options: `--runs 5`, `--model claude-opus-5-5` (or `claude-sonnet-5-5`), `--effort medium`, `--concurrency 4`, `--only v03,v08`.

**Cost:** each run is one extraction call with a cached ~3k-token prompt. A full 125-call run should be a few US dollars on Opus 5.5 (roughly half on Sonnet 5.5). That's an estimate: do the 2-call check first and look at your Console usage.

## What the report shows

| Metric | Why it matters (deck) |
|---|---|
| **Critical misses**: level 3–4 cases rated 1–2 | "Escalate too little: the cost can be a life" |
| **Over-escalation rate**, **false "Urgent"** | "Escalate too much … log every over-escalation as a cost" |
| **Fully consistent vignettes**, **run-to-run agreement** | The research question is *consistently* recognise |
| Weighted kappa | Agreement with ground truth beyond chance |
| Per-vignette "rules fired" | Shows *why*: which cue drove each decision |

## Ground truth (open question 3 on slide 9)

The labels in `vignettes.json` are **team drafts** from the C-SSRS screener and PHQ-9 mapping. They are not validated. Before reporting results as findings:

1. Send `vignettes-for-raters.md` (no labels) to one or more clinicians.
2. Put their answers in each vignette's `clinician_label`. The runner uses it automatically and marks any vignette still on a team label with `*`.
3. If clinicians disagree with the team label, that's a finding too: it tests the rules, not just the LLM.

Hard cases worth discussing with clinicians: `v14` (attempt two years ago, none now), `v22` (daily thoughts, no method), `v25` (researched a lethal amount but denies intent).

## Limits

- 25 short, team-written vignettes: illustrative, not real student data, no statistical power.
- Measures cue extraction + rules on single snapshots. Conversation-level behaviour (the tier floor, retreats over many turns) is covered by the persona tests in `evals/personas.md`.
- One model at a time; rerun with `--model` to compare.
- Thresholds are placeholders pending clinician calibration.
