// Bước 1.6: IPC và VO của dự án đã chuyển (schemaVersion 2) đọc/ghi qua lớp dữ liệu mới; dự án cũ chạy như trước.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step, txt } from './support/harness.js';
import { makeLegacyProject } from '../data/support/legacy-fixture.js';
import { seedV2, auditOf } from './support/seed-v2.js';

async function open(browser, be, url = '/index.html?env=staging') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto(url); await page.waitForTimeout(2500);
    return { context, page, s };
}
const mod = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);
const kpis = async (page) => { await page.click('#menu-payment'); await page.waitForTimeout(500); return txt(await page.innerText('#module-payment')); };

test('Dự án v2: số liệu tab Thanh toán y hệt dự án cũ cùng dữ liệu; không hiện dải "Cần chuyển dữ liệu"', async ({ browser }) => {
    const legacy = new Backend('admin'); legacy.DB['projects/P001'] = makeLegacyProject('P001');
    const v2 = seedV2(new Backend('admin'));
    const a = await open(browser, legacy); const b = await open(browser, v2);
    await step(test, a.s, 'V1. Dự án cũ (staging): có dải báo; số liệu IPC = mốc', async () => {
        expect(await a.page.isVisible('#legacy-banner')).toBe(true);
        expect(txt(await a.page.innerText('#legacy-banner'))).toContain('Cần chuyển dữ liệu');
    });
    await step(test, b.s, 'V2. Dự án v2: không có dải báo; số liệu tab Thanh toán KHÔNG đổi so với đường cũ', async () => {
        expect(await b.page.isVisible('#legacy-banner')).toBe(false);
        expect(await kpis(b.page)).toBe(await kpis(a.page));
        expect(txt(await b.page.innerText('#pay-kpi-ipc-count'))).toBe(txt(await a.page.innerText('#pay-kpi-ipc-count')));
    });
    await a.context.close(); await b.context.close();
});

test('Dự án v2: sửa IPC ghi vào bản ghi riêng (_v+1) kèm nhật ký, KHÔNG đụng mảng cũ; xóa là xóa mềm', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const oldArray = JSON.stringify(be.project().payments);
    const { page, s, context } = await open(browser, be);
    await step(test, s, 'V3. Sửa IPC-002 → _v 2, nhật ký ghi người sửa; mảng cũ nguyên vẹn', async () => {
        await mod(page, '/js/modules/payment/payment-state.js', 'updateIPC', 'IPC-002', { notes: 'đã sửa' }); await page.waitForTimeout(800);
        expect(be.DB['projects/P001/payments/IPC-002']._v).toBe(2);
        expect(be.DB['projects/P001/payments/IPC-002'].notes).toBe('đã sửa');
        expect(be.DB['projects/P001/payments/IPC-001']._v).toBe(1);
        expect(auditOf(be).filter(e => e.action === 'update').map(e => e.entityId)).toEqual(['IPC-002']);
        expect(JSON.stringify(be.project().payments)).toBe(oldArray);
    });
    await step(test, s, 'V4. Tạo VO mới và xóa IPC-004 → VO có bản ghi riêng, IPC-004 chỉ đánh dấu xóa', async () => {
        await mod(page, '/js/modules/vo/vo-state.js', 'createVO', { contract_id: 'C001', status: 'Pending', claimed_amount: 5 }); await page.waitForTimeout(600);
        await mod(page, '/js/modules/payment/payment-state.js', 'deleteIPC', 'IPC-004'); await page.waitForTimeout(800);
        expect(be.DB['projects/P001/variations/VO-07']?._v).toBe(1);
        expect(be.DB['projects/P001/payments/IPC-004'].deleted).toBe(true);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ccm_payments') || '[]').length)).toBe(0);   // v2: không lưu bản sao cũ vào localStorage
    });
    await context.close();
});

test('T1.01 trên giao diện: máy B lưu trước, máy A lưu sau → A bị chặn, số của B còn nguyên, A thấy bản mới', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const A = await open(browser, be); const B = await open(browser, be);
    await step(test, A.s, 'V5. A và B cùng mở; B lưu IPC-003; A lưu IPC-003 → A nhận báo lỗi, server giữ số của B', async () => {
        await mod(B.page, '/js/modules/payment/payment-state.js', 'updateIPC', 'IPC-003', { notes: 'B' }); await B.page.waitForTimeout(800);
        await mod(A.page, '/js/modules/payment/payment-state.js', 'updateIPC', 'IPC-003', { notes: 'A' }); await A.page.waitForTimeout(1200);
        expect(be.DB['projects/P001/payments/IPC-003'].notes).toBe('B');
        expect(be.DB['projects/P001/payments/IPC-003']._v).toBe(2);
        expect(txt(await A.page.innerText('body'))).toContain('vừa được người khác sửa');
        const mine = await A.page.evaluate(async () => (await import('/js/modules/payment/payment-state.js')).getIPCById('IPC-003').notes);
        expect(mine).toBe('B');
    });
    await step(test, A.s, 'V6. T1.02: A sửa IPC-001 và B sửa VO-001 → cả hai lưu được', async () => {
        await mod(A.page, '/js/modules/payment/payment-state.js', 'updateIPC', 'IPC-001', { notes: 'A2' });
        await mod(B.page, '/js/modules/vo/vo-state.js', 'updateVO', 'VO-001', { notes: 'B2' }); await A.page.waitForTimeout(1000);
        expect(be.DB['projects/P001/payments/IPC-001'].notes).toBe('A2');
        expect(be.DB['projects/P001/variations/VO-001'].notes).toBe('B2');
    });
    await A.context.close(); await B.context.close();
});
