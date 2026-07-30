import { state } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { calculateForecastEngine, syncCashflowWithPayment } from './cashflow-calc.js';
import { createCashflowRowNode } from './cashflow-ui-row.js';

let currentSelectedPackageId = null;

export function updateCashflowSubtotal() {
    const tbody = document.getElementById('cashflow-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(.cf-group-header)');
    let total = 0;

    rows.forEach(tr => {
        const valInput = tr.querySelector('.cf-value');
        if (valInput) {
            const val = parseFloat(valInput.value.replace(/,/g, ''));
            if (!isNaN(val)) total += val;
        } else {
            const textEl = tr.querySelector('.cf-text-value');
            if (textEl) {
                const val = parseFloat(textEl.textContent.replace(/,/g, ''));
                if (!isNaN(val)) total += val;
            }
        }
    });

    const footerTotal = document.getElementById('cf-grand-total-plan');
    if (footerTotal) {
        footerTotal.textContent = total.toLocaleString('en-US');
    }
}

export function renderCashflowTable() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    syncCashflowWithPayment(projectId);

    const allContracts = state.appData.Contracts || [];
    const projectContracts = allContracts.filter(c => c.project_id === projectId);
    
    const allCashflows = getLocalCashflow().filter(c => c.project_id === projectId);
    const contractsWithoutCashflow = projectContracts.filter(c => {
        return !allCashflows.some(cf => cf.package_name === c.package_name || cf.contract === c.package_name);
    }).length;

    const badge = document.getElementById('cf-left-warning-badge');
    if (badge) {
        if (contractsWithoutCashflow > 0) {
            badge.textContent = `${contractsWithoutCashflow} gói ⚠️`;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    renderPackageList(projectContracts, allCashflows);
    
    if (projectContracts.length > 0) {
        if (!currentSelectedPackageId || !projectContracts.find(c => c.id === currentSelectedPackageId)) {
            currentSelectedPackageId = projectContracts[0].id;
        }
        renderRightPane(currentSelectedPackageId, projectContracts, allCashflows);
    } else {
        document.getElementById('cf-right-pane-empty').style.display = 'flex';
        document.getElementById('cf-right-pane-container').style.display = 'none';
    }
}

export function getCurrentSelectedPackageId() {
    return currentSelectedPackageId;
}

function renderPackageList(contracts, cashflows) {
    const listContainer = document.getElementById('cf-package-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    contracts.forEach(c => {
        const cCashflows = cashflows.filter(cf => cf.package_name === c.package_name || cf.contract === c.package_name);
        
        let totalPlan = 0;
        let totalPaid = 0;
        cCashflows.forEach(cf => {
            const val = parseFloat(cf.value) || 0;
            totalPlan += val;
            if (cf.status === 'Paid') totalPaid += val;
        });

        const contractValue = parseFloat(c.total_value) || parseFloat(c.budget_value) || 0;
        const progressPct = contractValue > 0 ? Math.min(100, (totalPaid / contractValue) * 100) : 0;

        const card = document.createElement('div');
        card.className = `cf-package-card ${currentSelectedPackageId === c.id ? 'active' : ''}`;
        card.innerHTML = `
            <div class="cf-pkg-code">${c.package_name}</div>
            <div class="cf-pkg-name">${c.type || 'Hợp đồng'}</div>
            <div class="cf-mini-progress">
                <div class="cf-mini-progress-bar" style="width: ${progressPct}%"></div>
            </div>
        `;
        card.addEventListener('click', () => {
            currentSelectedPackageId = c.id;
            renderCashflowTable();
        });
        listContainer.appendChild(card);
    });
}

function renderRightPane(contractId, contracts, allCashflows) {
    document.getElementById('cf-right-pane-empty').style.display = 'none';
    const container = document.getElementById('cf-right-pane-container');
    container.style.display = 'flex';

    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const contractCashflows = allCashflows.filter(cf => cf.package_name === contract.package_name || cf.contract === contract.package_name);
    if (contract.type === 'Construction' && contractCashflows.length > 0) {
        calculateForecastEngine(contractCashflows, contract);
    }

    const contractValue = parseFloat(contract.total_value) || parseFloat(contract.budget_value) || 0;
    
    let totalPlan = 0, totalCert = 0, totalPaid = 0;
    contractCashflows.forEach(cf => {
        const val = parseFloat(cf.value) || 0;
        totalPlan += val;
        if (cf.status === 'Certified') totalCert += val;
        if (cf.status === 'Paid') totalPaid += val;
    });

    // Update Header
    document.getElementById('cf-detail-title').textContent = `Gói thầu: ${contract.package_name}`;
    document.getElementById('cf-detail-type').textContent = contract.type || 'N/A';
    document.getElementById('cf-detail-status').textContent = contract.status || 'N/A';
    document.getElementById('cf-detail-contract-val').textContent = contractValue.toLocaleString('en-US');
    document.getElementById('cf-detail-planned-val').textContent = totalPlan.toLocaleString('en-US');

    // Smart Alert
    const alertEl = document.getElementById('cf-smart-alert');
    const alertText = document.getElementById('cf-smart-alert-text');
    if (totalPlan !== contractValue) {
        const diff = Math.abs(contractValue - totalPlan);
        alertEl.style.display = 'flex';
        alertText.textContent = `Tổng Cashflow (${(totalPlan/1e6).toFixed(0)}M) chưa khớp với Giá trị Hợp đồng (${(contractValue/1e6).toFixed(0)}M). Lệch ${(diff/1e6).toFixed(0)}M.`;
    } else {
        alertEl.style.display = 'none';
    }

    // Sub-KPIs
    document.getElementById('cf-kpi-card-planned').textContent = totalPlan.toLocaleString('en-US');
    document.getElementById('cf-kpi-card-certified').textContent = totalCert.toLocaleString('en-US');
    document.getElementById('cf-kpi-card-paid').textContent = totalPaid.toLocaleString('en-US');

    // Progress Bar
    const totalDivisor = Math.max(contractValue, totalPlan) || 1;
    const paidPct = Math.min(100, (totalPaid / totalDivisor) * 100);
    const certPct = Math.min(100 - paidPct, (totalCert / totalDivisor) * 100);
    document.getElementById('cf-prog-paid-bar').style.width = `${paidPct}%`;
    document.getElementById('cf-prog-cert-bar').style.width = `${certPct}%`;

    // Toggle Add Release Button
    const btnAddRelease = document.getElementById('btn-add-release');
    if (btnAddRelease) {
        btnAddRelease.style.display = (contract.type === 'Construction') ? 'block' : 'none';
    }

    // Render Table Rows
    const tbody = document.getElementById('cashflow-tbody');
    tbody.innerHTML = '';
    
    if (contractCashflows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Chưa có dữ liệu cho gói thầu này.</td></tr>`;
    } else {
        contractCashflows.forEach(item => {
            const tr = createCashflowRowNode(item, false);
            tbody.appendChild(tr);
        });
    }

    updateCashflowSubtotal();
}
