import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["server/**/*.test.js", "shared/**/*.test.js", "client/**/*.test.{js,jsx}"],
    environmentMatchGlobs: [["client/**", "jsdom"]],
  },
});
