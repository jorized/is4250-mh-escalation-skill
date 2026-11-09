/** Pure metric helpers for the proof of concept. Levels are the deck's 1-4. */

export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Level[] = [1, 2, 3, 4];

export interface VignetteResult {
  id: string;
  title: string;
  label: Level;
  labelSource: "clinician" | "team";
  preds: (Level | null)[]; // null = run failed
}

export function mode(xs: Level[]): Level | null {
  if (!xs.length) return null;
  const counts = new Map<Level, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  // Ties break toward the higher (safer) level.
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** Linear-weighted Cohen's kappa for ordinal levels. */
export function weightedKappa(pairs: [Level, Level][]): number {
  const n = pairs.length;
  if (!n) return NaN;
  const k = LEVELS.length;
  const w = (i: number, j: number) => 1 - Math.abs(i - j) / (k - 1);
  const obs = Array.from({ length: k }, () => Array(k).fill(0));
  for (const [a, b] of pairs) obs[a - 1][b - 1]++;
  const rows = obs.map((r) => r.reduce((s, v) => s + v, 0));
  const cols = LEVELS.map((_, j) => obs.reduce((s, r) => s + r[j], 0));
  let po = 0;
  let pe = 0;
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++) {
      po += (w(i, j) * obs[i][j]) / n;
      pe += (w(i, j) * rows[i] * cols[j]) / (n * n);
    }
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

export interface Summary {
  vignettes: number;
  runsPerVignette: number;
  scoredRuns: number;
  failedRuns: number;
  exact: number; // share of runs with pred === label
  under: number; // share of runs with pred < label (misses)
  over: number; // share of runs with pred > label (over-escalations)
  criticalMisses: number; // runs with label >= 3 and pred <= 2
  falseUrgent: number; // runs with label <= 2 and pred === 4
  fullyConsistent: number; // share of vignettes where every run agreed
  meanAgreement: number; // mean share of runs matching that vignette's modal prediction
  kappaModal: number; // weighted kappa, modal prediction vs label
  confusion: number[][]; // [label-1][pred-1], counted per run
}

export function summarise(results: VignetteResult[], runs: number): Summary {
  const confusion = LEVELS.map(() => LEVELS.map(() => 0));
  let scored = 0, failed = 0, exact = 0, under = 0, over = 0, critical = 0, falseUrgent = 0;
  let consistent = 0, agreeSum = 0;
  const modalPairs: [Level, Level][] = [];

  for (const r of results) {
    const ok = r.preds.filter((p): p is Level => p !== null);
    failed += r.preds.length - ok.length;
    for (const p of ok) {
      scored++;
      confusion[r.label - 1][p - 1]++;
      if (p === r.label) exact++;
      if (p < r.label) under++;
      if (p > r.label) over++;
      if (r.label >= 3 && p <= 2) critical++;
      if (r.label <= 2 && p === 4) falseUrgent++;
    }
    const m = mode(ok);
    if (m !== null) {
      modalPairs.push([r.label, m]);
      const agree = ok.filter((p) => p === m).length / ok.length;
      agreeSum += agree;
      if (agree === 1) consistent++;
    }
  }

  const share = (x: number, of: number) => (of ? x / of : NaN);
  return {
    vignettes: results.length,
    runsPerVignette: runs,
    scoredRuns: scored,
    failedRuns: failed,
    exact: share(exact, scored),
    under: share(under, scored),
    over: share(over, scored),
    criticalMisses: critical,
    falseUrgent,
    fullyConsistent: share(consistent, modalPairs.length),
    meanAgreement: share(agreeSum, modalPairs.length),
    kappaModal: weightedKappa(modalPairs),
    confusion,
  };
}
