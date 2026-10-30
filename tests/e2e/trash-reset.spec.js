// Bước 1.9: Thùng rác (T1.10) và Reset an toàn trên giao diện.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step, txt } from './support/harness.js';
import { makeLegacyProject } from '../data/support/legacy-fixture.js';
import { seedV2 } from './support/seed-v2.js';

async function open(browser, be, url = '/index.html?env=staging') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto(url); await page.waitForTimeout(2500);
    return { context, page, s };
}
const overview = async (page) => { await page.click('#menu-overview'); await page.waitForTimeout(500); return txt(await page.innerText('#module-overview')); };
const live = (be, entity) => Object.entries(be.DB).filter(([k, v]) => k.startsWith(`projects/P001/${entity}/`) && !v.deleted).length;

test('T1.10 Thùng rác: xóa VO đã duyệt → tổng VO đổi, VO hiện trong Thùng rác kèm người xóa → Khôi phục → tổng quay lại', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const { page, s, context } = await open(browser, be);
    const base = await overview(page);
    await step(test, s, 'T1. Xóa VO-002 (đã duyệt) → tổng VO ở Tổng quan đổi; bản ghi chỉ đánh dấu xóa', async () => {
        await page.evaluate(async () => {
            const { state } = await import('/js/app.js'); const ds = await import('/js/core/data-store.js');
            ds.persistVariations(state.appData.Variations.filter(v => v.vo_id !== 'VO-002'));
        });
        await page.waitForTimeout(1200);
        expect(be.DB['projects/P001/variations/VO-002'].deleted).toBe(true);
        expect(await overview(page)).not.toBe(base);
    });
    await step(test, s, 'T2. Mở Thùng rác: có dòng VO-002, người xóa là QS Demo', async () => {
        await page.click('#menu-trash'); await page.waitForTimeout(800);
        const row = txt(await page.innerText('#trash-body'));
        expect(row).toContain('VO-002'); expect(row).toContain('QS Demo'); expect(row).toContain('30 ngày');
    });
    await step(test, s, 'T3. Khôi phục → Thùng rác trống, tổng quay lại đúng như ban đầu', async () => {
        await page.click('#trash-body [data-restore="0"]'); await page.waitForTimeout(1500);
        expect(txt(await page.innerText('#trash-msg'))).toContain('Thùng rác trống');
        expect(be.DB['projects/P001/variations/VO-002'].deleted).toBe(false);
        expect(await overview(page)).toBe(base);
        const actions = Object.values(be.DB).filter(v => v.entityId === 'VO-002' && v.entity === 'variations').map(v => v.action).sort();
        expect(actions).toEqual(['delete', 'restore']);
    });
    await context.close();
});

test('Dự án chưa chuyển: Thùng rác báo chưa có (không lỗi)', async ({ browser }) => {
    const be = new Backend('admin'); be.DB['projects/P001'] = makeLegacyProject('P001');
    const { page, s, context } = await open(browser, be);
    await step(test, s, 'T4. Thùng rác của dự án cũ có thông báo', async () => {
        await page.click('#menu-trash'); await page.waitForTimeout(600);
        expect(txt(await page.innerText('#trash-msg'))).toContain('chưa chuyển');
    });
    await context.close();
});

test('Reset an toàn: phải gõ đúng TÊN dự án, tự tải bản sao lưu trước, hồ sơ vào Thùng rác (khôi phục được)', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const { page, s, context } = await open(browser, be);
    const name = 'Dự án thử P001';
    await step(test, s, 'X1. Mở hộp Reset: nút khóa; gõ "RESET" vẫn khóa; gõ đúng tên dự án mới mở', async () => {
        await page.evaluate(() => document.getElementById('btn-admin-reset').click());
        expect(txt(await page.innerText('#reset-project-name'))).toBe(name);
        expect(await page.isDisabled('#btn-execute-reset')).toBe(true);
        await page.fill('#reset-confirm-input', 'RESET'); expect(await page.isDisabled('#btn-execute-reset')).toBe(true);
        await page.fill('#reset-confirm-input', name); expect(await page.isDisabled('#btn-execute-reset')).toBe(false);
    });
    await step(test, s, 'X2. Xóa phạm vi Thanh toán: tải về file sao lưu, IPC vào Thùng rác, VO còn nguyên', async () => {
        await page.check('#reset-scope-payments');
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-execute-reset')]);
        expect(dl.suggestedFilename()).toMatch(/^CCM_Backup_P001_.*\.json$/);
        const body = JSON.parse(require_fs(await dl.path()));
        expect(body.collections.payments.length).toBe(4);
        await page.waitForTimeout(1500);
        expect(live(be, 'payments')).toBe(0); expect(live(be, 'variations')).toBe(6);
        expect(Object.entries(be.DB).filter(([k, v]) => k.startsWith('projects/P001/payments/') && v.deleted).length).toBe(4);
    });
    await context.close();
});

test('Reset: tài khoản không phải admin bị từ chối, không xóa gì', async ({ browser }) => {
    const be = seedV2(new Backend('user'));
    const { page, s, context } = await open(browser, be);
    await step(test, s, 'X3. User gõ đúng tên và gửi → báo lỗi, dữ liệu nguyên', async () => {
        await page.evaluate(() => document.getElementById('btn-admin-reset').click());
        await page.check('#reset-scope-payments'); await page.fill('#reset-confirm-input', 'Dự án thử P001');
        await page.evaluate(() => document.getElementById('btn-execute-reset').click()); await page.waitForTimeout(800);
        expect(txt(await page.innerText('.payment-toast'))).toContain('Chỉ admin');
        expect(live(be, 'payments')).toBe(4);
    });
    await context.close();
});

import { readFileSync } from 'node:fs';
function require_fs(p) { return readFileSync(p, 'utf8'); }
