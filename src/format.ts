import type { ValidationResult } from "./types.js";

export function formatHuman(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push(`driftguard — ${result.file}`);
  lines.push("");

  if (result.violations.length === 0) {
    lines.push("  No violations found.");
  } else {
    // Find the longest rule name for alignment
    const maxRuleLen = Math.max(
      ...result.violations.map((v) => v.rule.length),
    );

    for (const v of result.violations) {
      const rulePad = v.rule.padEnd(maxRuleLen);
      const suggestion = v.suggestion ? ` — ${v.suggestion}` : "";
      lines.push(
        `  \u2717 ${rulePad}  line ${v.line}  ${v.value}${suggestion}`,
      );
    }
  }

  lines.push("");
  lines.push(
    `  Score: ${result.score}/100  (${result.violations.length} violation${result.violations.length !== 1 ? "s" : ""})`,
  );

  return lines.join("\n");
}

export function formatJSON(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}
