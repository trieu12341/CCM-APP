// Bước 1.7: ngân sách, gói thầu, HĐ, dòng tiền, quyết toán của dự án v2 cũng lưu từng hồ sơ; không còn bản sao ccm_*; máy mới thấy đủ dữ liệu từ cloud (T1.11).
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
const call = (page, path, fn, ...args) => page.evaluate(async ([p, f, a]) => (await import(p))[f](...a), [path, fn, args]);
const tab = async (page, id, sel) => { await page.click(id); await page.waitForTimeout(500); return txt(await page.innerText(sel)); };

test('T1.11 máy mới (localStorage trống): dự án v2 đủ dữ liệu từ cloud, số các tab y hệt đường cũ', async ({ browser }) => {
    const legacy = new Backend('admin'); legacy.DB['projects/P001'] = makeLegacyProject('P001');
    const a = await open(browser, legacy); const b = await open(browser, seedV2(new Backend('admin')));
    for (const [menu, sel, name] of [['#menu-overview', '#module-overview', 'Tổng quan'], ['#menu-budget', '#module-budget', 'Ngân sách'],
        ['#menu-cashflow', '#cashflow-view', 'Dòng tiền'], ['#menu-payment', '#module-payment', 'Thanh toán'], ['#menu-vo', '#module-vo', 'VO'], ['#menu-final', '#module-final', 'Quyết toán']]) {
        await step(test, b.s, `R-${name}. Số liệu tab ${name} của dự án v2 = đường cũ`, async () => {
            const old = await tab(a.page, menu, sel);
            expect(old.length).toBeGreaterThan(40);   // tab có nội dung thật, không so hai trang trống
            expect(await tab(b.page, menu, sel)).toBe(old);
        });
    }
    await a.context.close(); await b.context.close();
});

test('Dự án v2: sửa ngân sách / HĐ / dòng tiền / quyết toán ghi bản ghi riêng kèm nhật ký, không đụng mảng cũ, không ghi ccm_*', async ({ browser }) => {
    const be = seedV2(new Backend('admin'));
    const old = JSON.stringify([be.project().budgets, be.project().contracts, be.project().cashflows]);
    const { page, s, context } = await open(browser, be);
    await step(test, s, 'R1. Sửa từng loại → _v 2 ở đúng hồ sơ, nhật ký đúng', async () => {
        const st = await page.evaluateHandle(async () => (await import('/js/app.js')).state);
        const upd = (key, persist, idKey, id, patch) => page.evaluate(async ([k, pf, ik, i, pa]) => {
            const { state } = await import('/js/app.js'); const ds = await import('/js/core/data-store.js');
            ds[pf](state.appData[k].map(x => (x[ik] === i ? { ...x, ...pa } : x)));
        }, [key, persist, idKey, id, patch]);
        await upd('Budgets', 'persistBudgets', 'id', 'BG-1', { note: 'sửa' });
        await upd('Contracts', 'persistContracts', 'contract_id', 'C001', { contractor: 'Nhà thầu mới' });
        await upd('Cashflow', 'persistCashflow', 'id', 'cf-2', { note: 'sửa' });
        await upd('Final_Statements', 'persistFinalStatements', 'id', 'FS-01-abc', { status: 'Draft' });
        await page.waitForTimeout(1500);
        const v = (p) => be.DB[`projects/P001/${p}`];
        expect([v('budgets/BG-1')._v, v('contracts/C001')._v, v('cashflows/cf-2')._v, v('finals/FS-01-abc')._v]).toEqual([2, 2, 2, 2]);
        expect(v('budgets/BG-2')._v).toBe(1); expect(v('cashflows/cf-1')._v).toBe(1);
        expect(auditOf(be).filter(e => e.action === 'update').map(e => e.entity).sort()).toEqual(['budgets', 'cashflows', 'contracts', 'finals']);
        expect(JSON.stringify([be.project().budgets, be.project().contracts, be.project().cashflows])).toBe(old);
        void st;
    });
    await step(test, s, 'R2. Dự án v2 không ghi bản sao ccm_* vào localStorage', async () => {
        const ls = await page.evaluate(() => ['ccm_budgets', 'ccm_contracts', 'ccm_cashflow', 'ccm_payments', 'ccm_variations', 'ccm_final'].map(k => (JSON.parse(localStorage.getItem(k) || '[]')).length));
        expect(ls).toEqual([0, 0, 0, 0, 0, 0]);
    });
    await context.close();
});
