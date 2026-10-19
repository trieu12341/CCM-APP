/**
 * Luồng đầy đủ của một dự án, như người dùng thật bấm: Ngân sách → Đấu thầu → Hợp đồng → Dòng tiền
 * → IPC → VO → Quyết toán; rồi máy B thấy đủ dữ liệu; rồi phân quyền manager / pending.
 * Các bước nối tiếp nhau trên CÙNG một dữ liệu nên chạy tuần tự trong một test.
 */
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { openApp, step, LS, txt } from './support/harness.js';
import { stepsA } from './flow/steps-a.js';
import { stepsB } from './flow/steps-b.js';
import { stepsC } from './flow/steps-c.js';

test('Luồng đầy đủ: ngân sách → quyết toán, 2 máy, phân quyền', async ({ browser }, testInfo) => {
    const be = new Backend();

    // ── Máy A: làm toàn bộ luồng
    const A = await openApp(browser, be);
    for (const [title, fn] of [...stepsA, ...stepsB, ...stepsC]) {
        await step(test, A.s, title, () => fn({ page: A.page, s: A.s, be }));
    }
    await A.context.close();

    // ── Máy B: trình duyệt mới tinh, chỉ có dữ liệu từ cloud
    const B = await openApp(browser, be, { tag: 'B ' });
    await step(test, B.s, '24. Máy B (trình duyệt mới) thấy đủ dữ liệu như máy A', async () => {
        await B.page.waitForTimeout(1000);
        const opts = await B.page.$eval('#project-select', e => [...e.options].map(o => o.textContent));
        expect(opts).toContain('Dự án Kiểm Thử');
        const doc = be.project();
        for (const [ck, lk] of [['budgets', 'ccm_budgets'], ['contracts', 'ccm_contracts'], ['payments', 'ccm_payments'],
            ['variations', 'ccm_variations'], ['final_statements', 'ccm_final']]) {
            expect((await LS(B.page, lk)).length, `${lk} trên máy B`).toBe((doc[ck] || []).length);
        }
    });
    await step(test, B.s, '25. Chế độ tối: 8 tab hiển thị không lỗi (ảnh đính kèm báo cáo)', async () => {
        await B.page.evaluate(() => { localStorage.setItem('ccm_theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
        for (const tab of ['overview', 'budget', 'tender', 'contract', 'cashflow', 'payment', 'vo', 'final']) {
            await B.page.click(`#menu-${tab}`); await B.page.waitForTimeout(600);
            await testInfo.attach(`toi-${tab}`, { body: await B.page.screenshot(), contentType: 'image/png' });
        }
    });
    await B.context.close();

    // ── Phân quyền trên cùng dữ liệu
    const M = await openApp(browser, new Backend('manager').copyProjectsFrom(be), { tag: 'manager ' });
    await step(test, M.s, '26a. Manager vào được nhưng không có nút tạo/sửa', async () => {
        await M.page.click('#menu-contract'); await M.page.waitForTimeout(400);
        expect(await M.page.isVisible('#btn-new-contract')).toBe(false);
    });
    await M.context.close();

    const P = await openApp(browser, new Backend('pending').copyProjectsFrom(be), { tag: 'pending ' });
    await step(test, P.s, '26b. Tài khoản chờ cấp quyền bị chặn ở màn đăng nhập', async () => {
        expect(await P.page.isVisible('#login-modal')).toBe(true);
        expect(txt(await P.page.innerText('#login-error'))).toContain('chờ admin');
    });
    await P.context.close();
});
