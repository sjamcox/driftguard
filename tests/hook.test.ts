import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const projectRoot = resolve(import.meta.dirname!, "..");
const fixturesDir = resolve(import.meta.dirname!, "fixtures");
const cli = resolve(projectRoot, "dist/cli.js");

// Ensure we have a config in place for the hook
before(() => {
  const configDest = resolve(projectRoot, "driftguard.config.json");
  if (!existsSync(configDest)) {
    const configSrc = resolve(fixturesDir, "driftguard.config.json");
    writeFileSync(configDest, readFileSync(configSrc));
  }
});

function runHook(stdin: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`echo '${stdin.replace(/'/g, "'\\''")}' | node ${cli} hook`, {
      encoding: "utf-8",
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  }
}

describe("hook", () => {
  it("outputs block decision for files with violations", () => {
    const dirtyFile = resolve(fixturesDir, "all-violations.tsx");
    const { stdout, exitCode } = runHook(
      JSON.stringify({ tool_input: { file_path: dirtyFile } }),
    );
    assert.equal(exitCode, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.decision, "block");
    assert.ok(result.reason.includes("DRIFTGUARD"));
  });

  it("outputs nothing for clean files", () => {
    const cleanFile = resolve(fixturesDir, "valid.tsx");
    const { stdout, exitCode } = runHook(
      JSON.stringify({ tool_input: { file_path: cleanFile } }),
    );
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });

  it("exits 0 silently for non-tsx files", () => {
    const { stdout, exitCode } = runHook(
      JSON.stringify({ tool_input: { file_path: "/tmp/foo.ts" } }),
    );
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });

  it("exits 0 silently for missing file_path", () => {
    const { stdout, exitCode } = runHook(JSON.stringify({ tool_input: {} }));
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });

  it("exits 0 silently for nonexistent file", () => {
    const { stdout, exitCode } = runHook(
      JSON.stringify({
        tool_input: { file_path: "/tmp/does-not-exist.tsx" },
      }),
    );
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });

  it("exits 0 silently for invalid JSON", () => {
    const { stdout, exitCode } = runHook("not valid json");
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });
});
