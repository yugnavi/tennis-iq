import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-portrait smoke tests against the production build.
 * Runs WITHOUT Supabase env vars, so it exercises the labeled practice fallback.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite build --mode e2e && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
  projects: [
    { name: 'phone-320', use: { ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, browserName: 'chromium' } },
    { name: 'phone-390', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'chromium' } },
  ],
});
