// Các tính năng không dùng (In/PDF, Xuất CERT, Báo cáo chi phí, Thành viên dự án) mặc định ẩn; ?features=all bật lại.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

const mod = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);

test('Mặc định ẩn 4 tính năng; ?features=all hiện lại', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await step(test, s, 'H1. Không thấy menu Báo cáo chi phí, nút In/PDF, Xuất CERT, bảng Thành viên dự án', async () => {
        await expect(page.locator('#menu-cost-report')).toBeHidden();
        await page.click('#menu-payment'); await page.waitForTimeout(300);
        await mod(page, '/js/modules/payment/payment-nav.js', 'openIPCDetail', 'IPC-001'); await page.waitForTimeout(300);
        await expect(page.locator('#btn-print-ipc')).toBeHidden();
        await expect(page.locator('#btn-xlsx-ipc')).toBeHidden();
        await expect(page.locator('#btn-unlock-ipc')).toBeVisible();   // khóa số vẫn dùng
        await mod(page, '/js/modules/payment/payment-nav.js', 'closeIPCDetail'); await page.waitForTimeout(300);
        await page.click('#menu-admin'); await page.waitForTimeout(500);
        await expect(page.locator('#members-card')).toBeHidden();
    });
    await step(test, s, 'H2. Mở với ?features=all → menu Báo cáo chi phí hiện lại', async () => {
        await page.goto('/index.html?env=staging&features=all'); await page.waitForTimeout(2500);
        await expect(page.locator('#menu-cost-report')).toBeVisible();
    });
    await context.close();
});
