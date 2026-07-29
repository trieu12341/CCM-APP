import { state } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { calculateForecastEngine, syncCashflowWithPayment } from './cashflow-calc.js';
import { createCashflowRowNode } from './cashflow-ui-row.js';

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

    const subtotalEl = document.getElementById('cf-subtotal');
    if (subtotalEl) {
        subtotalEl.textContent = total.toLocaleString('en-US');
    }

    const footerTotal = document.getElementById('cf-grand-total-plan');
    if (footerTotal) {
        footerTotal.textContent = total.toLocaleString('en-US');
    }
}

export function renderCashflowTable() {
    const tbody = document.getElementById('cashflow-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const projectId = state.currentProjectId;
    if (!projectId) return;

    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';

    const btnAddRelease = document.getElementById('btn-add-release');
    if (btnAddRelease) {
        if (selectedContract) {
            const allContracts = state.appData.Contracts || [];
            const c = allContracts.find(x => (x.package_name === selectedContract || x.contract === selectedContract) && x.project_id === projectId);
            if (c && c.type === 'Construction') {
                btnAddRelease.style.display = 'inline-block';
            } else {
                btnAddRelease.style.display = 'none';
            }
        } else {
            btnAddRelease.style.display = 'none';
        }
    }

    const searchInput = document.getElementById('cf-search-input');
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

    syncCashflowWithPayment(projectId);

    let items = getLocalCashflow().filter(c => c.project_id === projectId);

    if (selectedContract) {
        items = items.filter(c => c.package_name === selectedContract || c.contract === selectedContract);
    }

    if (searchVal) {
        items = items.filter(c =>
            (c.package_name && c.package_name.toLowerCase().includes(searchVal)) ||
            (c.code && c.code.toLowerCase().includes(searchVal)) ||
            (c.desc && c.desc.toLowerCase().includes(searchVal))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:1rem; color:var(--text-muted);">Chưa có dữ liệu. Bấm "+ Thêm Đợt Kế Hoạch" để bắt đầu hoặc Import từ Excel.</td></tr>`;
        updateCashflowSubtotal();
        return;
    }

    const allContracts = state.appData.Contracts || [];
    const constructionPackages = allContracts.filter(c => c.project_id === projectId && c.type === 'Construction');

    constructionPackages.forEach(contract => {
        const contractCashflows = items.filter(c => c.package_name === contract.package_name);
        if (contractCashflows.length > 0) {
            calculateForecastEngine(contractCashflows, contract);
        }
    });

    const grouped = items.reduce((acc, item) => {
        const pkg = item.package_name || 'Khác';
        if (!acc[pkg]) {
            const allContracts = state.appData.Contracts || [];
            const matchedContract = allContracts.find(c => c.package_name === pkg && c.project_id === state.currentProjectId);
            const contractTotal = matchedContract ? (Number(matchedContract.total_value) || Number(matchedContract.budget_value) || 0) : 0;

            acc[pkg] = { items: [], totalPlan: contractTotal };
        }
        acc[pkg].items.push(item);
        if (acc[pkg].totalPlan === 0 && (!state.appData.Contracts || !state.appData.Contracts.some(c => c.package_name === pkg && c.project_id === state.currentProjectId))) {
            acc[pkg].totalPlan += (Number(item.value) || 0);
        }
        return acc;
    }, {});

    Object.keys(grouped).forEach(pkgName => {
        const group = grouped[pkgName];

        const headerRow = document.createElement('tr');
        headerRow.className = 'cf-group-header';
        headerRow.innerHTML = `
            <td colspan="9">
                <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display:flex; align-items: center; gap: 0.5rem; color: var(--primary-blue);">
                        <i class="fa-solid fa-chevron-down group-toggle" style="width: 20px;"></i>
                        <span style="font-size: 1.05rem;">${pkgName}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-color); font-weight: normal; margin-right: 0.5rem;">Tổng giá trị:</span>
                        <span style="color: var(--primary-blue); font-size: 1.05rem;">${group.totalPlan.toLocaleString('en-US')} VNĐ</span>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(headerRow);

        const childRows = [];
        group.items.forEach(item => {
            const tr = createCashflowRowNode(item, false);
            tr.classList.add('cf-child-row');
            tbody.appendChild(tr);
            childRows.push(tr);
        });

        headerRow.addEventListener('click', (e) => {
            if (e.target.closest('.cf-edit-btn') || e.target.closest('.cf-del-btn')) return;
            const icon = headerRow.querySelector('.group-toggle');
            const isCollapsed = icon.classList.contains('fa-chevron-right');

            if (isCollapsed) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
                childRows.forEach(r => r.classList.remove('hidden'));
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
                childRows.forEach(r => r.classList.add('hidden'));
            }
        });
    });

    updateCashflowSubtotal();
}
