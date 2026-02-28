import type { Node } from "@babel/types";
import type { TraverseOptions } from "@babel/traverse";
import type { BabelAST, Rule, RuleContext, Violation, ColorValue } from "../types.js";

// @babel/traverse CJS interop — runtime default may be nested
import _traverse from "@babel/traverse";
const traverse: (node: Node, opts: TraverseOptions) => void = (
  typeof (_traverse as any).default === "function"
    ? (_traverse as any).default
    : _traverse
);

const COLOR_PROPS = new Set([
  "color",
  "backgroundColor",
  "background",
  "borderColor",
  "fill",
  "stroke",
  "outline",
  "boxShadow",
]);

const NAMED_COLORS = new Set([
  "red", "blue", "green", "black", "white", "gray", "grey",
  "yellow", "orange", "purple", "pink", "brown", "navy", "teal",
  "cyan", "magenta", "lime", "indigo", "violet", "gold", "silver",
]);

const EXEMPT_VALUES = new Set(["transparent", "inherit", "currentColor"]);

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\s*\(/i;
const HSL_RE = /^hsla?\s*\(/i;

function isHardcodedColor(value: string): boolean {
  const trimmed = value.trim();

  if (EXEMPT_VALUES.has(trimmed)) return false;
  if (trimmed.startsWith("var(--")) return false;
  if (trimmed.includes(".")) return false; // token reference like colors.primary

  if (HEX_RE.test(trimmed)) return true;
  if (RGB_RE.test(trimmed)) return true;
  if (HSL_RE.test(trimmed)) return true;
  if (NAMED_COLORS.has(trimmed.toLowerCase())) return true;

  return false;
}

function flattenColorPaths(
  colors: Record<string, ColorValue>,
  prefix = "colors",
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(colors)) {
    const path = `${prefix}.${key}`;
    if (typeof value === "string") {
      paths.push(`${path} (${value})`);
    } else {
      paths.push(...flattenColorPaths(value, path));
    }
  }

  return paths;
}

function buildSuggestion(ctx: RuleContext): string {
  const paths = flattenColorPaths(ctx.config.tokens.colors);
  const preview = paths.slice(0, 3).join(", ");
  return paths.length > 3
    ? `Use one of: ${preview}, ... (${paths.length} total)`
    : `Use one of: ${preview}`;
}

export const noHardcodedColors: Rule = (ast: BabelAST, ctx: RuleContext): Violation[] => {
  const violations: Violation[] = [];
  const suggestion = buildSuggestion(ctx);

  traverse(ast, {
    // Check style object properties: style={{ color: "#fff" }}
    ObjectProperty(path) {
      if (path.node.computed) return;

      const key = path.node.key;
      let propName: string | null = null;
      if (key.type === "Identifier") {
        propName = key.name;
      } else if (key.type === "StringLiteral") {
        propName = key.value;
      }

      if (!propName || !COLOR_PROPS.has(propName)) return;

      const val = path.node.value;
      if (val.type === "StringLiteral" && isHardcodedColor(val.value)) {
        violations.push({
          rule: "no-hardcoded-colors",
          line: val.loc?.start.line ?? 0,
          column: val.loc?.start.column ?? 0,
          value: val.value,
          message: `Hardcoded color "${val.value}" is not allowed. Use a design token.`,
          suggestion,
        });
      }
    },

    // Check JSX attributes: <Foo color="#fff" />
    JSXAttribute(path) {
      const attrName = path.node.name;
      if (attrName.type !== "JSXIdentifier") return;

      const name = attrName.name;
      if (!COLOR_PROPS.has(name)) return;

      const val = path.node.value;
      if (!val) return;

      if (val.type === "StringLiteral" && isHardcodedColor(val.value)) {
        violations.push({
          rule: "no-hardcoded-colors",
          line: val.loc?.start.line ?? 0,
          column: val.loc?.start.column ?? 0,
          value: val.value,
          message: `Hardcoded color "${val.value}" is not allowed. Use a design token.`,
          suggestion,
        });
      }
    },
  });

  return violations;
};
