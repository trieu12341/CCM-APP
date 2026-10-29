/**
 * Dự án GIẢ LẬP kiểu cũ (projects/{pid} chứa các mảng) để thử chuyển dữ liệu. Tên và số đều bịa, sinh theo công thức
 * nên cho kết quả giống nhau mỗi lần chạy. Cỡ "lớn" khớp kịch bản T1.03: 60 IPC × 30 dòng Bill, 200 VO, 500 dòng dòng tiền.
 */
export function makeLegacyProject(pid, { ipcs = 4, lines = 3, vos = 6, cashflows = 8, contracts = 3 } = {}) {
    const budgets = Array.from({ length: contracts }, (_, i) => ({
        id: `BG-${i + 1}`, project_id: pid, budgetCode: `102-0${i + 1}`, category: 'Xây Dựng', packageName: `Gói ${i + 1}`, budgeted: 10_000_000_000 * (i + 1),
    }));
    const tenders = budgets.map((b, i) => ({ tender_id: `T00${i + 1}`, project_id: pid, budget_id: b.id, package_name: b.packageName, status: 'Awarded' }));
    const cons = budgets.map((b, i) => ({
        contract_id: `C00${i + 1}`, project_id: pid, budget_id: b.id, package_name: b.packageName, type: 'Construction',
        original_value: b.budgeted * 0.9, contractor: `Nhà thầu ${i + 1}`,
    }));
    const payments = Array.from({ length: ipcs }, (_, i) => {
        const gross = 1_000_000_000 + i * 17_000_003;
        return {
            ipc_id: `IPC-${String(i + 1).padStart(3, '0')}`, project_id: pid, contract_id: cons[i % cons.length].contract_id,
            payment_number: Math.floor(i / cons.length) + 1, status: i % 5 === 4 ? 'Draft' : 'Approved', engine_version: 2,
            lines: Array.from({ length: lines }, (_, j) => ({ code: `102-0${(j % 3) + 1}`, to_date_amount: Math.round(gross / lines) + j, contract_amount: 5_000_000_000 })),
            computed: { advanceThisPeriod: i === 0 ? 500_000_000 : 0, thisPeriodExVat: Math.round(gross * 0.9), vat: Math.round(gross * 0.072),
                paymentThisPeriod: Math.round(gross * 0.972), grossThisPeriod: gross, grossToDate: gross * (i + 1), retentionToDate: Math.round(gross * 0.1 * (i + 1)), apRecoveryToDate: 0 },
        };
    });
    const variations = Array.from({ length: vos }, (_, i) => ({
        vo_id: `VO-${String(i + 1).padStart(3, '0')}`, project_id: pid, contract_id: cons[i % cons.length].contract_id,
        status: i % 2 ? 'Approved' : 'Pending', claimed_amount: 100_000_000 + i, approved_amount: i % 2 ? -52_000_000 + i * 1_000 : 0,
    }));
    const cash = Array.from({ length: cashflows }, (_, i) => ({
        id: `cf-${i + 1}`, project_id: pid, package_name: cons[i % cons.length].package_name, date: `2026-${String((i % 12) + 1).padStart(2, '0')}`,
        value: 250_000_000 + i, is_construction: false,
    }));
    const finals = [{ id: 'FS-01-abc', project_id: pid, contract_id: cons[0].contract_id, original_value: cons[0].original_value, final_value: cons[0].original_value - 52_000_000, status: 'Closed' }];
    return { projectId: pid, projectName: `Dự án thử ${pid}`, budgets, tenders, contracts: cons, payments, variations, cashflows: cash, final_statements: finals };
}

export const LARGE = { ipcs: 60, lines: 30, vos: 200, cashflows: 500, contracts: 6 };
