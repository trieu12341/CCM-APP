// Bước 2.3 bản QS (T2.08, T2.09): IPC đã chốt chỉ đọc; mở khóa bắt buộc lý do → về Nháp, lý do ghi vào nhật ký.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';
import { seedV2, auditOf } from './support/seed-v2.js';

const mod = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);

test('T2.08/T2.09 IPC đã chốt: không có nút Sửa, có Mở khóa; thiếu lý do bị chặn; có lý do → Nháp + nhật ký', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await page.click('#menu-payment'); await page.waitForTimeout(400);
    await mod(page, '/js/modules/payment/payment-nav.js', 'openIPCDetail', 'IPC-001'); await page.waitForTimeout(400);

    await step(test, s, 'L1. IPC-001 đã duyệt: ẩn Sửa, hiện Mở khóa và dải "đã chốt"', async () => {
        await expect(page.locator('#btn-edit-ipc')).toBeHidden();
        await expect(page.locator('#btn-unlock-ipc')).toBeVisible();
        await expect(page.locator('#ipc-lock-banner')).toContainText('đã chốt');
    });
    await step(test, s, 'L2. Mở khóa không ghi lý do → báo bắt buộc, IPC vẫn đã duyệt', async () => {
        await page.click('#btn-unlock-ipc');
        await page.click('#reason-dialog [data-act="ok"]');
        await expect(page.locator('#reason-dialog .reason-error')).toContainText('Bắt buộc');
        await page.click('#reason-dialog [data-act="cancel"]');
        expect(await page.evaluate(async () => (await import('/js/app.js')).state.appData.Payments.find(p => p.ipc_id === 'IPC-001').status)).toBe('Approved');
    });
    await step(test, s, 'L3. Mở khóa có lý do → Nháp, hiện Sửa, lý do lưu vào IPC và nhật ký', async () => {
        await page.click('#btn-unlock-ipc');
        await page.fill('#reason-input', 'Sửa khối lượng cọc theo biên bản');
        await page.click('#reason-dialog [data-act="ok"]'); await page.waitForTimeout(1200);
        await expect(page.locator('#btn-edit-ipc')).toBeVisible();
        await expect(page.locator('#ipc-lock-banner')).toContainText('Sửa khối lượng cọc theo biên bản');
        const rec = Object.entries(be.DB).find(([k]) => k.startsWith('projects/P001/payments/') && be.DB[k].ipc_id === 'IPC-001')[1];
        expect(rec.status).toBe('Draft');
        expect(rec.last_unlock.reason).toBe('Sửa khối lượng cọc theo biên bản');
        expect(JSON.stringify(auditOf(be))).toContain('Sửa khối lượng cọc theo biên bản');
    });
    await context.close();
});
