import type { Violation } from "./types.js";
import { rules } from "./rules/index.js";

const penaltyMap = new Map(rules.map((r) => [r.name, r.penalty]));

export function computeScore(violations: Violation[]): number {
  let score = 100;
  for (const v of violations) {
    score -= penaltyMap.get(v.rule) ?? 0;
  }
  return Math.max(0, score);
}
