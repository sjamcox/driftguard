# driftguard — Engineering Spec

## Vision

`driftguard` is a design-system-aware compliance engine for AI-generated frontend code. As AI tools like Claude Code increasingly write UI components, teams face a new class of problem: AI produces *mostly correct* UI, but not *design-system-compliant* UI.

`driftguard` inserts a deterministic validation layer between AI generation and production code. It enforces compliance automatically — not by prompting AI to "try harder," but by running a deterministic validator that AI cannot influence or skip.

**Core loop:**
```
Claude writes a .tsx file
  → PostToolUse hook fires automatically
  → driftguard validates the file against the design system spec
  → violations found → hook returns structured feedback to Claude
  → Claude Code automatically prompts Claude to fix violations
  → Claude rewrites the file
  → hook fires again
  → clean → loop ends
```

**Core philosophy:** AI is probabilistic. Design systems require guarantees. `driftguard` is the deterministic layer on top of probabilistic generation.

---

## What It Is / What It Is Not

**Is:**
- A deterministic compliance engine
- A Claude Code integration that enforces design system rules on every file write
- A shareable npm CLI that teams commit to their repos

**Is not:**
- A generic linter
- An ESLint plugin
- A Figma integration
- A design dashboard
- A wrapper around Claude
- An AI tool — there is no AI in the validator

---

## Distribution Model

`driftguard` is an npm CLI package. Teams install it and run `driftguard init` in their repo. The init command writes two files:

1. `driftguard.config.json` — the design system spec (owned by the design system team)
2. `.claude/settings.json` — Claude Code project-level hook configuration

Both files are committed to the repo. Every developer who clones the repo and uses Claude Code automatically gets enforcement. No per-developer setup required. This is the `.eslintrc` model applied to AI compliance.

```bash
npm install -g driftguard
driftguard init
git add driftguard.config.json .claude/settings.json
git commit -m "add driftguard design system enforcement"
```

---

## MVP Scope

Build exactly these five things:

1. A deterministic AST-based validator CLI
2. An `init` command that scaffolds project config
3. A Claude Code `PostToolUse` hook integration
4. Three enforcement rules (see below)
5. A `generate` command that outputs usable token files from the config

Do not build: ESLint plugin, Figma integration, org dashboards, multi-file analysis, accessibility scanning, CI integration, MCP server.

---

## Architecture

### 1. Design System Config (`driftguard.config.json`)

The source of truth for validation. Committed to the repo by the design system team.

```json
{
  "exclude": ["src/components/**", "src/design-system/**"],
  "tokens": {
    "colors": {
      "primary": "#0055FF",
      "secondary": "#6B7280",
      "text": "#111111",
      "background": "#FFFFFF"
    },
    "spacingScale": [4, 8, 12, 16, 24, 32, 48, 64]
  },
  "components": {
    "Button": {
      "mustUse": true,
      "replaces": ["div", "span"],
      "whenHasProp": ["onClick", "onPress"]
    },
    "TextInput": {
      "mustUse": true,
      "replaces": ["input"],
      "whenHasProp": [{ "prop": "type", "value": "text" }]
    },
    "Card": {
      "mustUse": true,
      "replaces": ["div"],
      "whenHasProp": []
    }
  }
}
```

**`exclude`** — an optional array of glob patterns (relative to the project root) for paths that should be skipped entirely. Use this to exempt design system source files from enforcement — the one place where raw `<button>` and `<div>` elements legitimately belong. Patterns follow standard glob syntax (`**` for recursive match, `*` for single segment).

`components` is the registry of design system primitives the team has built. Each entry describes:
- `mustUse` — if true, the rule will enforce usage of this component
- `replaces` — raw HTML tags that should be replaced by this component
- `whenHasProp` — the rule only fires when the raw element satisfies at least one entry; empty array means always enforce

**This is the mechanism for component enforcement.** If your design system has no `Button`, don't add it. If you have `PrimaryButton`, `IconButton`, and `LinkButton`, add all three. The validator only enforces what is explicitly declared here.

Config is loaded from `driftguard.config.json` in the current working directory, walking up to the project root if not found. If no config exists, validator exits with a clear error message.

---

### 2. Validator (AST-based, no AI)

**Tech:** `@babel/parser` + `@babel/traverse` for JSX/TSX AST parsing. No TypeScript compiler dependency required. Pure static analysis — fast and deterministic.

**Command:**
```bash
driftguard validate ./src/Button.tsx
driftguard validate ./src/Button.tsx --json
```

The validator:
1. Parses the file into an AST
2. Runs each rule against the AST
3. Collects violations
4. Computes a compliance score
5. Outputs a human-readable report (default) or JSON (with `--json`)

**Human-readable output:**
```
driftguard — Button.tsx

  ✗ no-hardcoded-colors  line 12  "#1A1A1A" — use a color token instead
  ✗ spacing-scale        line 15  marginTop: 18 — 18 is not in scale [4,8,12,16,24,32]
  ✗ use-primitives       line 8   <div onClick=...> — use <Button> instead

  Score: 40/100  (3 violations)
```

**JSON output:**
```json
{
  "file": "Button.tsx",
  "score": 40,
  "passed": false,
  "violations": [
    {
      "rule": "no-hardcoded-colors",
      "line": 12,
      "column": 18,
      "value": "#1A1A1A",
      "message": "Hardcoded color \"#1A1A1A\" is not allowed. Use a design token.",
      "suggestion": "Use one of: colors.primary (#0055FF), colors.text (#111111)"
    },
    {
      "rule": "spacing-scale",
      "line": 15,
      "column": 22,
      "value": "18",
      "message": "Spacing value 18px is not in the design scale.",
      "suggestion": "Nearest valid values: 16 or 24"
    },
    {
      "rule": "use-primitives",
      "line": 8,
      "column": 4,
      "value": "<div onClick>",
      "message": "Clickable <div> detected. Use the canonical <Button> component.",
      "suggestion": "Replace with <Button onClick={...}>"
    }
  ]
}
```

---

### 3. Validation Rules (MVP)

#### Rule 1: `no-hardcoded-colors`

**Detects:** Literal color values in JSX props and inline style objects.

**Patterns to flag:**
- Hex: `#fff`, `#ffffff`, `#FFFFFF`, `#fff8` (with alpha)
- RGB/RGBA: `rgb(0, 0, 0)`, `rgba(0, 0, 0, 0.5)`
- HSL/HSLA: `hsl(210, 100%, 50%)`, `hsla(...)`
- Named colors: `"red"`, `"blue"`, `"black"`, `"white"` (flag common ones — see list below)

**AST nodes to inspect:**
- `StringLiteral` values inside `JSXAttribute` (e.g. `color="#fff"`)
- `StringLiteral` values inside `ObjectExpression` for properties named: `color`, `backgroundColor`, `background`, `borderColor`, `fill`, `stroke`, `outline`, `boxShadow`
- Template literals in the same contexts

**Named colors to flag:** `red`, `blue`, `green`, `black`, `white`, `gray`, `grey`, `yellow`, `orange`, `purple`, `pink`, `brown`, `navy`, `teal`, `cyan`, `magenta`, `lime`, `indigo`, `violet`, `gold`, `silver`

**Does not flag:**
- Token variable references: `colors.primary`, `theme.colors.text`
- CSS variable references: `var(--color-primary)`
- `transparent`, `inherit`, `currentColor`

**Penalty: 15 points per violation**

---

#### Rule 2: `spacing-scale`

**Detects:** Pixel spacing values that are not in the design scale defined in config.

**Patterns to flag:**
- Numeric `px` values in style objects for spacing properties: `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `gap`, `rowGap`, `columnGap`, `top`, `right`, `bottom`, `left`
- Numeric literals (bare numbers treated as px in React inline styles) for the same properties
- String values like `"18px"` for the same properties

**AST nodes to inspect:**
- `ObjectExpression` properties inside JSX `style` attribute
- Check property key name against the spacing property list
- Extract numeric value from `NumericLiteral` or string like `"18px"`

**Does not flag:**
- Values in the scale (e.g. `16`, `"16px"` when 16 is in scale)
- Percentage values: `"50%"`
- `auto`, `inherit`, `0` (zero is always valid)
- Values used in `width`/`height` (not spacing, skip these for MVP)

**Suggestion logic:** find the closest value in the scale (nearest neighbor).

**Penalty: 10 points per violation**

---

#### Rule 3: `use-primitives`

**Detects:** Raw HTML elements that should be replaced by a design system component, as declared in `driftguard.config.json`.

**This rule is entirely config-driven.** It does not hardcode any component names or tag names. It reads `config.components`, filters to entries where `mustUse: true`, and for each one checks whether a `replaces` tag with a matching `whenHasProp` prop appears in the JSX.

**Algorithm:**
```
for each component in config.components where mustUse === true:
  for each tag in component.replaces:
    find all JSXOpeningElements with that tag name
    if component.whenHasProp is empty:
      flag every instance
    else:
      flag instances where at least one whenHasProp entry is satisfied:
        string entry   → element has a prop with that name
        PropMatch entry → element has a prop with that name AND that value
    violation message names the specific component to use instead
```

**Example — Button replaces div/span when onClick present (string match):**
- `<div onClick={...}>` → violation: use `<Button>`
- `<div>` with no onClick → no violation

**Example — TextInput replaces input when type="text" (value match):**
- `<input type="text" />` → violation: use `<TextInput>`
- `<input type="checkbox" />` → no violation

**Example — Card replaces div with no prop condition (always enforce):**
- Every `<div>` → violation: use `<Card>`
- (Use `whenHasProp: []` carefully — it flags all instances of the tag)

**AST nodes to inspect:**
- `JSXOpeningElement` — check `name.name` against `component.replaces`
- `JSXAttribute` list — check `name.name` against `component.whenHasProp`

**Does not flag:**
- Elements already using a registered component name (e.g. `<Button>`, `<Card>`)
- Native semantic elements: `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`
- Elements where no config entry matches the tag + prop combination

**Penalty: 20 points per violation**

---

### 4. Scoring Formula

```
Base score: 100

Penalties:
  no-hardcoded-colors:  15 points per violation
  spacing-scale:        10 points per violation
  use-primitives:       20 points per violation

Final score: max(0, 100 - sum of all penalties)
passed: violations.length === 0
```

Note: `passed` is strict — score 100 with 0 violations. A score of 90 with 1 violation is NOT passed. The validator is a gate, not a grader.

---

### 5. Claude Code Hook Integration

#### How it works

Claude Code supports project-level hooks defined in `.claude/settings.json`. A `PostToolUse` hook fires automatically after Claude uses the `Write` or `Edit` tools. The hook receives event context as JSON on stdin.

When the hook returns a block decision, Claude Code feeds the reason directly to Claude as context — triggering automatic self-correction without user intervention. Claude rewrites the file, the hook fires again, and the loop continues until the file passes.

#### `.claude/settings.json` (written by `driftguard init`)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx driftguard hook"
          }
        ]
      }
    ]
  }
}
```

If `.claude/settings.json` already exists, `init` merges the hook into the existing file rather than overwriting it.

#### `driftguard hook` (internal hook command)

This command is called by Claude Code, not by the user directly.

**Stdin format** (Claude Code sends this as JSON on stdin):
```json
{
  "session_id": "...",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/abs/path/to/Button.tsx",
    "content": "..."
  }
}
```

The file path is at `tool_input.file_path`, not at the top level.

**Behavior:**
1. Parse stdin JSON, extract `tool_input.file_path`.
2. If `file_path` is missing or not `.tsx`/`.jsx`, exit 0 silently.
3. If file doesn't exist on disk, exit 0 silently.
4. Run the validator against the file path.
5. If `passed: true` → exit 0 with no stdout (silent success).
6. If `passed: false` → exit 0 and write a JSON decision to **stdout**:

```json
{
  "decision": "block",
  "reason": "DRIFTGUARD: Design system violations found in Button.tsx\n\n  ✗ ..."
}
```

**Why exit 0 + JSON, not exit 2 + stderr:**
- For `PostToolUse`, exit code 2 shows stderr to Claude but is less structured.
- Exit 0 + `{ "decision": "block", "reason": "..." }` is the Claude Code-native way to inject feedback. The `reason` field is fed directly to Claude as context, triggering automatic self-correction without user intervention.
- Only exit 0 output is parsed as JSON by Claude Code; exit 2 ignores stdout entirely.

**Non-blocking errors** (parse failures, missing config): exit 0 silently, write warning to stderr. Never block Claude on a driftguard internal error.

---

### 6. `init` Command

```bash
driftguard init
```

Behavior:
1. Check if `driftguard.config.json` exists. If not, write a default one (see config format above).
2. Check if `.claude/settings.json` exists.
   - If not: write it with the hook config.
   - If yes: parse it, merge in the `PostToolUse` hook entry, write it back. Do not clobber existing hooks.
3. Print confirmation:
   ```
   driftguard initialized.

     ✓ driftguard.config.json created
     ✓ .claude/settings.json updated with PostToolUse hook

   Next steps:
     1. Edit driftguard.config.json with your design tokens
     2. git add driftguard.config.json .claude/settings.json
     3. git commit -m "add driftguard"
   ```

---

### 7. `generate` Command

```bash
driftguard generate
```

Reads `driftguard.config.json` and writes token files to the paths declared in `generate.ts` and/or `generate.css`. Both are optional — only the paths that are configured get written.

**Config:**
```json
{
  "generate": {
    "ts": "src/tokens.ts",
    "css": "src/tokens.css"
  }
}
```

**TypeScript output** (`src/tokens.ts`):
```ts
// generated by driftguard — do not edit
export const colors = {
  primary: "#0055FF",
  secondary: "#6B7280",
  text: "#111111",
  background: "#FFFFFF",
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
```

Developers import and use these directly:
```tsx
import { colors, spacing } from "./tokens";

<div style={{ color: colors.text, marginTop: spacing[3] }} />
```

**CSS output** (`src/tokens.css`):
```css
/* generated by driftguard — do not edit */
:root {
  --color-primary: #0055FF;
  --color-secondary: #6B7280;
  --color-text: #111111;
  --color-background: #FFFFFF;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-64: 64px;
}
```

**Behavior:**
1. Load config, check for `generate` field. If absent, print a message explaining how to configure it and exit.
2. For each configured output path, create parent directories if needed, then write the file.
3. Print confirmation for each file written.
4. Generated files are overwritten on each run — they are derived from the config, not source files.

---

## TypeScript Types

```typescript
// types.ts

export interface GenerateConfig {
  ts?: string;   // output path for TypeScript constants e.g. "src/tokens.ts"
  css?: string;  // output path for CSS custom properties e.g. "src/tokens.css"
}

export interface DesignSystemConfig {
  exclude?: string[];                    // glob patterns for paths to skip entirely
  generate?: GenerateConfig;             // output paths for generated token files
  tokens: {
    colors: Record<string, string>;      // name → hex value
    spacingScale: number[];              // valid px values
  };
  components: Record<string, ComponentSpec>;
}

export interface PropMatch {
  prop: string;   // prop name to match
  value: string;  // expected prop value e.g. type="text"
}

export interface ComponentSpec {
  mustUse: boolean;
  replaces: string[];                           // raw HTML tags this component should replace e.g. ["div", "span"]
  whenHasProp: Array<string | PropMatch>;       // only enforce when element satisfies at least one entry:
                                                //   string → prop is present e.g. "onClick"
                                                //   PropMatch → prop is present with a specific value e.g. { prop: "type", value: "text" }
                                                //   [] means always enforce
}

export interface Violation {
  rule: RuleName;
  line: number;
  column: number;
  value: string;
  message: string;
  suggestion?: string;
}

export type RuleName =
  | "no-hardcoded-colors"
  | "spacing-scale"
  | "use-primitives";

export interface ValidationResult {
  file: string;
  score: number;       // 0–100
  passed: boolean;     // true only when violations.length === 0
  violations: Violation[];
}

export interface RuleContext {
  config: DesignSystemConfig;
  filePath: string;
}

export type Rule = (ast: BabelAST, ctx: RuleContext) => Violation[];
```

---

## Project File Structure

```
driftguard/
├── src/
│   ├── cli.ts                    # CLI entry point (commander.js)
│   │                             # commands: validate, init, generate, hook
│   ├── validator.ts              # Orchestrates rule execution, scoring
│   ├── parser.ts                 # Parses .tsx/.jsx with @babel/parser
│   ├── scorer.ts                 # Scoring formula
│   ├── config.ts                 # Loads + validates driftguard.config.json
│   ├── init.ts                   # init command: writes config + .claude/settings.json
│   ├── generate.ts               # generate command: outputs tokens.ts and/or tokens.css
│   ├── hook.ts                   # hook command: reads stdin, runs validator, formats output
│   ├── rules/
│   │   ├── index.ts              # Exports all rules as array
│   │   ├── no-hardcoded-colors.ts
│   │   ├── spacing-scale.ts
│   │   └── use-primitives.ts
│   ├── types.ts                  # Shared TypeScript interfaces
│   └── format.ts                 # Output formatters (human-readable + JSON)
├── package.json
│   # bin: { "driftguard": "./dist/cli.js" }
│   # dependencies: @babel/parser, @babel/traverse, @babel/types, commander
│   # devDependencies: typescript, @types/node, @types/babel__traverse
├── tsconfig.json
└── README.md
```

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `@babel/parser` | Parse TSX/JSX into AST |
| `@babel/traverse` | Walk the AST |
| `@babel/types` | AST node type helpers |
| `commander` | CLI argument parsing |

No runtime AI dependencies. No Anthropic SDK. The validator is pure static analysis.

---

## Demo Scenario (What Success Looks Like)

Claude generates this (non-compliant):
```tsx
<div
  style={{ background: "#0055FF", marginTop: 18 }}
  onClick={handleSubmit}
>
  Submit
</div>
```

Hook fires. Violations reported. Claude rewrites to:
```tsx
<Button
  style={{ marginTop: 16 }}
  onClick={handleSubmit}
>
  Submit
</Button>
```

Hook fires again. Passes. Loop ends. No user intervention.

---

## Non-Goals (MVP)

Do not build:
- ESLint plugin
- Figma API integration
- Org dashboards or reporting UI
- Multi-file semantic analysis
- Accessibility scanning
- Tailwind class name parsing
- GitHub CI integration
- MCP server
- Auth or user accounts

---

## Long-Term Direction (Context Only)

Future phases may include: GitHub CI enforcement, org-level compliance scoring, design drift trend analysis, multi-repo scanning, Figma token ingestion, component clustering, migration codemods, ESLint plugin, MCP server for proactive mid-generation checking.

Phase 1 proves one thing: **AI can be forced into deterministic design system compliance.**
