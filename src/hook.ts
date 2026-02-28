import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadConfig, findConfigPath, getProjectRoot } from "./config.js";
import { validate } from "./validator.js";
import { formatHuman } from "./format.js";

const VALID_EXTENSIONS = [".tsx", ".jsx"];

function hasValidExtension(filePath: string): boolean {
  return VALID_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function isProtectedFile(filePath: string, projectRoot: string): boolean {
  const absPath = resolve(filePath);
  const configPath = resolve(projectRoot, "driftguard.config.ts");

  // Block writes to config file
  return absPath === configPath;
}

export async function runHook(): Promise<void> {
  try {
    // Read all stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf-8").trim();

    if (!raw) {
      return;
    }

    let input: any;
    try {
      input = JSON.parse(raw);
    } catch {
      console.error("driftguard hook: invalid JSON on stdin");
      return;
    }

    const filePath: string | undefined = input?.tool_input?.file_path;

    if (!filePath || typeof filePath !== "string") {
      return;
    }

    let config;
    let projectRoot: string;
    try {
      config = await loadConfig();
      const configPath = findConfigPath();
      if (!configPath) {
        return;
      }
      projectRoot = getProjectRoot(configPath);
    } catch (err) {
      console.error(`driftguard hook: ${(err as Error).message}`);
      return;
    }

    // Block writes to protected files (config)
    if (isProtectedFile(filePath, projectRoot)) {
      const fileName = basename(filePath);
      const decision = {
        decision: "block",
        reason: `DRIFTGUARD: Cannot edit ${fileName}

This file is protected from AI modifications to enforce design system governance.

Only humans should modify the design system source of truth.

If you need to add a token, ask the user to edit driftguard.config.ts manually.`,
      };
      process.stdout.write(JSON.stringify(decision));
      return;
    }

    if (!hasValidExtension(filePath)) {
      return;
    }

    if (!existsSync(filePath)) {
      return;
    }

    const result = validate(filePath, config);

    if (result.passed) {
      return;
    }

    // Output block decision
    const report = formatHuman(result);
    const decision = {
      decision: "block",
      reason: `DRIFTGUARD: Design system violations found in ${basename(filePath)}\n\n${report}`,
    };

    process.stdout.write(JSON.stringify(decision));
  } catch (err) {
    console.error(`driftguard hook: unexpected error: ${(err as Error).message}`);
  }
}
