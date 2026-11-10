// Tab Hướng dẫn: mở được, mục lục + nội dung, tìm không dấu, "Mở tab" nhảy đúng tab; tài khoản thường không thấy mục Quản trị.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

test('Hướng dẫn: mục lục, tìm "thung rac", Mở tab Ngân sách', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await step(test, s, 'G1. Mở tab Hướng dẫn → có mục lục và các mục, gồm Quản trị (admin)', async () => {
        await page.click('#menu-guide'); await page.waitForTimeout(400);
        await expect(page.locator('#module-guide')).toBeVisible();
        expect(await page.locator('.guide-section').count()).toBeGreaterThanOrEqual(12);
        await expect(page.locator('#guide-quan-tri')).toBeVisible();
    });
    await step(test, s, 'G2. Gõ "thung rac" (không dấu) → còn mục An toàn dữ liệu', async () => {
        await page.fill('#guide-search', 'thung rac'); await page.waitForTimeout(200);
        await expect(page.locator('#guide-an-toan')).toBeVisible();
        expect(await page.locator('.guide-section').count()).toBeLessThan(5);
        await page.fill('#guide-search', ''); await page.waitForTimeout(200);
    });
    await step(test, s, 'G3. Bấm "Mở tab" ở mục Ngân sách → sang tab Ngân sách', async () => {
        await page.click('#guide-ngan-sach .guide-go'); await page.waitForTimeout(500);
        await expect(page.locator('#module-guide')).toBeHidden();
        await expect(page.locator('#menu-budget')).toHaveClass(/active/);
    });
    await context.close();
});

test('Hướng dẫn: tài khoản QS thường không thấy mục Quản trị', async ({ browser }) => {
    const be = seedV2(new Backend('user'));
    const context = await browser.newContext(); await be.attach(context);
    const page = await context.newPage();
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await page.click('#menu-guide'); await page.waitForTimeout(400);
    await expect(page.locator('#guide-ipc')).toBeVisible();
    expect(await page.locator('#guide-quan-tri').count()).toBe(0);
    await context.close();
});
