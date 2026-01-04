const { defineConfig, devices } = require('@playwright/test');

// Default BASE_URL to local workspace server.
// Tests that require E2E_BASE_URL should remain opt-in.
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:3000';
process.env.BASE_URL = process.env.BASE_URL || DEFAULT_LOCAL_BASE_URL;

let webServer;
try {
  const url = new URL(process.env.BASE_URL);
  const isLocal = (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && String(url.port || '80') === '3000';
  if (isLocal) {
    webServer = {
      command: 'node scripts/static-server.js',
      url: DEFAULT_LOCAL_BASE_URL,
      reuseExistingServer: true,
      timeout: 30 * 1000,
    };
  }
} catch {
  // If E2E_BASE_URL isn't a valid URL, skip webServer.
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 20000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['github']],
  webServer,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20000,
    navigationTimeout: 30000,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
