// Trang admin "Chuyển dữ liệu": chạy thử → (tự tải sao lưu) chạy thật → kiểm lại KHỚP; bản thật mở nhưng vẫn phải chạy thử + gõ mã.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step, txt } from './support/harness.js';
import { makeLegacyProject } from '../data/support/legacy-fixture.js';

async function open(browser, be, url) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto(url); await page.waitForTimeout(2500);
    await page.click('#menu-migrate'); await page.waitForTimeout(400);
    return { context, page, s };
}
const seed = (role = 'admin') => {
    const be = new Backend(role);
    be.DB['projects/P001'] = makeLegacyProject('P001', { ipcs: 4, vos: 6, cashflows: 8 });
    return be;
};

test('Staging: chạy thử → chạy thật → mọi tổng kiểm KHỚP, dự án chuyển sang schemaVersion 2', async ({ browser }) => {
    const be = seed();
    const { page, s, context } = await open(browser, be, '/index.html?env=staging');

    await step(test, s, 'M1. Trang hiện nhãn STAGING; chưa chạy thử thì chưa cho chạy thật', async () => {
        expect(txt(await page.innerText('#mg-env'))).toBe('STAGING');
        expect(await page.isVisible('#mg-run-box')).toBe(false);
        expect(await page.$eval('#mg-project', e => e.value)).toBe('P001');
    });
    await step(test, s, 'M2. Chạy thử: hiện số bản ghi, không lỗi, KHÔNG ghi gì', async () => {
        await page.click('#mg-dry'); await page.waitForTimeout(800);
        const counts = txt(await page.innerText('#mg-counts'));
        expect(counts).toMatch(/Hợp đồng 3/); expect(counts).toMatch(/IPC 4/); expect(counts).toMatch(/VO 6/);
        expect(txt(await page.innerText('#mg-issues'))).toContain('Không có lỗi');
        expect(Object.keys(be.DB).some(k => k.startsWith('projects/P001/'))).toBe(false);
        expect(await page.isDisabled('#mg-run')).toBe(true);
    });
    await step(test, s, 'M3. Phải gõ đúng mã dự án mới bấm được Chạy thật', async () => {
        await page.fill('#mg-confirm', 'sai'); expect(await page.isDisabled('#mg-run')).toBe(true);
        await page.fill('#mg-confirm', 'P001'); expect(await page.isDisabled('#mg-run')).toBe(false);
    });
    await step(test, s, 'M4. Chạy thật: tự tải sao lưu trước; KHỚP hết, có bản ghi mới, mảng cũ còn nguyên, nhật ký "migrate"', async () => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#mg-run')]);
        expect(dl.suggestedFilename()).toMatch(/^ccm-truoc-chuyen_P001_\d{4}-\d{2}-\d{2}\.json$/);
        await page.waitForTimeout(1500);
        expect(txt(await page.innerText('#mg-result'))).toContain('Xong.');
        const checks = txt(await page.innerText('#mg-checks-after'));
        expect(checks).not.toContain('LỆCH'); expect((checks.match(/KHỚP/g) || []).length).toBe(13);
        expect(be.DB['projects/P001/contracts/C001'].original_value).toBeGreaterThan(0);
        expect(be.DB['projects/P001/contracts/C001']._v).toBe(1);
        expect(be.project().schemaVersion).toBe(2);
        expect(be.project().contracts.length).toBe(3);
        const audit = Object.entries(be.DB).filter(([k]) => k.startsWith('projects/P001/audit/')).map(([, v]) => v.action);
        expect(audit).toEqual(['migrate']);
    });
    await context.close();
});

test('Bản thật: Chạy thật chỉ mở sau khi chạy thử và gõ đúng mã dự án; chưa bấm thì chưa ghi gì', async ({ browser }) => {
    const be = seed();
    const { page, s, context } = await open(browser, be, '/index.html');
    await step(test, s, 'M5. Nhãn BẢN THẬT; chạy thử rồi gõ đúng mã mới mở nút Chạy thật', async () => {
        expect(txt(await page.innerText('#mg-env'))).toBe('BẢN THẬT');
        await page.click('#mg-dry'); await page.waitForTimeout(800);
        await page.fill('#mg-confirm', 'sai'); expect(await page.isDisabled('#mg-run')).toBe(true);
        await page.fill('#mg-confirm', 'P001');
        expect(await page.isDisabled('#mg-run')).toBe(false);
        expect(Object.keys(be.DB).some(k => k.startsWith('projects/P001/'))).toBe(false);
    });
    await context.close();
});

test('Manager không thấy mục Chuyển dữ liệu trong menu', async ({ browser }) => {
    const be = seed('manager');
    const context = await browser.newContext(); await be.attach(context);
    const page = await context.newPage(); await page.goto('/index.html'); await page.waitForTimeout(2500);
    expect(await page.isVisible('#menu-migrate')).toBe(false);
    await context.close();
});
