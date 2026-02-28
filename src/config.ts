import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";
import picomatch from "picomatch";
import type { DesignSystemConfig } from "./types.js";

const CONFIG_FILENAME = "driftguard.config.ts";

export function findConfigPath(startDir?: string): string | null {
  let dir = resolve(startDir ?? process.cwd());

  while (true) {
    const candidate = resolve(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export async function loadConfig(startDir?: string): Promise<DesignSystemConfig> {
  const configPath = findConfigPath(startDir);
  if (!configPath) {
    throw new Error(
      `Could not find ${CONFIG_FILENAME}. Run "driftguard init" to create one.`,
    );
  }

  const configUrl = pathToFileURL(configPath).href;
  const module = await import(configUrl);
  const raw = (module.default || module) as Record<string, unknown>;

  // Validate required structure
  if (!raw.tokens || typeof raw.tokens !== "object") {
    throw new Error(`${CONFIG_FILENAME}: missing "tokens" object`);
  }

  const tokens = raw.tokens as Record<string, unknown>;

  if (!tokens.colors || typeof tokens.colors !== "object") {
    throw new Error(`${CONFIG_FILENAME}: missing "tokens.colors" object`);
  }

  if (!Array.isArray(tokens.spacingScale)) {
    throw new Error(`${CONFIG_FILENAME}: missing "tokens.spacingScale" array`);
  }

  if (!raw.components || typeof raw.components !== "object") {
    throw new Error(`${CONFIG_FILENAME}: missing "components" object`);
  }

  return raw as unknown as DesignSystemConfig;
}

export function getProjectRoot(configPath: string): string {
  return dirname(configPath);
}

export function isExcluded(
  filePath: string,
  excludePatterns: string[] | undefined,
  projectRoot: string,
): boolean {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false;
  }

  const rel = relative(projectRoot, resolve(filePath)).split("\\").join("/");
  const isMatch = picomatch(excludePatterns);
  return isMatch(rel);
}
