# DriftGuard

> *A deterministic design system compliance engine for AI-generated UI.*
> Because your AI shouldn't be writing `<div onClick>` when you have a Button component.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

You've spent months crafting the perfect design system. Your primitives are pristine. Your tokens are immaculate. Your component API is *chef's kiss*.

Then Claude writes this:

```tsx
<div
  onClick={handleSubmit}
  style={{
    color: "#FF0000",
    marginTop: 18
  }}
>
  Click me
</div>
```

Congratulations. Your beautiful design system just got ignored by a language model that doesn't know (or care) about your carefully considered spacing scale.

## The Solution

DriftGuard is a **static analysis linter** that enforces design system compliance in AI-generated code. It validates your `.tsx`/`.jsx` files against your design tokens and component library, ensuring that every piece of generated UI respects your system.

Think of it as a design system consultant that never sleeps, never compromises, and never lets `#FF0000` slip through code review.

---

## Features

- 🎯 **AST-based validation** — No regex hacks. Real parsing. Real rules.
- 🎨 **Nested color tokens** — Supports `colors.primary.hover` structure. Match your existing design system.
- 📏 **Spacing scale enforcement** — If `18px` isn't in your scale, it's not going in your code.
- 🧩 **Component primitives** — Automatically flag `<div onClick>` and suggest `<Button>`.
- 🔗 **Claude Code integration** — Real-time validation on every file write via PostToolUse hooks.
- 📊 **Compliance scoring** — Quantify drift. Track improvement. Ship with confidence.
- 🎭 **TypeScript-first config** — Declare your existing design tokens with full type safety.
- 🔒 **AI-proof governance** — Prevents AI agents from modifying your design system config.

---

## Installation

```bash
npm install driftguard --save-dev
```

*(Yes, it's a dev dependency. No, you shouldn't ship linters to production. We shouldn't have to explain this.)*

---

## Quick Start

### 1. Initialize

```bash
npx driftguard init
```

This creates:
- `driftguard.config.ts` — Your design system definition
- `.claude/settings.json` — PostToolUse hook configuration

### 2. Configure Your Design System

Edit `driftguard.config.ts` to reference your existing design tokens:

```typescript
import type { DesignSystemConfig } from "driftguard";

const config: DesignSystemConfig = {
  // Exclude your design system primitives from validation
  // (We assume you know what you're doing in here)
  exclude: ["src/components/core/**", "src/design-system/**"],

  tokens: {
    // Nested color definitions. Because flat is for beginners.
    colors: {
      primary: {
        main: "var(--color-primary-main)",
        hover: "var(--color-primary-hover)",
        dark: "var(--color-primary-dark)",
      },
      text: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        tertiary: "var(--color-text-tertiary)",
      },
      background: {
        primary: "var(--color-background-primary)",
        secondary: "var(--color-background-secondary)",
      },
    },

    // Your spacing scale. All of it. No exceptions.
    spacingScale: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
  },

  components: {
    Button: {
      mustUse: true, // Non-negotiable
      replaces: ["div", "span"],
      whenHasProp: ["onClick", "onPress"],
    },
  },
};

export default config;
```

**Important:** The color values in your config should match what you actually use in your codebase. DriftGuard validates against these values — it doesn't generate code for you. You bring your own design tokens.

### 3. Validate Files

```bash
# Validate a single file
npx driftguard validate src/components/LoginForm.tsx

# Get machine-readable output
npx driftguard validate src/components/LoginForm.tsx --json
```

---

## Validation Rules

DriftGuard ships with three opinionated rules. You're welcome.

### `no-hardcoded-colors`

Flags any color value that isn't a design token reference.

❌ **Bad:**
```tsx
<div style={{ color: "#FF0000" }}>Error</div>
<Icon fill="red" />
<Box backgroundColor="rgb(255, 0, 0)" />
```

✅ **Good:**
```tsx
<div style={{ color: colors.text.error }}>Error</div>
<Icon fill={colors.icon.error} />
<Box backgroundColor={colors.background.error} />
```

**Allowed exceptions:**
- `transparent`
- `inherit`
- `currentColor`
- `var(--custom-property)`
- Token references like `colors.primary.main`

### `spacing-scale`

Enforces that all spacing values come from your configured scale.

❌ **Bad:**
```tsx
<div style={{ marginTop: 18, padding: "7px" }} />
```

✅ **Good:**
```tsx
<div style={{ marginTop: spacing[4], padding: spacing[2] }} />
// or
<div style={{ marginTop: 16, padding: 8 }} />
```

**Allowed exceptions:**
- `0` (zero is always allowed)
- `"auto"`
- Percentages (`"50%"`)

### `use-primitives`

Catches attempts to reinvent the wheel with native HTML elements.

❌ **Bad:**
```tsx
<div onClick={handleClick}>Submit</div>
<span onPress={handlePress}>Cancel</span>
<input type="text" />
```

✅ **Good:**
```tsx
<Button onClick={handleClick}>Submit</Button>
<Button onPress={handlePress}>Cancel</Button>
<TextInput type="text" />
```

---

## Claude Code Integration

DriftGuard includes a PostToolUse hook that runs automatically after every file write in Claude Code.

When violations are detected, the hook **blocks** the write and shows you exactly what's wrong:

```
DRIFTGUARD: Design system violations found in LoginForm.tsx

LoginForm.tsx (Score: 70/100) ❌ FAILED

  ⚠ no-hardcoded-colors (line 12, col 23)
    Hardcoded color "#FF0000" is not allowed. Use a design token.
    Value: "#FF0000"
    Suggestion: Use one of: colors.primary.main (var(--color-primary-main)), ...

  ⚠ spacing-scale (line 15, col 18)
    Off-scale spacing value 18. Use a value from your spacing scale.
    Value: "18"
    Suggestion: Nearest values: 16, 24

  ⚠ use-primitives (line 8, col 5)
    <div onClick> should be replaced with <Button>.
    Value: <div onClick>
    Suggestion: Replace with <Button>
```

Fix the violations, and the write succeeds. **No compromises.**

---

## CLI Reference

### `init`

Initialize DriftGuard in your project.

```bash
npx driftguard init
```

Creates `driftguard.config.ts` and configures `.claude/settings.json`.

### `validate <file>`

Validate a single file against your design system.

```bash
npx driftguard validate src/App.tsx
npx driftguard validate src/App.tsx --json
```

**Exit codes:**
- `0` — File passes validation
- `1` — File has violations

### `hook`

PostToolUse hook for Claude Code. Not for manual use.

```bash
npx driftguard hook
```

This command reads from `stdin` and writes JSON to `stdout`. It's designed to be called by Claude Code's hook system, not humans.

---

## Configuration Reference

### `DesignSystemConfig`

```typescript
interface DesignSystemConfig {
  // Files to exclude from validation (e.g., your design system source)
  exclude?: string[];

  tokens: {
    // Nested color definitions that match your existing tokens
    colors: Record<string, ColorValue>;

    // Spacing scale (in pixels) that match your existing scale
    spacingScale: number[];
  };

  // Component replacement rules
  components: Record<string, ComponentSpec>;
}
```

### `ColorValue`

Colors can be flat or nested to any depth:

```typescript
type ColorValue = string | { [key: string]: ColorValue };

// Examples:
colors: {
  background: "#FFFFFF",  // Flat

  primary: {              // Nested
    main: "#0055FF",
    hover: "#0044DD",
  },

  text: {                 // Deeply nested
    primary: {
      light: "#111111",
      dark: "#FFFFFF",
    },
  },
}
```

### `ComponentSpec`

Define which native elements should be replaced with your primitives:

```typescript
interface ComponentSpec {
  // Enforce this rule?
  mustUse: boolean;

  // Which HTML elements does this replace?
  replaces: string[];

  // When do we enforce the replacement?
  // (Props that indicate this component should be used)
  whenHasProp: Array<string | PropMatch>;
}

interface PropMatch {
  prop: string;
  value: string;
}

// Example:
Button: {
  mustUse: true,
  replaces: ["div", "span", "a"],
  whenHasProp: ["onClick", "onPress"], // Any of these props triggers the rule
}

TextInput: {
  mustUse: true,
  replaces: ["input"],
  whenHasProp: [
    { prop: "type", value: "text" },  // Specific prop/value combination
    { prop: "type", value: "email" },
  ],
}
```

---

## Protected Files

**IMPORTANT:** DriftGuard prevents AI agents from modifying your design system source code.

### What's Protected

All files in your `exclude` patterns are **protected from AI edits**, plus the config file itself:

1. **`driftguard.config.ts`** — Your design system configuration
2. **Any files matching `exclude` patterns** — Your design system source (primitives, tokens, etc.)

**Default protected paths:**
```typescript
exclude: [
  "src/components/core/**",    // Your design system primitives
  "src/design-system/**",       // Your design system source
]
```

### How Protection Works

If an AI agent attempts to write to a protected file, the PostToolUse hook **blocks the write**:

**For config file:**
```
DRIFTGUARD: Cannot edit driftguard.config.ts

This file is protected from AI modifications to enforce design system governance.

Only humans should modify the design system source of truth.
```

**For excluded files:**
```
DRIFTGUARD: Cannot edit Button.tsx

This file is in your exclude list and protected from AI modifications.

Excluded files are typically design system source code (primitives, tokens, etc.)
that should only be modified by humans.

Files matching these patterns are protected:
  - src/components/core/**
  - src/design-system/**
```

### Why This Matters

Without this protection, AI agents can "solve" validation errors by adding tokens to your design system instead of using existing ones. This defeats the entire purpose of having a constraint system.

**Example of what we prevent:**
```tsx
// AI writes this code:
<div style={{ color: "#FF69B4" }}>Hot pink text</div>

// DriftGuard flags it as a violation

// Without protection, AI might:
// 1. Edit driftguard.config.ts
// 2. Add hotPink: "#FF69B4" to colors
// 3. Problem "solved" 🙃

// With protection, AI must:
// 1. Ask user which existing token to use
// 2. Use colors.accent.main or colors.error.main
// 3. Design system remains coherent ✅
```

### Expanding Your Design System

Only humans should add tokens. When you need to add a color or spacing value:

1. **Edit `driftguard.config.ts`** manually
2. **Commit the change**
3. The AI will have access to the new token on the next validation run

Your design system evolves intentionally, not accidentally

---

## Philosophy

### On Design Systems

A design system is not a component library. It's not a style guide. It's not a Figma file.

A design system is a **constraint system** — a set of carefully considered decisions that make the 10,000 micro-decisions that follow *trivial*.

When you define `spacing[4] = 16px`, you're not just picking a number. You're eliminating an entire class of bikeshedding. You're ensuring visual consistency. You're making future code reviews 10x faster because "should this be 16px or 18px?" is no longer a question — it's `spacing[4]`, and we're done.

### On AI-Generated Code

LLMs are incredible at writing code. They're terrible at **respecting constraints they've never seen**.

Claude doesn't know your spacing scale. ChatGPT doesn't care about your Button component. They'll happily write `<div onClick>` with `marginTop: 17px` and move on with their day.

DriftGuard exists because **deterministic validation** is the only way to ensure AI-generated code respects your design system. No amount of prompting will match the reliability of AST-based linting.

### On Compromises

We don't make them.

If your design system says 18px isn't in the scale, then 18px doesn't go in the code. If your design system says `<div onClick>` should be a `<Button>`, then it should be a `<Button>`.

And your design system primitives? **Protected.** AI agents can use them, but they can't modify them. That's what the `exclude` list is for.

"But what if we just—"
No.

"In this one case—"
No.

"It's only one pixel—"
**No.**

Design systems work because they're **consistent**. The moment you start making exceptions, you stop having a system and start having a suggestion box.

---

## FAQ

**Q: Can I disable specific rules?**
A: Not currently. If a rule doesn't apply to your project, don't configure it. The `use-primitives` rule only runs on components you define. The color and spacing rules only run if you have colors and a spacing scale configured.

If you need more control, fork it. We're MIT licensed for a reason.

**Q: Why TypeScript config instead of JSON?**
A: Type safety, IDE autocomplete, and the ability to import/export values. Also because it's 2025 and dynamic configuration beats static files.

**Q: Does this work with Tailwind/CSS-in-JS/inline styles?**
A: DriftGuard validates the AST of your JSX. It catches hardcoded colors and off-scale spacing in inline `style` objects and JSX attributes. It doesn't parse Tailwind classes or CSS files.

If you're using Tailwind's arbitrary values (`mt-[17px]`), you're on your own. We can't save everyone.

**Q: What if my design system uses `rem` instead of `px`?**
A: The spacing scale is unitless. If your scale is `[0.25, 0.5, 1, 1.5, 2]` and you use `rem`, configure it that way. DriftGuard compares numeric values — it doesn't care about units.

**Q: Can I use this outside of Claude Code?**
A: Yes. The `validate` command works in any CI/CD pipeline, pre-commit hook, or npm script. The Claude Code integration is just a convenient real-time hook.

**Q: This seems opinionated.**
A: That's not a question, but you're absolutely right. Design systems are inherently opinionated. DriftGuard matches that energy.

---

## Contributing

Found a bug? Have a feature request? PRs welcome.

Please ensure:
- All tests pass (`npm test`)
- Code follows existing style
- You've run the linter on your changes (`npx driftguard validate`)

*(Yes, we lint our linter. We're not hypocrites.)*

---

## License

MIT © 2025

Build better design systems. Ship cleaner code. Accept no compromises.

**DriftGuard** — *Because your design system deserves better.*
