// Luồng đầy đủ — phần B: chuỗi IPC, duyệt/trả, IPC tư vấn, dashboard (bước 12–17b)
// Số kỳ vọng tính tay từ tham số HĐ ở bước 9: giá trị 50 tỷ, TƯ 15%, thu hồi 17,5% KL, giữ lại 10% giá trị gộp, VAT 8%.
import { expect } from '@playwright/test';
import { LS, txt, digits, closeAll } from '../support/harness.js';

const FS_XLSX = 'tests/fixtures/fs-demo.xlsx';
const byNo = (ps) => [...ps].sort((a, b) => a.payment_number - b.payment_number);

async function ipcNew(page, contractText, fill) {
    await page.click('#btn-new-ipc'); await page.waitForTimeout(500);
    const opts = await page.$eval('#ipc-form-contract', e => [...e.options].map(o => [o.value, o.textContent]));
    const val = opts.find(o => o[1].includes(contractText));
    expect(val, `HĐ "${contractText}" trong form IPC: ${JSON.stringify(opts)}`).toBeTruthy();
    await page.selectOption('#ipc-form-contract', val[0]); await page.waitForTimeout(500);
    await fill(); await page.waitForTimeout(300);
    await page.click('#btn-save-ipc'); await page.waitForTimeout(1000);
    if (await page.isVisible('#btn-close-ipc-detail')) { await page.click('#btn-close-ipc-detail'); await page.waitForTimeout(400); }
}

async function setLastLineAmount(page, amount, code, desc) {
    const ins = page.locator('#ipc-c-lines-body tr:last-child input');
    if (code) { await ins.nth(0).fill(code); await ins.nth(1).fill(desc); }
    await ins.last().fill(String(amount)); await ins.last().dispatchEvent('input');
}

export const stepsB = [
    ['12. IPC: tạm ứng → Đợt 1 nhập tay → Đợt 2 import sheet FS', async ({ page }) => {
        await closeAll(page); await page.click('#menu-payment'); await page.waitForTimeout(400);
        await page.click('#btn-open-payment-list'); await page.waitForTimeout(400);
        await ipcNew(page, 'Thiết kế', async () => {
            expect(await page.isChecked('#ipc-c-is-advance'), 'IPC đầu tiên tự đánh dấu tạm ứng').toBe(true);
        });
        await ipcNew(page, 'Thiết kế', async () => {
            expect(await page.isChecked('#ipc-c-is-advance')).toBe(false);
            await page.click('#ipc-c-add'); await page.waitForTimeout(200);
            await setLastLineAmount(page, 2_000_000_000, '102-08', 'Toàn bộ');
        });
        await ipcNew(page, 'Thiết kế', async () => {
            await page.setInputFiles('#ipc-c-file', FS_XLSX); await page.waitForTimeout(1200);
        });
        expect((await LS(page, 'ccm_payments')).length).toBe(3);
    }],

    ['13. IPC: số tính đúng (tạm ứng 7,5 tỷ; Đợt 1 (14)=1,45 tỷ; Đợt 2 đến nay 6 tỷ)', async ({ page }) => {
        const [a, p1, p2] = byNo(await LS(page, 'ccm_payments')).map(p => p.computed);
        expect(a.paymentThisPeriod).toBe(7_500_000_000);
        expect(p1.thisPeriodExVat).toBe(1_450_000_000);        // 2 tỷ − giữ lại 200tr − thu hồi TƯ 350tr
        expect(p1.paymentThisPeriod).toBe(1_610_000_000);      // + VAT 8% × 2 tỷ
        expect(p2.workDoneToDate).toBe(6_000_000_000);         // file FS thay dòng thủ công cùng mã
        expect(p2.previousCertified).toBe(1_450_000_000);
        expect(p2.thisPeriodExVat).toBe(2_900_000_000);        // 6 tỷ − 600tr − 1,05 tỷ − 1,45 tỷ
        expect(p2.paymentThisPeriod).toBe(3_220_000_000);      // + VAT 8% × 4 tỷ
    }],

    ['14. IPC: sửa Đợt 1 → Đợt 2 tự tính lại "đã xác nhận kỳ trước"', async ({ page }) => {
        await page.locator('#ipc-list-tbody tr').nth(1).click(); await page.waitForTimeout(700);
        await page.click('#btn-edit-ipc'); await page.waitForTimeout(600);
        await setLastLineAmount(page, 2_400_000_000); await page.waitForTimeout(300);
        await page.click('#btn-save-ipc'); await page.waitForTimeout(1000);
        if (await page.isVisible('#btn-close-ipc-detail')) { await page.click('#btn-close-ipc-detail'); await page.waitForTimeout(300); }
        const [, p1, p2] = byNo(await LS(page, 'ccm_payments')).map(p => p.computed);
        expect(p1.workDoneToDate).toBe(2_400_000_000);
        expect(p1.thisPeriodExVat).toBe(1_740_000_000);
        expect(p2.previousCertified).toBe(1_740_000_000);
        expect(p2.thisPeriodExVat).toBe(2_610_000_000);
    }],

    ['15. IPC: duyệt cả 3, xác nhận đã trả 2 đợt đầu', async ({ page }) => {
        for (let i = 0; i < 3; i++) {
            await page.locator('#ipc-list-tbody tr').nth(i).click(); await page.waitForTimeout(600);
            await page.click('#btn-approve-ipc'); await page.waitForTimeout(500);
            if (i < 2) { await page.click('#btn-confirm-paid'); await page.waitForTimeout(500); }
            await page.click('#btn-close-ipc-detail'); await page.waitForTimeout(300);
        }
        expect(byNo(await LS(page, 'ccm_payments')).map(p => p.status)).toEqual(['Paid', 'Paid', 'Approved']);
    }],

    ['16. IPC gói tư vấn: 300 triệu + VAT 8% = 324 triệu', async ({ page }) => {
        await closeAll(page); await page.click('#menu-payment'); await page.waitForTimeout(300);
        await page.click('#btn-open-payment-list'); await page.waitForTimeout(400);
        await ipcNew(page, 'Tư vấn giám sát', async () => {
            await page.fill('#ipc-form-gross', '300000000'); await page.dispatchEvent('#ipc-form-gross', 'input');
            if (await page.isVisible('#ipc-form-vat')) { await page.fill('#ipc-form-vat', '8'); await page.dispatchEvent('#ipc-form-vat', 'input'); }
        });
        const p = (await LS(page, 'ccm_payments')).find(x => x.contract_type === 'Consultancy');
        expect(p?.net_payable).toBe(324_000_000);
    }],

    ['17. Dashboard Thanh toán + Dòng tiền khớp danh sách; Đã trả ≤ Đã duyệt', async ({ page }) => {
        await page.click('#btn-payment-back-l1'); await page.waitForTimeout(500);
        const count = txt(await page.innerText('#pay-kpi-ipc-count'));
        expect(count.startsWith(String((await LS(page, 'ccm_payments')).length))).toBe(true);
        await page.click('#menu-cashflow'); await page.waitForTimeout(500);
        const cert = digits(await page.innerText('#cf-kpi-certified')), paid = digits(await page.innerText('#cf-kpi-paid'));
        expect(paid).toBeLessThanOrEqual(cert);
    }],

    ['17b. Dòng tiền: biểu đồ có đường thực tế (đã duyệt/đã trả) và đã duyệt/còn lại theo HĐ', async ({ page }) => {
        await closeAll(page); await page.click('#menu-cashflow'); await page.waitForTimeout(900);
        const legend = (sel) => page.$$eval(`${sel} .apexcharts-legend-text`, e => e.map(x => x.textContent));
        expect((await legend('#cf-chart-3')).some(x => x.includes('thực tế'))).toBe(true);
        const l4 = await legend('#cf-chart-4');
        expect(l4.some(x => x.includes('Đã trả')) && l4.some(x => x.includes('Đã duyệt'))).toBe(true);
        expect(await legend('#cf-chart-2')).toEqual(expect.arrayContaining(['Đã duyệt', 'Còn lại']));
    }],
];
