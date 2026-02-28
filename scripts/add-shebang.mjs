import { readFileSync, writeFileSync } from "node:fs";

const cliPath = new URL("../dist/cli.js", import.meta.url);
const content = readFileSync(cliPath, "utf-8");

if (!content.startsWith("#!")) {
  writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`);
}
