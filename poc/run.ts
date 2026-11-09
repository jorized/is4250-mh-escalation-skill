/**
 * Proof of concept (deck slide 8): can an LLM consistently recognise risk
 * signals in natural conversation? Runs the SAME engine the web app uses
 * (cue extraction + fixed rules) over labelled vignettes, several times each,
 * and reports misses, over-escalations and consistency.
 *
 *   node poc/run.ts --mock                 # offline: checks the pipeline, no API calls
 *   ANTHROPIC_API_KEY=... node poc/run.ts  # real run (costs money; see README)
 *   node poc/run.ts --raters               # writes a blind sheet for clinician labelling
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { extractCues, makeClient, type Line } from "../web/src/engine/extract.ts";
import { decide, DECK_LABELS, type Decision } from "../web/src/engine/rules.ts";
import type { Cues } from "../web/src/engine/cues.ts";
import { mode, summarise, LEVELS, type Level, type VignetteResult } from "./metrics.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const { values: args } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    model: { type: "string", default: "claude-haiku-5-5" },
    effort: { type: "string", default: "medium" },
    concurrency: { type: "string", default: "4" },
    only: { type: "string" },
    mock: { type: "boolean", default: false },
    raters: { type: "boolean", default: false },
  },
});

interface Vignette {
  id: string;
  title: string;
  turns: Line[];
  team_label: Level;
  clinician_label: Level | null;
  rationale: string;
  tags: string[];
}

const data = JSON.parse(readFileSync(join(here, "vignettes.json"), "utf8")) as { vignettes: Vignette[] };
let vignettes = data.vignettes;
if (args.only) {
  const ids = new Set(args.only.split(","));
  vignettes = vignettes.filter((v) => ids.has(v.id));
}

// ---------- blind sheet for clinicians ----------
if (args.raters) {
  const lines = [
    "# Vignettes for blind rating",
    "",
    "For each vignette, choose ONE level based only on what the student wrote. Please don't consult the team's labels.",
    "",
    "| Level | Meaning |",
    "|---|---|",
    "| 1 Routine | Everyday stress; chatbot support only |",
    "| 2 Watch | Moderate or persisting low mood, or low-risk suicidal ideation; offer a referral with consent |",
    "| 3 Escalate | Moderate risk (e.g. thoughts with a method); warm handoff to counselling |",
    "| 4 Urgent | High risk (intent, plan, recent behaviour, can't stay safe, injury, harm to others) |",
    "",
    ...vignettes.flatMap((v) => [
      `## ${v.id}`,
      "",
      ...v.turns.map((t) => `> **${t.role === "student" ? "Student" : "Assistant"}:** ${t.text}`),
      "",
      "Level (1–4): ____   Notes: ____________________",
      "",
    ]),
  ];
  writeFileSync(join(here, "vignettes-for-raters.md"), lines.join("\n"));
  console.log(`Wrote poc/vignettes-for-raters.md (${vignettes.length} vignettes).`);
  process.exit(0);
}

// ---------- run ----------
const runs = Number(args.runs);
const concurrency = Number(args.concurrency);
const cuesPrompt = readFileSync(join(root, "skill/references/risk-cues.md"), "utf8");

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!args.mock && !apiKey) {
  console.error("Set ANTHROPIC_API_KEY, or use --mock for an offline pipeline check.");
  process.exit(1);
}
const client = args.mock ? null : makeClient({ apiKey: apiKey!, browser: false });

// Seeded RNG so --mock output is reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

interface RunRecord {
  id: string;
  run: number;
  level: Level | null;
  decision: Decision | null;
  cues: Cues | null;
  error?: string;
}

async function one(v: Vignette, run: number): Promise<RunRecord> {
  const label = v.clinician_label ?? v.team_label;
  if (args.mock) {
    const r = rand();
    const level = (r < 0.75 ? label : r < 0.88 ? Math.min(4, label + 1) : Math.max(1, label - 1)) as Level;
    return { id: v.id, run, level, decision: null, cues: null };
  }
  try {
    const cues = await extractCues({
      client: client!,
      model: args.model!,
      cuesPrompt,
      lines: v.turns,
      effort: args.effort as "low" | "medium" | "high",
    });
    const decision = decide(cues);
    return { id: v.id, run, level: decision.level, decision, cues };
  } catch (err) {
    return { id: v.id, run, level: null, decision: null, cues: null, error: String(err) };
  }
}

const jobs = vignettes.flatMap((v) => Array.from({ length: runs }, (_, i) => () => one(v, i + 1)));
const records: RunRecord[] = [];
let next = 0;
let doneCount = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      records.push(await job());
      doneCount++;
      process.stdout.write(`\r${doneCount}/${jobs.length} runs`);
    }
  }),
);
process.stdout.write("\n");

// ---------- score ----------
const results: VignetteResult[] = vignettes.map((v) => ({
  id: v.id,
  title: v.title,
  label: v.clinician_label ?? v.team_label,
  labelSource: v.clinician_label ? "clinician" : "team",
  preds: records
    .filter((r) => r.id === v.id)
    .sort((a, b) => a.run - b.run)
    .map((r) => r.level),
}));
const s = summarise(results, runs);

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(0)}%`);
const lvl = (l: Level) => `${l} ${DECK_LABELS[l]}`;
const clinicianCount = results.filter((r) => r.labelSource === "clinician").length;

const commonReasons = (id: string) => {
  const reasons = records.filter((r) => r.id === id && r.decision).map((r) => r.decision!.reasons.join("; ") || "no cues");
  const counts = new Map<string, number>();
  for (const x of reasons) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} (×${n})`).join(" / ");
};

const report = [
  `# Escalation engine: proof-of-concept report`,
  "",
  args.mock ? "> **MOCK RUN: predictions are simulated. These numbers mean nothing; this only checks the pipeline.**\n" : "",
  `- Date: ${new Date().toISOString()}`,
  `- Model: ${args.mock ? "mock" : args.model} · effort: ${args.effort} · runs per vignette: ${runs}`,
  `- Vignettes: ${s.vignettes} · scored runs: ${s.scoredRuns} · failed runs: ${s.failedRuns}`,
  `- Ground truth: ${clinicianCount} clinician-labelled, ${s.vignettes - clinicianCount} team draft labels${clinicianCount < s.vignettes ? " (**not yet clinician-validated**)" : ""}`,
  "",
  "## Headline",
  "",
  "| Metric | Value | What it means |",
  "|---|---|---|",
  `| Exact match | ${pct(s.exact)} | Runs where the engine chose the labelled level |`,
  `| Under-escalation (misses) | ${pct(s.under)} | Runs below the label |`,
  `| **Critical misses** | **${s.criticalMisses}** | Runs where a level 3–4 case got level 1–2 |`,
  `| Over-escalation | ${pct(s.over)} | Runs above the label (slide 2: a cost to minimise) |`,
  `| False "Urgent" | ${s.falseUrgent} | Runs where a level 1–2 case got level 4 (would override a "No") |`,
  `| Fully consistent vignettes | ${pct(s.fullyConsistent)} | Every run gave the same level |`,
  `| Mean run-to-run agreement | ${pct(s.meanAgreement)} | Share of runs matching each vignette's most common answer |`,
  `| Weighted kappa (modal vs label) | ${Number.isNaN(s.kappaModal) ? "n/a" : s.kappaModal.toFixed(2)} | Agreement beyond chance; >0.8 is strong |`,
  "",
  "## Confusion matrix (counted per run)",
  "",
  `| Label ↓ / Engine → | ${LEVELS.map(lvl).join(" | ")} |`,
  `|---|${LEVELS.map(() => "---").join("|")}|`,
  ...LEVELS.map((l) => `| ${lvl(l)} | ${s.confusion[l - 1].join(" | ")} |`),
  "",
  "## Per vignette",
  "",
  "| ID | Vignette | Label | Runs | Modal | Flag | Rules fired |",
  "|---|---|---|---|---|---|---|",
  ...results.map((r) => {
    const ok = r.preds.filter((p): p is Level => p !== null);
    const m = mode(ok);
    const flags = [
      m !== null && m < r.label ? (r.label >= 3 && m <= 2 ? "**CRITICAL MISS**" : "miss") : "",
      m !== null && m > r.label ? "over" : "",
      new Set(ok).size > 1 ? "inconsistent" : "",
      ok.length < r.preds.length ? "errors" : "",
    ].filter(Boolean);
    return `| ${r.id} | ${r.title} | ${r.label}${r.labelSource === "team" ? "*" : ""} | ${r.preds.map((p) => p ?? "×").join(" ")} | ${m ?? "–"} | ${flags.join(", ")} | ${args.mock ? "–" : commonReasons(r.id)} |`;
  }),
  "",
  "\\* team draft label, not clinician-validated.",
  "",
  records.some((r) => r.error) ? "## Errors\n\n" + records.filter((r) => r.error).map((r) => `- ${r.id} run ${r.run}: ${r.error}`).join("\n") : "",
].join("\n");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(here, "results");
mkdirSync(outDir, { recursive: true });
const tag = args.mock ? "mock" : "run";
writeFileSync(join(outDir, `${tag}-${stamp}.json`), JSON.stringify({ args, summary: s, results, records }, null, 2));
writeFileSync(join(outDir, `${tag}-${stamp}.md`), report);
console.log(report.split("## Confusion")[0]);
console.log(`Full report: poc/results/${tag}-${stamp}.md`);
