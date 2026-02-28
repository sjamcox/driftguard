import { basename, resolve } from "node:path";
import type { DesignSystemConfig, ValidationResult } from "./types.js";
import { findConfigPath, isExcluded, getProjectRoot } from "./config.js";
import { parseFile } from "./parser.js";
import { rules } from "./rules/index.js";
import { computeScore } from "./scorer.js";

const VALID_EXTENSIONS = new Set([".tsx", ".jsx"]);

export function validate(
  filePath: string,
  config: DesignSystemConfig,
  projectRoot?: string,
): ValidationResult {
  const absPath = resolve(filePath);
  const ext = absPath.slice(absPath.lastIndexOf("."));

  if (!VALID_EXTENSIONS.has(ext)) {
    return {
      file: basename(absPath),
      score: 100,
      passed: true,
      violations: [],
    };
  }

  // Check exclude patterns
  let root = projectRoot;
  if (!root) {
    const configPath = findConfigPath();
    if (configPath) {
      root = getProjectRoot(configPath);
    }
  }
  if (root && isExcluded(absPath, config.exclude, root)) {
    return {
      file: basename(absPath),
      score: 100,
      passed: true,
      violations: [],
    };
  }

  const ast = parseFile(absPath);
  const ctx = { config, filePath: absPath };
  const violations = rules.flatMap((rule) => rule.run(ast, ctx));
  const score = computeScore(violations);

  return {
    file: basename(absPath),
    score,
    passed: violations.length === 0,
    violations,
  };
}
