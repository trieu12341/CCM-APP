// Dữ liệu từ bản cũ của app (tên dự án chỉ còn trong máy, VO thiếu project_id, cloud thiếu trường) không được mất.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { openApp, step, LS, txt } from './support/harness.js';

const SEED = () => {
    if (localStorage.getItem('seeded')) return;
    const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    s('ccm_projects', [{ project_id: 'P001', project_name: 'Dự án Bản Cũ (tên thật)' }]);
    s('ccm_contracts', [{ contract_id: 'C1', project_id: 'P001', package_name: 'Gói chính', contractor: 'Nhà thầu A', original_value: 50000000000, type: 'Construction', status: 'Active' }]);
    s('ccm_variations', [{ vo_id: 'VO-01', contract_id: 'C1', vo_name: 'VO cũ', status: 'Approved', approved_amount: 500000000, claimed_amount: 600000000 }]);
    s('ccm_final', [{ id: 'FS-01', contract_id: 'C1', project_id: 'P001', final_value: 1 }]);
    s('ccm_payments', []); s('ccm_budgets', []); s('ccm_tenders', []);
    localStorage.setItem('ccm_current_project_id', 'P001'); localStorage.setItem('seeded', '1');
};

test('Dữ liệu bản cũ: không mất gì, tự vá lên cloud, tải lại vẫn đủ', async ({ browser }) => {
    const be = new Backend();
    // cloud bản cũ: không có tên dự án, variations rỗng, KHÔNG có final_statements
    be.DB['projects/P001'] = { projectId: 'P001', budgets: [], tenders: [], payments: [], variations: [], cashflows: [],
        contracts: [{ contract_id: 'C1', project_id: 'P001', package_name: 'Gói chính', contractor: 'Nhà thầu A', original_value: 50000000000, type: 'Construction', status: 'Active' }] };
    const { page, s, context } = await openApp(browser, be, { init: SEED });
    await page.waitForTimeout(2000);

    await step(test, s, 'L1. Giữ tên dự án, VO cũ có project_id, quyết toán giữ lại và vá lên cloud', async () => {
        expect(await page.$eval('#project-select', e => [...e.options].map(o => o.textContent))).toEqual(['Dự án Bản Cũ (tên thật)']);
        const vo = await LS(page, 'ccm_variations');
        expect(vo.length).toBe(1); expect(vo[0].project_id).toBe('P001');
        const doc = be.project();
        expect((doc.variations || []).map(v => v.vo_id)).toEqual(['VO-01']);
        expect((await LS(page, 'ccm_final')).length).toBe(1); expect((doc.final_statements || []).length).toBe(1);
        expect(doc.projectName).toBe('Dự án Bản Cũ (tên thật)');
    });
    await step(test, s, 'L2. Tải lại trang (đồng bộ realtime chạy) vẫn đủ dữ liệu', async () => {
        await page.reload(); await page.waitForTimeout(4000);
        expect((await LS(page, 'ccm_variations')).length).toBe(1);
        expect((await LS(page, 'ccm_final')).length).toBe(1);
        await page.click('#menu-overview'); await page.waitForTimeout(500);
        expect(txt(await page.innerText('#module-overview'))).toContain('500.000.000');
    });
    await context.close();
});
