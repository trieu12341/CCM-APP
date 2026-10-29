// Môi trường: bản thật không có dải STAGING; mở với ?env=staging thì có dải cảnh báo và tiêu đề đánh dấu.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';

async function open(browser, url) {
    const context = await browser.newContext();
    await new Backend().attach(context);
    const page = await context.newPage();
    await page.goto(url); await page.waitForTimeout(1200);
    return { context, page };
}

test('Bản thật: không có dải STAGING, tiêu đề không bị đổi', async ({ browser }) => {
    const { context, page } = await open(browser, '/index.html');
    expect(await page.evaluate(() => document.documentElement.classList.contains('env-staging'))).toBe(false);
    expect(await page.title()).not.toMatch(/STAGING/);
    await context.close();
});

test('?env=staging: có dải cảnh báo và tiêu đề [STAGING]', async ({ browser }) => {
    const { context, page } = await open(browser, '/index.html?env=staging');
    expect(await page.evaluate(() => document.documentElement.classList.contains('env-staging'))).toBe(true);
    expect(await page.title()).toMatch(/^\[STAGING\]/);
    const banner = await page.evaluate(() => getComputedStyle(document.body, '::before').content);
    expect(banner).toMatch(/STAGING/);
    await context.close();
});
