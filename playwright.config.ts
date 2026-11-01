import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "/tmp/diffscape-playwright-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1421",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 1421 --strictPort",
    url: "http://127.0.0.1:1421",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
