// Luồng đầy đủ — phần A: dự án, ngân sách, đấu thầu, hợp đồng, dòng tiền (bước 1–11)
import { expect } from '@playwright/test';
import { LS, txt, closeAll } from '../support/harness.js';

const BUDGET_XLSX = 'tests/fixtures/budget-demo.xlsx';

export const stepsA = [
    ['1. Tạo dự án mới chỉ với tên (nút + trên topbar)', async ({ page, be }) => {
        await page.click('#btn-add-project'); await page.waitForTimeout(300);
        await page.fill('#proj-name', 'Dự án Kiểm Thử');
        await page.click('#new-project-form button[type=submit]'); await page.waitForTimeout(1200);
        const opts = await page.$eval('#project-select', e => [...e.options].map(o => o.textContent));
        expect(opts).toContain('Dự án Kiểm Thử');
        expect(Object.keys(be.DB).some(k => k.startsWith('projects/')), 'dự án đã lên cloud').toBe(true);
    }],

    ['2. Ngân sách: thêm 2 mục thủ công (xây dựng + tư vấn)', async ({ page }) => {
        await page.click('#menu-budget'); await page.waitForTimeout(400);
        await page.click('#btn-open-budget-list'); await page.waitForTimeout(400);
        for (const [cat, code, name, amt] of [['Construction', '102-03', 'Kết cấu (thêm tay)', '42000000000'],
            ['Consultancy', '104-04', 'Thiết kế (thêm tay)', '1550000000']]) {
            await page.click('#btnAddNewBudget'); await page.waitForTimeout(300);
            await page.selectOption('#budget-category', cat); await page.fill('#budget-budgetCode', code);
            await page.fill('#budget-packageName', name); await page.fill('#budget-budgeted', amt);
            await page.$eval('#budgetForm', f => f.requestSubmit()); await page.waitForTimeout(600);
        }
        const t = txt(await page.innerText('#budget-list-modal'));
        expect(t).toContain('Kết cấu (thêm tay)'); expect(t).toContain('Thiết kế (thêm tay)');
    }],

    ['3. Ngân sách: import Excel mẫu (9 mục giả lập)', async ({ page }) => {
        await page.setInputFiles('#budget-excel-upload', BUDGET_XLSX); await page.waitForTimeout(1500);
        expect((await LS(page, 'ccm_budgets')).length).toBeGreaterThan(2);
    }],

    ['4. Ngân sách: sửa một mục thành 43 tỷ', async ({ page }) => {
        await page.locator('#budget-list-modal .btn-edit-budget').first().click(); await page.waitForTimeout(400);
        await page.fill('#budget-budgeted', '43000000000');
        await page.$eval('#budgetForm', f => f.requestSubmit()); await page.waitForTimeout(600);
        expect((await LS(page, 'ccm_budgets')).map(b => b.budgeted)).toContain(43000000000);
    }],

    ['5. Tạo gói thầu từ dòng ngân sách "Thiết kế (thêm tay)"', async ({ page }) => {
        const row = page.locator('#budget-list-modal tr', { hasText: 'Thiết kế (thêm tay)' }).locator('.btn-create-tender');
        await ((await row.count()) ? row.first() : page.locator('#budget-list-modal .btn-create-tender').first()).click();
        await page.waitForTimeout(800);
        expect((await LS(page, 'ccm_tenders')).length).toBeGreaterThanOrEqual(1);
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }],

    ['6. Đấu thầu: mở gói, lập bảng so sánh giá, Lưu cập nhật', async ({ page, s }) => {
        await page.click('#menu-tender'); await page.waitForTimeout(400);
        await page.click('#btn-open-tender-list'); await page.waitForTimeout(500);
        const opened = await page.evaluate(() => {
            const r = [...document.querySelectorAll('#tender-list-modal tbody tr')].find(x => x.onclick && /T/.test(x.innerText.slice(0, 20)));
            if (r) r.click(); return !!r;
        });
        expect(opened, 'mở được gói thầu').toBe(true);
        await page.waitForTimeout(600);
        if (await page.isVisible('#btn-init-cba')) { await page.click('#btn-init-cba'); await page.waitForTimeout(400); }
        for (let i = 0; i < 2; i++) {
            await page.click(await page.isVisible('#btn-add-bidder') ? '#btn-add-bidder' : '#btn-add-bidder-empty');
            await page.waitForTimeout(300);
        }
        await page.click('#btn-add-item'); await page.waitForTimeout(300);
        let filled = 0;
        for (const inp of await page.$$('#tender-detail-modal table input')) {
            const type = await inp.getAttribute('type');
            const handler = `${await inp.getAttribute('onchange') || ''}${await inp.getAttribute('onblur') || ''}`;
            if (handler.includes('updateItemValue') || type === 'number') {
                await inp.fill(String(1_000_000_000 + filled * 1_000_000)); await inp.dispatchEvent('change'); filled++;
            } else if (handler.includes('updateItemDesc')) {
                await inp.fill('Hạng mục thử'); await inp.dispatchEvent('change');
            }
        }
        await page.click('#btn-save-cba'); await page.waitForTimeout(700);
        expect(s.newDialogs().some(d => d.toLowerCase().includes('lưu cập nhật')), `thông báo lưu: ${s.newDialogs()}`).toBe(true);
    }],

    ['7. Đấu thầu: CHỐT CHỌN NHÀ THẦU', async ({ page, s }) => {
        await page.click('#btn-award-tender'); await page.waitForTimeout(400);
        await page.fill('#award-winner', 'Công ty Thắng Thầu'); await page.fill('#award-price', '1.500.000.000');
        await page.click('#award-tender-form button[type=submit]'); await page.waitForTimeout(900);
        expect(s.newDialogs().some(d => d.toLowerCase().includes('chốt thầu thành công')), `${s.newDialogs()}`).toBe(true);
        const t = (await LS(page, 'ccm_tenders')).find(x => x.status === 'Awarded');
        expect(t?.final_price).toBe(1_500_000_000);
    }],

    ['8. Chuyển gói thầu đã chốt sang Hợp đồng', async ({ page }) => {
        if (await page.isVisible('#btn-convert-to-contract')) { await page.click('#btn-convert-to-contract'); await page.waitForTimeout(900); }
        const cs = await LS(page, 'ccm_contracts');
        expect(cs.some(c => c.original_value === 1_500_000_000), JSON.stringify(cs)).toBe(true);
    }],

    ['9. Hợp đồng: sửa thành gói xây dựng 50 tỷ + tham số IPC', async ({ page }) => {
        await closeAll(page); await page.click('#menu-contract'); await page.waitForTimeout(400);
        await page.click('#btn-open-contract-list'); await page.waitForTimeout(500);
        await page.locator('#contract-list-modal tbody tr:has(.contract-cb) td').first().click(); await page.waitForTimeout(500);
        await page.selectOption('#contract-type-select', 'Construction'); await page.selectOption('#contract-status-input', 'Active');
        await page.fill('#contract-value-input', '50000000000');
        for (const [k, v] of [['#contract-adv-percent-input', '15'], ['#contract-ap-recovery-input', '17.5'],
            ['#contract-retention-percent-input', '10'], ['#contract-vat-input', '8']]) await page.fill(k, v);
        await page.click('#btn-save-contract'); await page.waitForTimeout(800);
        const c = (await LS(page, 'ccm_contracts'))[0];
        expect(c.original_value).toBe(50_000_000_000); expect(c.status).toBe('Active');
        expect(Number(c.ap_recovery_percent)).toBe(17.5);
    }],

    ['10. Hợp đồng: tạo mới HĐ tư vấn thủ công', async ({ page }) => {
        await closeAll(page); await page.click('#menu-contract'); await page.waitForTimeout(300);
        await page.click('#btn-new-contract'); await page.waitForTimeout(500);
        await page.fill('#contract-code-input', 'HD-TV-01'); await page.selectOption('#contract-type-select', 'Consultancy');
        await page.fill('#contract-name-input', 'Tư vấn giám sát'); await page.fill('#contract-contractor-input', 'Tư vấn B');
        await page.selectOption('#contract-status-input', 'Active');
        await page.fill('#contract-value-input', '1200000000'); await page.fill('#contract-budget-input', '1300000000');
        if (await page.isVisible('#contract-vat-input')) await page.fill('#contract-vat-input', '8');
        await page.click('#btn-save-contract'); await page.waitForTimeout(800);
        const cs = await LS(page, 'ccm_contracts');
        expect(cs.some(c => c.contract_code === 'HD-TV-01' && c.original_value === 1_200_000_000)).toBe(true);
    }],

    ['11. Dòng tiền: mở chi tiết gói, tự sinh dòng tiền', async ({ page }) => {
        await closeAll(page); await page.click('#menu-cashflow'); await page.waitForTimeout(500);
        await page.click('#btn-cashflow-detail'); await page.waitForTimeout(700);
        const cards = page.locator('.cf-package-card');
        expect(await cards.count(), 'có thẻ gói thầu').toBeGreaterThan(0);
        const pick = cards.filter({ hasText: /Thiết kế|Xây dựng|Construction/ });
        await ((await pick.count()) ? pick.first() : cards.first()).click(); await page.waitForTimeout(500);
        if (await page.isVisible('#btn-auto-gen-cashflow')) { await page.click('#btn-auto-gen-cashflow'); await page.waitForTimeout(1000); }
    }],
];
