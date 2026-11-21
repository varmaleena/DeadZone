import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 1,
  use: { headless: true },
  webServer: [
    {
      command:
        'node apps/freshcart/node_modules/vite/bin/vite.js preview apps/freshcart --outDir dist --host 127.0.0.1 --port 5181',
      url: 'http://127.0.0.1:5181',
      reuseExistingServer: false,
    },
    {
      command:
        'node apps/freshcart/node_modules/vite/bin/vite.js preview apps/freshcart --outDir dist-fixed --host 127.0.0.1 --port 5182',
      url: 'http://127.0.0.1:5182',
      reuseExistingServer: false,
    },
  ],
});
