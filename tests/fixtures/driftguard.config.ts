import type { DesignSystemConfig } from "../../src/types.js";

const config: DesignSystemConfig = {
  exclude: ["excluded/**"],
  tokens: {
    colors: {
      primary: {
        main: "#0055FF",
        hover: "#0044DD",
      },
      text: {
        primary: "#111111",
        secondary: "#6B7280",
      },
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
};

export default config;
