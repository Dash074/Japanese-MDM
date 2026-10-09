import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5180", trace: "retain-on-failure" },
  webServer: [
    { command: "npx vite --port 5180 --strictPort", url: "http://localhost:5180", reuseExistingServer: !process.env.CI },
    // Production build for the offline / service-worker test.
    { command: "npx vite build && npx vite preview --port 4180 --strictPort", url: "http://localhost:4180", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(offline|csp|golden-path)\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /screens\.spec/ },
    { name: "pwa", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4180" }, testMatch: /(offline|csp|golden-path)\.spec/ },
  ],
});
