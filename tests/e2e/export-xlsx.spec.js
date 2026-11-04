// Bước 2.8 (T2.14): nút "Xuất Excel" trên danh sách VO — tải về file .xlsx đặt tên theo dự án + ngày.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

test('Xuất Excel danh sách VO: có nút, tải được file .xlsx hợp lệ, tên có mã dự án và ngày', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await step(test, s, 'X1. Bấm Xuất Excel ở bảng VO → file .xlsx (zip) hợp lệ', async () => {
        await page.click('#menu-vo'); await page.waitForTimeout(500);
        await page.click('#btn-show-vo-layer2'); await page.waitForTimeout(500);
        const btn = page.locator('button[data-export-for="vo-table"]');
        await expect(btn).toBeVisible();
        const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()]);
        expect(dl.suggestedFilename()).toMatch(/_Phat-sinh-VO_\d{4}-\d{2}-\d{2}\.xlsx$/);
        const buf = readFileSync(await dl.path());
        expect(buf.slice(0, 2).toString()).toBe('PK');
        expect(buf.length).toBeGreaterThan(1500);
    });
    await context.close();
});
