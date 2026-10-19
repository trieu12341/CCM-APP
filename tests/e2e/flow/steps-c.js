// Luồng đầy đủ — phần C: VO, quyết toán, đồng bộ cloud, xóa IPC, bấm thử mọi nút (bước 18–23)
import { expect } from '@playwright/test';
import { LS, txt, vnd, closeAll } from '../support/harness.js';

const PAIRS = [['budgets', 'ccm_budgets'], ['tenders', 'ccm_tenders'], ['contracts', 'ccm_contracts'],
    ['payments', 'ccm_payments'], ['variations', 'ccm_variations'], ['final_statements', 'ccm_final']];
const SKIP = /delete|xóa|reset|logout|clear|đăng xuất|restore|bulk|theme-toggle|btn-add-project|execute/i;

export const stepsC = [
    ['18. VO: tạo phát sinh, duyệt 1,2 tỷ', async ({ page }) => {
        await closeAll(page); await page.click('#menu-vo'); await page.waitForTimeout(400);
        await page.click('#btn-show-vo-layer2'); await page.waitForTimeout(400);
        await page.click('#btn-create-vo'); await page.waitForTimeout(500);
        await page.fill('#vo-name', 'VO-01 Bổ sung tầng hầm');
        await page.fill('#vo-submission-date', '2026-09-01'); await page.fill('#vo-assessment-date', '2026-09-20');
        const opts = await page.$eval('#vo-contract-select', e => [...e.options].map(o => [o.value, o.textContent]));
        const val = opts.find(o => o[1].includes('Thiết kế'));
        expect(val, JSON.stringify(opts)).toBeTruthy();
        await page.selectOption('#vo-contract-select', val[0]);
        await page.fill('#vo-item-desc', 'Tầng hầm B3');
        await page.fill('#vo-item-claimed-amt', '1500000000'); await page.dispatchEvent('#vo-item-claimed-amt', 'input');
        await page.fill('#vo-item-approved-amt', '1200000000'); await page.dispatchEvent('#vo-item-approved-amt', 'input');
        await page.selectOption('#vo-status', 'Approved'); await page.dispatchEvent('#vo-status', 'change');
        await page.click('#btn-save-vo'); await page.waitForTimeout(800);
        expect((await LS(page, 'ccm_variations'))[0]?.status).toBe('Approved');
    }],

    ['19. Quyết toán HĐ tư vấn → lưu cả cloud', async ({ page, be }) => {
        await closeAll(page); await page.click('#menu-final'); await page.waitForTimeout(400);
        await page.click('#btn-new-final-statement'); await page.waitForTimeout(500);
        const opts = await page.$eval('#final-contract-select', e => [...e.options].map(o => [o.value, o.textContent]));
        const val = opts.find(o => o[1].includes('Tư vấn giám sát')) || opts.find(o => o[0]);
        await page.selectOption('#final-contract-select', val[0]); await page.dispatchEvent('#final-contract-select', 'change');
        await page.click('#btn-confirm-final-contract'); await page.waitForTimeout(700);
        await page.click('#btn-submit-final'); await page.waitForTimeout(900);
        const fs = await LS(page, 'ccm_final');
        expect(fs.length).toBeGreaterThan(0);
        expect((be.project().final_statements || []).length).toBe(fs.length);
    }],

    ['20. Dữ liệu cloud khớp dữ liệu trong máy (mọi loại)', async ({ page, be }) => {
        const doc = be.project();
        for (const [ck, lk] of PAIRS) {
            const local = (await LS(page, lk)).filter(x => x.project_id === 'P001');
            expect((doc[ck] || []).length, `${ck}: cloud vs máy`).toBe(local.length);
        }
    }],

    ['21. VO đã duyệt hiện ở Tổng quan', async ({ page }) => {
        await closeAll(page); await page.click('#menu-overview'); await page.waitForTimeout(500);
        expect(txt(await page.innerText('#module-overview'))).toContain('1.200.000.000');
    }],

    ['21b. VO đã duyệt KHÔNG đổi giá trị HĐ, chỉ vào giá trị quyết toán', async ({ page }) => {
        const c = (await LS(page, 'ccm_contracts')).find(x => (x.package_name || '').includes('Thiết kế'));
        await closeAll(page); await page.click('#menu-contract'); await page.waitForTimeout(400);
        await page.click('#btn-open-contract-list'); await page.waitForTimeout(400);
        const row = page.locator('#contract-list-modal tr:has(.contract-cb)', { hasText: 'Thiết kế' });
        const rowText = await row.innerText();
        expect(rowText).toContain(vnd(c.original_value));
        expect(rowText).not.toContain(vnd(c.original_value + 1_200_000_000));
        await row.locator('td').first().click(); await page.waitForTimeout(400);
        expect(Number(await page.inputValue('#contract-value-input'))).toBe(c.original_value);
        const finalValue = await page.evaluate(async id => {
            const m = await import('./js/modules/final/final-state.js'); return m.calculateFinalAccount(id)?.c;
        }, c.contract_id);
        expect(finalValue).toBe(c.original_value + 1_200_000_000);
        await closeAll(page);
    }],

    ['22. IPC: xóa hồ sơ cuối (nháp) → máy & cloud cùng giảm', async ({ page, be }) => {
        await closeAll(page); await page.click('#menu-payment'); await page.waitForTimeout(300);
        await page.click('#btn-open-payment-list'); await page.waitForTimeout(400);
        const before = (await LS(page, 'ccm_payments')).length;
        await page.locator('#ipc-list-tbody tr').last().click(); await page.waitForTimeout(600);
        await page.click('#btn-delete-ipc'); await page.waitForTimeout(900);
        const after = (await LS(page, 'ccm_payments')).length;
        expect(after).toBe(before - 1);
        expect((be.project().payments || []).length).toBe(after);
    }],

    ['23. Bấm thử mọi nút hiển thị trên 8 tab', async ({ page, s }) => {
        const bad = [];
        for (const tab of ['overview', 'budget', 'tender', 'contract', 'cashflow', 'payment', 'vo', 'final']) {
            await closeAll(page); await page.click(`#menu-${tab}`); await page.waitForTimeout(500);
            const btns = await page.$$('.content-wrapper button:visible, .content-wrapper .interactive-widget:visible');
            for (const bt of btns.slice(0, 25)) {
                const label = `${await bt.getAttribute('id') || ''} ${await bt.innerText().catch(() => '')}`.trim().slice(0, 50);
                if (SKIP.test(label)) continue;
                const e0 = s.errors.length;
                try {
                    await bt.click({ timeout: 2500 }); await page.waitForTimeout(350);
                } catch (ex) {
                    const msg = String(ex.message || ex).split('\n')[0];
                    if (!/not visible|detached|not attached/.test(msg)) bad.push(`${tab}/${label}: KHÔNG BẤM ĐƯỢC (${msg.slice(0, 100)})`);
                    continue;
                }
                const errs = s.errors.slice(e0);
                if (errs.length) bad.push(`${tab}/${label}: ${errs[0].slice(0, 140)}`);
                await closeAll(page);
                try { await page.click(`#menu-${tab}`, { timeout: 2500 }); }
                catch { bad.push(`${tab}/${label}: sau khi bấm, không quay lại được menu (lớp phủ còn mở)`); await page.reload(); await page.waitForTimeout(2500); break; }
                await page.waitForTimeout(250);
            }
        }
        expect(bad, bad.join(' || ')).toEqual([]);
    }],
];
