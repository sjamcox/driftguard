import type { ParserOptions } from "@babel/parser";

export interface GenerateConfig {
  ts?: string;
  css?: string;
}

export type ColorValue = string | { [key: string]: ColorValue };

export interface DesignSystemConfig {
  exclude?: string[];
  generate?: GenerateConfig;
  tokens: {
    colors: Record<string, ColorValue>;
    spacingScale: number[];
  };
  components: Record<string, ComponentSpec>;
}

export interface PropMatch {
  prop: string;
  value: string;
}

export interface ComponentSpec {
  mustUse: boolean;
  replaces: string[];
  whenHasProp: Array<string | PropMatch>;
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
  score: number;
  passed: boolean;
  violations: Violation[];
}

export interface RuleContext {
  config: DesignSystemConfig;
  filePath: string;
}

export type BabelAST = ReturnType<typeof import("@babel/parser").parse>;

export type Rule = (ast: BabelAST, ctx: RuleContext) => Violation[];
