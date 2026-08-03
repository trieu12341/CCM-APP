import { state, formatCurrencyDetailed, formatCurrency, formatCurrencyVND, getContractBudgetValue, getDynamicContractValue } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { calculateForecastEngine, syncCashflowWithPayment, calculatePackageTotalPlanned } from './cashflow-calc.js';
import { createCashflowRowNode } from './cashflow-ui-row.js';

let currentSelectedPackageId = null;

const getContractId = (c) => String(c.id || c.contract_id || c.package_name);

export function updateCashflowSubtotal() {
    const tbody = document.getElementById('cashflow-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(.cf-group-header)');
    let total = 0;

    rows.forEach(tr => {
        // Only sum the actual Net Payable text elements.
        // During edit, the input value is Gross Work Done, which shouldn't be added to Net Payable.
        const textEl = tr.querySelector('.cf-text-value');
        if (textEl) {
            const val = parseFloat(textEl.textContent.replace(/,/g, ''));
            if (!isNaN(val)) total += val;
        } else {
            // For non-construction or missing text elements, fallback to input if it's not construction
            const valInput = tr.querySelector('.cf-value');
            if (valInput && !tr.querySelector('.col-amount').innerHTML.includes('WD:')) {
                const val = parseFloat(valInput.value.replace(/,/g, ''));
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
        if (!currentSelectedPackageId || !projectContracts.find(c => getContractId(c) === currentSelectedPackageId)) {
            currentSelectedPackageId = getContractId(projectContracts[0]);
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
        
        let totalPlan = calculatePackageTotalPlanned(cCashflows);
        let totalPaid = 0;
        cCashflows.forEach(cf => {
            const val = parseFloat(cf.netPayable) || parseFloat(cf.total_cert) || parseFloat(cf.value) || 0;
            if (cf.status === 'Paid') totalPaid += val;
        });

        const contractValue = getDynamicContractValue(c, state.appData);
        const progressPct = contractValue > 0 ? Math.min(100, (totalPaid / contractValue) * 100) : 0;

        const cid = getContractId(c);
        const card = document.createElement('div');
        card.className = `cf-package-card ${currentSelectedPackageId === cid ? 'active' : ''}`;
        card.dataset.id = cid;
        // Bug 3: Warning Icon
        const showWarning = (totalPlan !== contractValue || cCashflows.length === 0);
        
        card.innerHTML = `
            <div class="cf-pkg-code">${c.package_name}</div>
            <div class="cf-pkg-name">${c.type || 'Hợp đồng'}</div>
            <div class="cf-mini-progress">
                <div class="cf-mini-progress-bar" style="width: ${progressPct}%"></div>
            </div>
            ${showWarning ? '<i class="fa-solid fa-circle-exclamation text-warning" style="position: absolute; top: 8px; right: 8px; color: #f59e0b; font-size: 14px;" title="Chưa khớp Giá trị Hợp đồng hoặc chưa có Cashflow"></i>' : ''}
        `;
        card.addEventListener('click', (e) => {
            currentSelectedPackageId = e.currentTarget.dataset.id;
            // Remove active from all cards
            document.querySelectorAll('.cf-package-card').forEach(cardEl => cardEl.classList.remove('active'));
            // Add active to clicked card
            e.currentTarget.classList.add('active');
            
            // Re-render only the right pane
            renderRightPane(currentSelectedPackageId, contracts, cashflows);
        });
        listContainer.appendChild(card);
    });
}

function renderRightPane(contractId, contracts, allCashflows) {
    document.getElementById('cf-right-pane-empty').style.display = 'none';
    const container = document.getElementById('cf-right-pane-container');
    container.style.display = 'flex';

    const contract = contracts.find(c => getContractId(c) === contractId);
    if (!contract) return;

    const contractCashflows = allCashflows.filter(cf => cf.package_name === contract.package_name || cf.contract === contract.package_name);
    if (contract.type === 'Construction' && contractCashflows.length > 0) {
        calculateForecastEngine(contractCashflows, contract);
    }

    const contractValue = getDynamicContractValue(contract, state.appData);
    
    let totalPlan = calculatePackageTotalPlanned(contractCashflows);
    let totalCert = 0, totalPaid = 0;
    contractCashflows.forEach(cf => {
        const val = parseFloat(cf.netPayable) || parseFloat(cf.total_cert) || parseFloat(cf.value) || 0;
        if (cf.status === 'Certified') totalCert += val;
        if (cf.status === 'Paid') totalPaid += val;
    });

    // Update Header
    document.getElementById('cf-detail-title').textContent = `Gói thầu: ${contract.package_name}`;
    document.getElementById('cf-detail-type').textContent = contract.type || 'N/A';
    document.getElementById('cf-detail-status').textContent = contract.status || 'N/A';
    document.getElementById('cf-detail-contract-val').textContent = formatCurrency(contractValue);
    document.getElementById('cf-detail-planned-val').textContent = formatCurrency(totalPlan);

    // Smart Alert
    const alertEl = document.getElementById('cf-smart-alert');
    const alertText = document.getElementById('cf-smart-alert-text');
    const diff = Math.abs(Math.round(contractValue) - Math.round(totalPlan));
    
    if (diff > 1) {
        alertEl.style.display = 'flex';
        alertEl.style.backgroundColor = '#fffbeb'; // amber-50
        alertEl.style.color = '#b45309'; // amber-700
        alertEl.style.border = '1px solid #fcd34d'; // amber-300
        alertText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>Tổng Cashflow ${formatCurrencyDetailed(totalPlan)} chưa khớp với Giá trị Hợp đồng ${formatCurrencyDetailed(contractValue)}. Lệch ${formatCurrencyDetailed(diff)}.`;
    } else {
        alertEl.style.display = 'none';
        alertText.innerHTML = '';
    }

    // Sub-KPIs
    document.getElementById('cf-kpi-card-planned').innerHTML = `${formatCurrencyVND(totalPlan)} <span>VNĐ</span>`;
    document.getElementById('cf-kpi-card-certified').innerHTML = `${formatCurrencyVND(totalCert)} <span>VNĐ</span>`;
    document.getElementById('cf-kpi-card-paid').innerHTML = `${formatCurrencyVND(totalPaid)} <span>VNĐ</span>`;

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

    // Render Timeline View (Mini Gantt Chart)
    const timelineContainer = document.getElementById('cashflow-timeline-view');
    if (timelineContainer) {
        timelineContainer.innerHTML = '';
        timelineContainer.style.justifyContent = 'flex-start';
        timelineContainer.style.background = 'white';
        timelineContainer.style.overflowX = 'auto'; // allow horizontal scroll
        timelineContainer.style.overflowY = 'auto';
        timelineContainer.style.padding = '1.5rem';
        
        if (contractCashflows.length === 0) {
            timelineContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); width: 100%;">Chưa có dữ liệu Cashflow để hiển thị Timeline.</div>`;
            timelineContainer.style.alignItems = 'center';
            timelineContainer.style.justifyContent = 'center';
        } else {
            // Extract unique months
            const monthSet = new Set();
            contractCashflows.forEach(cf => {
                if (cf.date) {
                    const d = new Date(cf.date);
                    if (!isNaN(d.getTime())) {
                        const mKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                        monthSet.add(mKey);
                    }
                }
            });
            
            let months = Array.from(monthSet).sort();
            if (months.length === 0) months = ['Chưa có ngày'];

            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: separate; border-spacing: 0; min-width: 800px; font-size: 0.9rem;';
            
            let thead = `<thead><tr>
                <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left; width: 160px; background: #f8fafc; position: sticky; left: 0; z-index: 2;">Đợt thanh toán</th>
                <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: right; width: 140px; background: #f8fafc; position: sticky; left: 160px; z-index: 2; border-right: 1px solid #cbd5e1;">Giá trị (VNĐ)</th>
            `;
            months.forEach(m => {
                const displayLabel = m === 'Chưa có ngày' ? m : m.split('-').reverse().join('/');
                thead += `<th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: center; color: #64748b; font-weight: 600; min-width: 130px;">${displayLabel}</th>`;
            });
            thead += `</tr></thead>`;
            
            let tbody = `<tbody>`;
            const sortedFlows = [...contractCashflows].sort((a,b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });

            sortedFlows.forEach(cf => {
                const valStr = (parseFloat(cf.value) || 0).toLocaleString('en-US');
                let mKey = 'Chưa có ngày';
                if (cf.date) {
                    const d = new Date(cf.date);
                    if (!isNaN(d.getTime())) mKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                }

                let barColor = '#94a3b8'; // Planned
                if (cf.status === 'Paid') barColor = '#10b981';
                else if (cf.status === 'Certified') barColor = '#f59e0b';

                tbody += `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; background: white; position: sticky; left: 0; z-index: 1;">
                        <strong style="color: var(--text-dark);">${cf.code || 'N/A'}</strong><br>
                        <small style="color: ${barColor}; border: 1px solid ${barColor}; border-radius: 4px; padding: 1px 4px; margin-top: 4px; display: inline-block;">${cf.status || 'Planned'}</small>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: var(--text-dark); background: white; position: sticky; left: 160px; z-index: 1; border-right: 1px solid #cbd5e1;">${valStr}</td>
                `;

                months.forEach(m => {
                    if (m === mKey) {
                        tbody += `<td style="padding: 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px dashed #e2e8f0; position: relative;">
                            <div style="background-color: ${barColor}; height: 26px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 96%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600;" title="${cf.desc || 'Không có diễn giải'}">
                                ${valStr}
                            </div>
                        </td>`;
                    } else {
                        tbody += `<td style="padding: 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px dashed #e2e8f0;"></td>`;
                    }
                });
                tbody += `</tr>`;
            });
            tbody += `</tbody>`;

            table.innerHTML = thead + tbody;
            timelineContainer.appendChild(table);
            timelineContainer.style.alignItems = 'flex-start';
        }
    }

    updateCashflowSubtotal();
}
