import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Desktop Chrome"],
    channel: process.env.UNITPATH_SYSTEM_CHROME ? "chrome" : undefined,
  },
  webServer: {
    command: "pnpm --filter @unitpath/web dev --host 127.0.0.1",
    url: "http://127.0.0.1:5173/setup",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
