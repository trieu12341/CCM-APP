// E2E: npm run test:e2e   (CHROME_PATH=<chromium> nếu không dùng trình duyệt Playwright tải về)
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
    testDir: 'tests/e2e',
    testMatch: '*.spec.js',
    timeout: 6 * 60 * 1000,
    workers: 1,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 1440, height: 900 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    },
    webServer: {
        command: `node tests/e2e/support/serve.mjs ${PORT}`,
        url: `http://localhost:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI,
    },
});
