import { test } from "node:test";
import assert from "node:assert/strict";
import { mode, summarise, weightedKappa } from "./metrics.ts";

test("mode breaks ties toward the higher level", () => {
  assert.equal(mode([2, 3]), 3);
  assert.equal(mode([1, 1, 4]), 1);
});

test("perfect agreement → kappa 1", () => {
  assert.equal(weightedKappa([[1, 1], [2, 2], [3, 3], [4, 4]]), 1);
});

test("summary counts misses, over-escalations and critical misses", () => {
  const s = summarise(
    [
      { id: "a", title: "", label: 4, labelSource: "team", preds: [4, 2, 4] },
      { id: "b", title: "", label: 1, labelSource: "team", preds: [1, 1, 4] },
      { id: "c", title: "", label: 2, labelSource: "team", preds: [2, 2, null] },
    ],
    3,
  );
  assert.equal(s.scoredRuns, 8);
  assert.equal(s.failedRuns, 1);
  assert.equal(s.criticalMisses, 1);
  assert.equal(s.falseUrgent, 1);
  assert.equal(s.under, 1 / 8);
  assert.equal(s.over, 1 / 8);
  assert.equal(s.fullyConsistent, 1 / 3);
});
