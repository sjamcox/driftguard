import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@babel/parser";
import { noHardcodedColors } from "../src/rules/no-hardcoded-colors.js";
import { spacingScale } from "../src/rules/spacing-scale.js";
import { usePrimitives } from "../src/rules/use-primitives.js";
import type { DesignSystemConfig, RuleContext } from "../src/types.js";
import fixtureConfig from "./fixtures/driftguard.config.js";

const fixturesDir = resolve(import.meta.dirname!, "fixtures");
const config: DesignSystemConfig = fixtureConfig;

function parseCode(code: string) {
  return parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
  });
}

function parseFixture(name: string) {
  const code = readFileSync(resolve(fixturesDir, name), "utf-8");
  return parseCode(code);
}

function makeCtx(filePath = "test.tsx"): RuleContext {
  return { config, filePath };
}

// === no-hardcoded-colors ===

describe("no-hardcoded-colors", () => {
  it("flags hex colors in style objects", () => {
    const ast = parseCode(
      `const x = <div style={{ color: "#FF0000" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.equal(violations[0].value, "#FF0000");
  });

  it("flags rgb() colors", () => {
    const ast = parseCode(
      `const x = <div style={{ backgroundColor: "rgb(0, 0, 255)" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.match(violations[0].value, /rgb/);
  });

  it("flags hsl() colors", () => {
    const ast = parseCode(
      `const x = <div style={{ color: "hsl(210, 100%, 50%)" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 1);
  });

  it("flags named colors", () => {
    const ast = parseCode(
      `const x = <div style={{ fill: "red" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.equal(violations[0].value, "red");
  });

  it("flags hex color in JSX attribute", () => {
    const ast = parseCode(`const x = <Icon color="#fff" />;`);
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 1);
  });

  it("does not flag transparent", () => {
    const ast = parseCode(
      `const x = <div style={{ backgroundColor: "transparent" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag inherit", () => {
    const ast = parseCode(
      `const x = <div style={{ color: "inherit" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag CSS variables", () => {
    const ast = parseCode(
      `const x = <div style={{ color: "var(--color-primary)" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag token references with dots", () => {
    const ast = parseCode(
      `const x = <div style={{ color: "colors.primary" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag non-color properties", () => {
    const ast = parseCode(
      `const x = <div style={{ display: "#FF0000" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("skips computed properties", () => {
    const ast = parseCode(
      `const prop = "color"; const x = <div style={{ [prop]: "#FF0000" }} />;`,
    );
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("returns no violations for valid fixture", () => {
    const ast = parseFixture("valid.tsx");
    const violations = noHardcodedColors(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("returns violations for all-violations fixture", () => {
    const ast = parseFixture("all-violations.tsx");
    const violations = noHardcodedColors(ast, makeCtx());
    assert.ok(violations.length >= 3); // #FF0000, rgb(...), "red"
  });
});

// === spacing-scale ===

describe("spacing-scale", () => {
  it("flags off-scale numeric values", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: 18 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.equal(violations[0].value, "18");
  });

  it("flags off-scale string px values", () => {
    const ast = parseCode(
      `const x = <div style={{ marginLeft: "7px" }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.equal(violations[0].value, "7px");
  });

  it("allows values in the scale", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: 16, padding: 8 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("allows zero", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: 0 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("allows auto", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: "auto" }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("allows percentage values", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: "50%" }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("handles negative values (UnaryExpression)", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: -18 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.equal(violations[0].value, "-18");
  });

  it("allows negative values in scale", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: -16 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag non-spacing properties", () => {
    const ast = parseCode(
      `const x = <div style={{ width: 18 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("suggests nearest values", () => {
    const ast = parseCode(
      `const x = <div style={{ marginTop: 18 }} />;`,
    );
    const violations = spacingScale(ast, makeCtx());
    assert.ok(violations[0].suggestion?.includes("16"));
  });

  it("returns violations for all-violations fixture", () => {
    const ast = parseFixture("all-violations.tsx");
    const violations = spacingScale(ast, makeCtx());
    assert.ok(violations.length >= 2); // 18, 13, 7px
  });
});

// === use-primitives ===

describe("use-primitives", () => {
  it("flags div with onClick (should use Button)", () => {
    const ast = parseCode(
      `const x = <div onClick={() => {}} />;`,
    );
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /Button/);
  });

  it("flags span with onPress (should use Button)", () => {
    const ast = parseCode(
      `const x = <span onPress={() => {}} />;`,
    );
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /Button/);
  });

  it("flags input type=text (should use TextInput)", () => {
    const ast = parseCode(`const x = <input type="text" />;`);
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /TextInput/);
  });

  it("does not flag input type=checkbox", () => {
    const ast = parseCode(`const x = <input type="checkbox" />;`);
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag div without onClick", () => {
    const ast = parseCode(
      `const x = <div className="container" />;`,
    );
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag components (uppercase)", () => {
    const ast = parseCode(
      `const x = <Button onClick={() => {}} />;`,
    );
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("does not flag member expressions (Foo.Bar)", () => {
    const ast = parseCode(
      `const x = <Foo.Bar onClick={() => {}} />;`,
    );
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 0);
  });

  it("returns violations for all-violations fixture", () => {
    const ast = parseFixture("all-violations.tsx");
    const violations = usePrimitives(ast, makeCtx());
    assert.ok(violations.length >= 2); // div with onClick, span with onPress, input type=text
  });

  it("returns no violations for valid fixture", () => {
    const ast = parseFixture("valid.tsx");
    const violations = usePrimitives(ast, makeCtx());
    assert.equal(violations.length, 0);
  });
});
