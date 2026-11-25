import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/engine/test/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/engine/src/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: { statements: 90 },
    },
  },
});
