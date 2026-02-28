import { Command } from "commander";
import { loadConfig } from "./config.js";
import { validate } from "./validator.js";
import { formatHuman, formatJSON } from "./format.js";
import { runInit } from "./init.js";
import { runGenerate } from "./generate.js";
import { runHook } from "./hook.js";

const program = new Command();

program
  .name("driftguard")
  .description("Deterministic design system compliance engine for AI-generated UI")
  .version("0.1.0");

program
  .command("validate <file>")
  .description("Validate a .tsx/.jsx file against the design system")
  .option("--json", "Output results as JSON")
  .action((file: string, opts: { json?: boolean }) => {
    const config = loadConfig();
    const result = validate(file, config);

    if (opts.json) {
      console.log(formatJSON(result));
    } else {
      console.log(formatHuman(result));
    }

    process.exit(result.passed ? 0 : 1);
  });

program
  .command("init")
  .description("Initialize driftguard in the current project")
  .action(() => {
    runInit();
  });

program
  .command("generate")
  .description("Generate token files from the design system config")
  .action(() => {
    runGenerate();
  });

program
  .command("hook")
  .description("Claude Code PostToolUse hook (reads stdin, not for direct use)")
  .action(async () => {
    await runHook();
    process.exit(0);
  });

program.parse();
