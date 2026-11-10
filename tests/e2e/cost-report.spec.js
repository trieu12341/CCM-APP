// Bước 3.3 (T3.05/T3.06 phần tự động): tab Báo cáo chi phí — bảng theo gói, bấm dòng xem VO/IPC, xuất Excel tổng = trên app.
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { Backend } from './support/backend.js';
import { Session, step, txt } from './support/harness.js';
import { seedV2 } from './support/seed-v2.js';

test('Báo cáo chi phí: 3 gói, tổng AFC đúng, bấm dòng xem chi tiết, xuất Excel khớp app', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await be.attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html?env=staging'); await page.waitForTimeout(2500);

    const rep = async () => page.evaluate(async () => (await import('/js/modules/report/cost-report-ui.js')).currentReport());
    await step(test, s, 'R1. Mở tab → mỗi gói 1 dòng, dòng tổng = engine', async () => {
        await page.click('#menu-cost-report'); await page.waitForTimeout(600);
        await expect(page.locator('#module-cost-report')).toBeVisible();
        await expect(page.locator('#cr-body tr.cr-row')).toHaveCount(3);
        const r = await rep();
        const afcCell = page.locator('#cr-body tr.cr-total td').nth(9);
        expect(txt(await afcCell.innerText())).toBe(txt(new Intl.NumberFormat('vi-VN').format(r.total.afc)));
        expect(r.total.afc).toBe(r.groups.flatMap(g => g.rows).reduce((a, x) => a + x.afc, 0));
    });
    await step(test, s, 'R2. Bấm dòng gói 1 → hiện VO và IPC của HĐ', async () => {
        await page.locator('#cr-body tr.cr-row').first().click();
        await expect(page.locator('#cr-detail')).toBeVisible();
        await expect(page.locator('#cr-detail')).toContainText('IPC');
    });
    await step(test, s, 'R3. Xuất Excel → sheet Report, ô tổng AFC = trên app', async () => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cr-export')]);
        expect(dl.suggestedFilename()).toMatch(/^Cost-report_.+_\d{4}-\d{2}-\d{2}\.xlsx$/);
        const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(await dl.path());
        const ws = wb.getWorksheet('Report');
        let totalRow = null; ws.eachRow((row, i) => { if (String(row.getCell(3).value || '').startsWith('TOTAL')) totalRow = i; });
        expect(ws.getCell(`J${totalRow}`).value).toBe((await rep()).total.afc);
    });
    await context.close();
});
