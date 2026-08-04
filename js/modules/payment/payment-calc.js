/**
 * payment-calc.js
 * Pure calculation functions — no side effects, no DOM access.
 * All QS financial computations for IPC breakdown.
 */
import { parseCurrencyInput } from '../../utils/formatters.js';

// ─────────────────────────────────────────────────────────────
// IPC FINANCIAL BREAKDOWN (5-line QS Standard)
// ─────────────────────────────────────────────────────────────

/**
 * Calculates the full QS breakdown for a single IPC.
 *
 * Formula:
 *  1. AP Deduction   = grossWorkDone × (apRecoveryPct / 100)
 *  2. Retention      = (grossWorkDone - apDeduction) × (retentionPct / 100)
 *  3. Sub-total      = grossWorkDone - apDeduction - retention
 *  4. VAT Amount     = sub-total × (vatPct / 100)
 *  5. Net Payable    = sub-total + vatAmount
 *
 * @param {Object} params
 * @param {number} params.grossWorkDone    - Gross work done this period
 * @param {number} params.apRecoveryPct   - AP recovery % (default 0)
 * @param {number} params.retentionPct    - Retention % (default 5)
 * @param {number} params.vatPct          - VAT % (default 10)
 * @returns {{ apDeduction, retentionDeduction, subTotal, vatAmount, netPayable }}
 */
export function calcNetPayable({ grossWorkDone = 0, apRecoveryPct = 0, retentionPct = 5, vatPct = 10 }) {
    const gross = Number(grossWorkDone) || 0;
    const apDeduction = gross * (Number(apRecoveryPct) / 100);
    const afterAP = gross - apDeduction;
    const retentionDeduction = afterAP * (Number(retentionPct) / 100);
    const subTotal = afterAP - retentionDeduction;
    const vatAmount = subTotal * (Number(vatPct) / 100);
    const netPayable = subTotal + vatAmount;

    return {
        apDeduction: Math.round(apDeduction),
        retentionDeduction: Math.round(retentionDeduction),
        subTotal: Math.round(subTotal),
        vatAmount: Math.round(vatAmount),
        netPayable: Math.round(netPayable),
    };
}

// ─────────────────────────────────────────────────────────────
// EXECUTIVE KPI SUMMARY
// ─────────────────────────────────────────────────────────────

/**
 * Calculates the 4 Executive KPI cards for Layer 1 Dashboard.
 *
 * @param {Array} payments  - All IPC records for this project
 * @param {Array} contracts - All contracts for this project (for Active Contract total)
 * @returns {{ totalActiveContracts, totalSubmitted, totalApproved, totalPaid }}
 */
export function calcPaymentKPIs(payments = [], contracts = []) {
    // Card 1: Sum of all Active contract values
    const totalActiveContracts = contracts
        .filter(c => {
            const st = (c.status || '').toLowerCase();
            return st === 'active' || st === 'đang thực hiện';
        })
        .reduce((sum, c) => sum + parseCurrencyInput(c.current_value || c.original_value || c.contract_value || c.total_value), 0);

    // Card 2: Total Submitted = sum of gross_work_done across all IPCs
    const totalSubmitted = payments
        .reduce((sum, p) => sum + parseCurrencyInput(p.submitted_amount || p.gross_work_done), 0);

    // Card 3: Total Approved/Certified = sum of certified_value for Approved + Paid IPCs
    const totalApproved = payments
        .filter(p => {
            const st = (p.status || '').toLowerCase();
            return st === 'approved' || st === 'đã duyệt' || st === 'paid' || st === 'đã thanh toán';
        })
        .reduce((sum, p) => sum + parseCurrencyInput(p.net_payable || p.certified_amount || p.certified_value), 0);

    // Card 4: Total Paid = sum of paid_amount for Paid IPCs
    const totalPaid = payments
        .filter(p => {
            const st = (p.status || '').toLowerCase();
            return st === 'paid' || st === 'đã thanh toán';
        })
        .reduce((sum, p) => sum + parseCurrencyInput(p.paid_amount || p.net_payable), 0);

    return {
        totalActiveContracts,
        totalSubmitted,
        totalApproved,
        totalPaid,
    };
}

// ─────────────────────────────────────────────────────────────
// PAYMENT TREND CHART DATA (Monthly)
// ─────────────────────────────────────────────────────────────

/**
 * Aggregates IPC data into monthly buckets for the trend chart.
 * Returns arrays of { month, submitted, certified, paid } sorted by date.
 *
 * @param {Array} payments
 * @returns {{ categories: string[], submitted: number[], certified: number[], paid: number[] }}
 */
export function calcPaymentTrend(payments = []) {
    const monthMap = {};

    payments.forEach(p => {
        const dateStr = p.submission_date || p.created_at || '';
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap[key]) {
            monthMap[key] = { submitted: 0, certified: 0, paid: 0 };
        }
        monthMap[key].submitted += Number(p.gross_work_done) || 0;
        if (p.status === 'Approved' || p.status === 'Paid') {
            monthMap[key].certified += Number(p.net_payable) || Number(p.certified_value) || 0;
        }
        if (p.status === 'Paid') {
            monthMap[key].paid += Number(p.paid_amount) || Number(p.net_payable) || 0;
        }
    });

    const sortedKeys = Object.keys(monthMap).sort();
    return {
        categories: sortedKeys.map(k => {
            const [yr, mo] = k.split('-');
            return `T${mo}/${yr}`;
        }),
        submitted: sortedKeys.map(k => Math.round(monthMap[k].submitted)),
        certified: sortedKeys.map(k => Math.round(monthMap[k].certified)),
        paid: sortedKeys.map(k => Math.round(monthMap[k].paid)),
    };
}

// ─────────────────────────────────────────────────────────────
// PENDING IPCs (Awaiting Action)
// ─────────────────────────────────────────────────────────────

/**
 * Returns IPCs that are pending action (Draft or Reviewing), sorted by due_date ascending.
 * @param {Array} payments
 * @returns {Array}
 */
export function calcPendingIPCs(payments = []) {
    return payments
        .filter(p => p.status === 'Draft' || p.status === 'Reviewing')
        .sort((a, b) => {
            const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
            const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
            return da - db;
        });
}

// ─────────────────────────────────────────────────────────────
// HELPER: Days Until Due
// ─────────────────────────────────────────────────────────────

/**
 * Returns number of days until due_date (negative = overdue).
 * @param {string} dueDateStr
 * @returns {number|null}
 */
export function daysToDue(dueDateStr) {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    if (isNaN(due)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / (1000 * 60 * 60 * 24));
}
