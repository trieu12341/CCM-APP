// Bước 2.7 (T2.13): In chứng chỉ IPC → trang A4 mới, dòng 16 + bằng chữ, đã duyệt không có BẢN NHÁP, nháp thì có; PDF 1 trang.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step, txt } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

const mod = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);

async function printOf(page, ipcId) {
    await mod(page, '/js/modules/payment/payment-nav.js', 'openIPCDetail', ipcId); await page.waitForTimeout(400);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#btn-print-ipc')]);
    await popup.waitForLoadState(); return popup;
}

test('T2.13 In IPC đã duyệt và IPC nháp: số dòng 16, bằng chữ, dấu BẢN NHÁP, PDF A4 1 trang', async ({ browser }) => {
    const be = seedV2(new Backend('admin'), 'P001', { ipcs: 5, vos: 2, cashflows: 2 });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging&features=all'); await page.waitForTimeout(2500);
    await page.click('#menu-payment'); await page.waitForTimeout(400);

    await step(test, s, 'P1. IPC-001 (đã duyệt): dòng 16 khớp số đã tính, có bằng chữ, không có BẢN NHÁP', async () => {
        const pop = await printOf(page, 'IPC-001');
        const expected = await page.evaluate(async () => {
            const { state } = await import('/js/app.js');
            return new Intl.NumberFormat('vi-VN').format(state.appData.Payments.find(p => p.ipc_id === 'IPC-001').computed.paymentThisPeriod);
        });
        expect(txt(await pop.innerText('[data-row="(16)"]'))).toBe(txt(expected));
        expect(await pop.innerText('[data-words]')).toMatch(/Bằng chữ: .+ đồng/);
        expect(await pop.locator('[data-draft]').count()).toBe(0);
        const pdf = await pop.pdf({ format: 'A4', preferCSSPageSize: true });
        expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
        await pop.close();
    });
    await step(test, s, 'P2. IPC-005 (nháp): có dấu BẢN NHÁP', async () => {
        const pop = await printOf(page, 'IPC-005');
        await expect(pop.locator('[data-draft]')).toHaveText('BẢN NHÁP');
        await pop.close();
    });
    await context.close();
});
