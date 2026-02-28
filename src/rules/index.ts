import type { Rule, RuleName } from "../types.js";
import { noHardcodedColors } from "./no-hardcoded-colors.js";
import { spacingScale } from "./spacing-scale.js";
import { usePrimitives } from "./use-primitives.js";

export interface RuleEntry {
  name: RuleName;
  penalty: number;
  run: Rule;
}

export const rules: RuleEntry[] = [
  { name: "no-hardcoded-colors", penalty: 15, run: noHardcodedColors },
  { name: "spacing-scale", penalty: 10, run: spacingScale },
  { name: "use-primitives", penalty: 20, run: usePrimitives },
];
