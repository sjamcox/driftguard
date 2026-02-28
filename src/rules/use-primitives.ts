import type { Node } from "@babel/types";
import type { TraverseOptions } from "@babel/traverse";
import type { BabelAST, Rule, RuleContext, Violation, PropMatch } from "../types.js";

import _traverse from "@babel/traverse";
const traverse: (node: Node, opts: TraverseOptions) => void = (
  typeof (_traverse as any).default === "function"
    ? (_traverse as any).default
    : _traverse
);

function isPropMatch(entry: string | PropMatch): entry is PropMatch {
  return typeof entry === "object" && "prop" in entry && "value" in entry;
}

export const usePrimitives: Rule = (ast: BabelAST, ctx: RuleContext): Violation[] => {
  const violations: Violation[] = [];
  const { components } = ctx.config;

  // Build lookup: tag -> [{ componentName, whenHasProp }]
  const tagRules: Map<
    string,
    Array<{ componentName: string; whenHasProp: Array<string | PropMatch> }>
  > = new Map();

  for (const [compName, spec] of Object.entries(components)) {
    if (!spec.mustUse) continue;
    for (const tag of spec.replaces) {
      if (!tagRules.has(tag)) {
        tagRules.set(tag, []);
      }
      tagRules.get(tag)!.push({
        componentName: compName,
        whenHasProp: spec.whenHasProp,
      });
    }
  }

  traverse(ast, {
    JSXOpeningElement(path) {
      const nameNode = path.node.name;

      // Only check plain JSX identifiers (lowercase = HTML tags)
      if (nameNode.type !== "JSXIdentifier") return;

      const tagName = nameNode.name;

      // Skip if tag starts with uppercase (it's a component already)
      if (tagName[0] >= "A" && tagName[0] <= "Z") return;

      const rules = tagRules.get(tagName);
      if (!rules) return;

      // Gather the element's attributes
      const attrs = path.node.attributes;
      const attrMap = new Map<string, string | true>();
      for (const attr of attrs) {
        if (attr.type !== "JSXAttribute") continue;
        if (attr.name.type !== "JSXIdentifier") continue;
        const name = attr.name.name;
        const val = attr.value;
        if (!val) {
          attrMap.set(name, true); // boolean prop
        } else if (val.type === "StringLiteral") {
          attrMap.set(name, val.value);
        } else {
          attrMap.set(name, true); // expression — just track presence
        }
      }

      for (const rule of rules) {
        let matches = false;

        if (rule.whenHasProp.length === 0) {
          // Empty array = always flag
          matches = true;
        } else {
          // Check if at least one whenHasProp entry is satisfied
          for (const entry of rule.whenHasProp) {
            if (typeof entry === "string") {
              if (attrMap.has(entry)) {
                matches = true;
                break;
              }
            } else if (isPropMatch(entry)) {
              const attrVal = attrMap.get(entry.prop);
              if (attrVal === entry.value) {
                matches = true;
                break;
              }
            }
          }
        }

        if (matches) {
          const propsDesc = attrMap.size > 0
            ? ` ${[...attrMap.keys()].map((k) => `${k}`).join(" ")}`
            : "";
          violations.push({
            rule: "use-primitives",
            line: nameNode.loc?.start.line ?? 0,
            column: nameNode.loc?.start.column ?? 0,
            value: `<${tagName}${propsDesc}>`,
            message: `<${tagName}> should be replaced with <${rule.componentName}>.`,
            suggestion: `Replace with <${rule.componentName}>`,
          });
        }
      }
    },
  });

  return violations;
};
