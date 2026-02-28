import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { DesignSystemConfig } from "./types.js";

const DEFAULT_CONFIG: DesignSystemConfig = {
  exclude: [
    "src/components/core/**",
    "src/design-system/**",
    "src/tokens.ts",
    "src/tokens.css",
  ],
  tokens: {
    colors: {
      primary: {
        main: "#0055FF",
        hover: "#0044DD",
        dark: "#003399",
      },
      text: {
        primary: "#111111",
        secondary: "#6B7280",
        tertiary: "#9CA3AF",
      },
      background: {
        primary: "#FFFFFF",
        secondary: "#F9FAFB",
      },
    },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  components: {
    Button: {
      mustUse: true,
      replaces: ["div", "span"],
      whenHasProp: ["onClick", "onPress"],
    },
  },
};

const CONFIG_TEMPLATE = `import type { DesignSystemConfig } from "driftguard";

const config: DesignSystemConfig = {
  exclude: [
    "src/components/core/**",
    "src/design-system/**",
  ],
  tokens: {
    colors: {
      primary: {
        main: "#0055FF",
        hover: "#0044DD",
        dark: "#003399",
      },
      text: {
        primary: "#111111",
        secondary: "#6B7280",
        tertiary: "#9CA3AF",
      },
      background: {
        primary: "#FFFFFF",
        secondary: "#F9FAFB",
      },
    },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  components: {
    Button: {
      mustUse: true,
      replaces: ["div", "span"],
      whenHasProp: ["onClick", "onPress"],
    },
  },
};

export default config;
`;

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
  const configPath = resolve(cwd, "driftguard.config.ts");
  const claudeDir = resolve(cwd, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  // 1. Write config if absent
  let configCreated = false;
  if (!existsSync(configPath)) {
    writeFileSync(configPath, CONFIG_TEMPLATE);
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
    `  ${configCreated ? "\u2713" : "\u2013"} driftguard.config.ts ${configCreated ? "created" : "already exists"}`,
  );
  console.log(
    `  ${settingsUpdated ? "\u2713" : "\u2013"} .claude/settings.json ${settingsUpdated ? "updated with PostToolUse hook" : "already configured"}`,
  );
  console.log("\nNext steps:");
  console.log("  1. Edit driftguard.config.ts with your design tokens");
  console.log("  2. git add driftguard.config.ts .claude/settings.json");
  console.log('  3. git commit -m "add driftguard"');
}
