import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const DEFAULT_CONFIG = {
  exclude: ["src/components/**", "src/design-system/**"],
  tokens: {
    colors: {
      primary: "#0055FF",
      secondary: "#6B7280",
      text: "#111111",
      background: "#FFFFFF",
    },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  components: {
    Button: {
      mustUse: true,
      replaces: ["div", "span"],
      whenHasProp: ["onClick", "onPress"],
    },
    TextInput: {
      mustUse: true,
      replaces: ["input"],
      whenHasProp: [{ prop: "type", value: "text" }],
    },
  },
  generate: {
    ts: "src/tokens.ts",
    css: "src/tokens.css",
  },
};

const HOOK_ENTRY = {
  matcher: "Write|Edit",
  hooks: [
    {
      type: "command",
      command: "npx driftguard hook",
    },
  ],
};

export function runInit(): void {
  const cwd = process.cwd();
  const configPath = resolve(cwd, "driftguard.config.json");
  const claudeDir = resolve(cwd, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  // 1. Write config if absent
  let configCreated = false;
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
    configCreated = true;
  }

  // 2. Write or merge .claude/settings.json
  mkdirSync(claudeDir, { recursive: true });

  let settingsUpdated = false;
  if (existsSync(settingsPath)) {
    const existing = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (!existing.hooks) {
      existing.hooks = {};
    }
    if (!existing.hooks.PostToolUse) {
      existing.hooks.PostToolUse = [];
    }

    // Check if driftguard hook already exists
    const hasHook = existing.hooks.PostToolUse.some(
      (entry: any) =>
        entry.hooks?.some(
          (h: any) => typeof h.command === "string" && h.command.includes("driftguard"),
        ),
    );

    if (!hasHook) {
      existing.hooks.PostToolUse.push(HOOK_ENTRY);
      writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n");
      settingsUpdated = true;
    }
  } else {
    const settings = {
      hooks: {
        PostToolUse: [HOOK_ENTRY],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    settingsUpdated = true;
  }

  // 3. Print confirmation
  console.log("driftguard initialized.\n");
  console.log(
    `  ${configCreated ? "\u2713" : "\u2013"} driftguard.config.json ${configCreated ? "created" : "already exists"}`,
  );
  console.log(
    `  ${settingsUpdated ? "\u2713" : "\u2013"} .claude/settings.json ${settingsUpdated ? "updated with PostToolUse hook" : "already configured"}`,
  );
  console.log("\nNext steps:");
  console.log("  1. Edit driftguard.config.json with your design tokens");
  console.log("  2. git add driftguard.config.json .claude/settings.json");
  console.log('  3. git commit -m "add driftguard"');
}
