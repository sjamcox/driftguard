import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { validate } from "../src/validator.js";
import type { DesignSystemConfig } from "../src/types.js";
import { readFileSync } from "node:fs";

const fixturesDir = resolve(import.meta.dirname!, "fixtures");

const config: DesignSystemConfig = JSON.parse(
  readFileSync(resolve(fixturesDir, "driftguard.config.json"), "utf-8"),
);

describe("validator", () => {
  it("returns passed:true for valid fixture", () => {
    const result = validate(resolve(fixturesDir, "valid.tsx"), config);
    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
    assert.equal(result.violations.length, 0);
    assert.equal(result.file, "valid.tsx");
  });

  it("returns passed:false with violations for all-violations fixture", () => {
    const result = validate(
      resolve(fixturesDir, "all-violations.tsx"),
      config,
    );
    assert.equal(result.passed, false);
    assert.ok(result.score < 100);
    assert.ok(result.violations.length > 0);
  });

  it("returns passed:true for empty fixture", () => {
    const result = validate(resolve(fixturesDir, "empty.tsx"), config);
    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
  });

  it("returns passed:true for non-JSX files", () => {
    const result = validate(resolve(fixturesDir, "driftguard.config.json"), config);
    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
  });

  it("scores correctly based on violations", () => {
    const result = validate(
      resolve(fixturesDir, "all-violations.tsx"),
      config,
    );
    // Should have violations from all 3 rules
    const rules = new Set(result.violations.map((v) => v.rule));
    assert.ok(rules.has("no-hardcoded-colors"));
    assert.ok(rules.has("spacing-scale"));
    assert.ok(rules.has("use-primitives"));
    // Score should be 100 minus penalties
    assert.ok(result.score >= 0);
    assert.ok(result.score < 100);
  });

  describe("exclude patterns", () => {
    const tmpDir = resolve(fixturesDir, "excluded");

    before(() => {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(
        join(tmpDir, "test.tsx"),
        `export default () => <div onClick={() => {}} style={{ color: "#f00" }}>x</div>;`,
      );
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("skips files matching exclude patterns", () => {
      const result = validate(
        join(tmpDir, "test.tsx"),
        { ...config, exclude: ["excluded/**"] },
        fixturesDir,
      );
      assert.equal(result.passed, true);
    });
  });
});
