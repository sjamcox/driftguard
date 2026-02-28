import type { Node } from "@babel/types";
import type { TraverseOptions } from "@babel/traverse";
import type { BabelAST, Rule, RuleContext, Violation } from "../types.js";

import _traverse from "@babel/traverse";
const traverse: (node: Node, opts: TraverseOptions) => void = (
  typeof (_traverse as any).default === "function"
    ? (_traverse as any).default
    : _traverse
);

const SPACING_PROPS = new Set([
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "gap", "rowGap", "columnGap",
  "top", "right", "bottom", "left",
]);

const EXEMPT_STRING_VALUES = new Set(["auto", "inherit"]);

function findNearest(value: number, scale: number[]): string {
  const sorted = [...scale].sort((a, b) => Math.abs(a - value) - Math.abs(b - value));
  const nearest = sorted.slice(0, 2);
  return nearest.join(" or ");
}

function parsePxValue(str: string): number | null {
  const match = str.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

export const spacingScale: Rule = (ast: BabelAST, ctx: RuleContext): Violation[] => {
  const violations: Violation[] = [];
  const scale = ctx.config.tokens.spacingScale;
  const scaleSet = new Set(scale);

  traverse(ast, {
    ObjectProperty(path) {
      if (path.node.computed) return;

      const key = path.node.key;
      let propName: string | null = null;
      if (key.type === "Identifier") {
        propName = key.name;
      } else if (key.type === "StringLiteral") {
        propName = key.value;
      }

      if (!propName || !SPACING_PROPS.has(propName)) return;

      const val = path.node.value;

      // Handle NumericLiteral: { marginTop: 18 }
      if (val.type === "NumericLiteral") {
        const num = val.value;
        if (num === 0) return;
        if (!scaleSet.has(num)) {
          violations.push({
            rule: "spacing-scale",
            line: val.loc?.start.line ?? 0,
            column: val.loc?.start.column ?? 0,
            value: String(num),
            message: `Spacing value ${num}px is not in the design scale.`,
            suggestion: `Nearest valid values: ${findNearest(num, scale)}`,
          });
        }
        return;
      }

      // Handle UnaryExpression for negative values: { marginTop: -8 }
      if (
        val.type === "UnaryExpression" &&
        val.operator === "-" &&
        val.argument.type === "NumericLiteral"
      ) {
        const abs = val.argument.value;
        if (abs === 0) return;
        if (!scaleSet.has(abs)) {
          violations.push({
            rule: "spacing-scale",
            line: val.loc?.start.line ?? 0,
            column: val.loc?.start.column ?? 0,
            value: String(-abs),
            message: `Spacing value ${-abs}px is not in the design scale.`,
            suggestion: `Nearest valid values: ${findNearest(abs, scale)} (use negative)`,
          });
        }
        return;
      }

      // Handle StringLiteral: { marginTop: "18px" }
      if (val.type === "StringLiteral") {
        const str = val.value.trim();

        if (EXEMPT_STRING_VALUES.has(str)) return;
        if (str.endsWith("%")) return;
        // Skip non-px units like em, rem, vh, vw
        if (/[a-z]+$/i.test(str) && !str.endsWith("px")) return;

        const pxVal = parsePxValue(str);
        if (pxVal === null) return;
        if (pxVal === 0) return;

        const absVal = Math.abs(pxVal);
        if (!scaleSet.has(absVal)) {
          violations.push({
            rule: "spacing-scale",
            line: val.loc?.start.line ?? 0,
            column: val.loc?.start.column ?? 0,
            value: str,
            message: `Spacing value ${pxVal}px is not in the design scale.`,
            suggestion: `Nearest valid values: ${findNearest(absVal, scale)}`,
          });
        }
      }
    },
  });

  return violations;
};
