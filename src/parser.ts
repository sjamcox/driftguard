import { readFileSync } from "node:fs";
import { parse } from "@babel/parser";
import type { BabelAST } from "./types.js";

export function parseFile(filePath: string): BabelAST {
  const code = readFileSync(filePath, "utf-8");
  return parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
  });
}
