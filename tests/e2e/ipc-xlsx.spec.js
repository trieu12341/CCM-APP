// Bước 2.6 (T2.12): nút "Xuất CERT" ở chi tiết IPC → file .xlsx theo mẫu CERT, dòng 16 = số app đã tính.
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

const mod = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);

test('T2.12 Xuất CERT: tải file theo mẫu, 3 sheet, dòng (16) và (14) khớp số trong app', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);
    await page.click('#menu-payment'); await page.waitForTimeout(400);
    await mod(page, '/js/modules/payment/payment-nav.js', 'openIPCDetail', 'IPC-002'); await page.waitForTimeout(400);

    await step(test, s, 'X1. Bấm Xuất CERT → file IPC-xx_<HĐ>_<ngày>.xlsx, số khớp app', async () => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-xlsx-ipc')]);
        expect(dl.suggestedFilename()).toMatch(/^IPC-\d{2}_.+_\d{4}-\d{2}-\d{2}\.xlsx$/);
        const c = await page.evaluate(async () => (await import('/js/app.js')).state.appData.Payments.find(p => p.ipc_id === 'IPC-002').computed);
        const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(await dl.path());
        expect(wb.worksheets.map(w => w.name)).toEqual(['CERT', 'Att#0', 'FS']);
        const cert = wb.getWorksheet('CERT');
        expect(cert.getCell('M48').value).toBe(c.paymentThisPeriod);
        expect(cert.getCell('M44').value).toBe(c.thisPeriodExVat);
        expect(String(cert.getCell('B52').value)).toMatch(/^Bằng chữ: .+ đồng$/);
        expect(wb.getWorksheet('FS').getCell('C11').value).toBeTruthy();
    });
    await context.close();
});
