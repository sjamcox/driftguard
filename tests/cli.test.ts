import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";

const projectRoot = resolve(import.meta.dirname!, "..");
const fixturesDir = resolve(import.meta.dirname!, "fixtures");
const cli = resolve(projectRoot, "dist/cli.js");

function run(args: string, opts?: { cwd?: string }): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${cli} ${args}`, {
      encoding: "utf-8",
      cwd: opts?.cwd ?? projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  }
}

// Ensure config exists for validate tests
before(() => {
  const configDest = resolve(projectRoot, "driftguard.config.ts");
  if (!existsSync(configDest)) {
    writeFileSync(
      configDest,
      readFileSync(resolve(fixturesDir, "driftguard.config.ts")),
    );
  }
});

describe("CLI validate", () => {
  it("exits 0 for a valid file", () => {
    const { exitCode, stdout } = run(
      `validate ${resolve(fixturesDir, "valid.tsx")}`,
    );
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Score: 100/100"));
  });

  it("exits 1 for a file with violations", () => {
    const { exitCode, stdout } = run(
      `validate ${resolve(fixturesDir, "all-violations.tsx")}`,
    );
    assert.equal(exitCode, 1);
    assert.ok(stdout.includes("no-hardcoded-colors"));
  });

  it("outputs valid JSON with --json flag", () => {
    const { stdout } = run(
      `validate ${resolve(fixturesDir, "all-violations.tsx")} --json`,
    );
    const result = JSON.parse(stdout);
    assert.equal(typeof result.score, "number");
    assert.equal(result.passed, false);
    assert.ok(Array.isArray(result.violations));
  });

  it("exits 0 for empty file", () => {
    const { exitCode } = run(
      `validate ${resolve(fixturesDir, "empty.tsx")}`,
    );
    assert.equal(exitCode, 0);
  });
});

describe("CLI init", () => {
  const tmpDir = resolve(projectRoot, "tmp-init-test");

  before(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates config and settings files", () => {
    const { exitCode, stdout } = run("init", { cwd: tmpDir });
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("driftguard initialized"));
    assert.ok(existsSync(join(tmpDir, "driftguard.config.ts")));
    assert.ok(existsSync(join(tmpDir, ".claude", "settings.json")));

    // Verify the settings contain the hook
    const settings = JSON.parse(
      readFileSync(join(tmpDir, ".claude", "settings.json"), "utf-8"),
    );
    assert.ok(settings.hooks?.PostToolUse?.length > 0);
  });

  it("does not overwrite existing config", () => {
    // Run init again — config should already exist
    const { stdout } = run("init", { cwd: tmpDir });
    assert.ok(stdout.includes("already exists"));
  });
});

describe("CLI generate", () => {
  const tmpDir = resolve(projectRoot, "tmp-generate-test");

  before(() => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "driftguard.config.ts"),
      `export default {
  tokens: {
    colors: { primary: "#0055FF" },
    spacingScale: [4, 8, 16],
  },
  components: {},
  generate: {
    ts: "src/tokens.ts",
    css: "src/tokens.css",
  },
};`,
    );
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates token files", () => {
    const { exitCode } = run("generate", { cwd: tmpDir });
    assert.equal(exitCode, 0);

    // Check TS file
    const tsContent = readFileSync(join(tmpDir, "src", "tokens.ts"), "utf-8");
    assert.ok(tsContent.includes("export const colors"));
    assert.ok(tsContent.includes("#0055FF"));
    assert.ok(tsContent.includes("export const spacing"));

    // Check CSS file
    const cssContent = readFileSync(join(tmpDir, "src", "tokens.css"), "utf-8");
    assert.ok(cssContent.includes("--color-primary"));
    assert.ok(cssContent.includes("--spacing-4"));
  });
});
