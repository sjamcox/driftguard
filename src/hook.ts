import { existsSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig } from "./config.js";
import { validate } from "./validator.js";
import { formatHuman } from "./format.js";

const VALID_EXTENSIONS = [".tsx", ".jsx"];

function hasValidExtension(filePath: string): boolean {
  return VALID_EXTENSIONS.some((ext) => filePath.endsWith(ext));
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

    if (!hasValidExtension(filePath)) {
      return;
    }

    if (!existsSync(filePath)) {
      return;
    }

    let config;
    try {
      config = loadConfig();
    } catch (err) {
      console.error(`driftguard hook: ${(err as Error).message}`);
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
