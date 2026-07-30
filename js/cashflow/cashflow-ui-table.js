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
        if (!currentSelectedPackageId || !projectContracts.find(c => String(c.id) === String(currentSelectedPackageId))) {
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
        card.className = `cf-package-card ${String(currentSelectedPackageId) === String(c.id) ? 'active' : ''}`;
        card.dataset.id = c.id;
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
            document.querySelectorAll('.cf-package-card').forEach(card => card.classList.remove('active'));
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

    const contract = contracts.find(c => String(c.id) === String(contractId));
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

    // Render Timeline View
    const timelineContainer = document.getElementById('cashflow-timeline-view');
    if (timelineContainer) {
        timelineContainer.innerHTML = '';
        timelineContainer.style.justifyContent = 'flex-start';
        timelineContainer.style.background = 'white';
        timelineContainer.style.overflowY = 'auto';
        
        if (contractCashflows.length === 0) {
            timelineContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Chưa có dữ liệu Cashflow để hiển thị Timeline.</div>`;
            timelineContainer.style.alignItems = 'center';
            timelineContainer.style.justifyContent = 'center';
        } else {
            const timelineWrapper = document.createElement('div');
            timelineWrapper.style.cssText = 'padding: 2rem; width: 100%; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; position: relative;';
            timelineWrapper.innerHTML = `<div style="position: absolute; left: 2.45rem; top: 2.5rem; bottom: 2rem; width: 2px; background: #e2e8f0; z-index: 1;"></div>`;
            
            // Sort by date (handle missing dates by putting them at the end or beginning)
            const sortedFlows = [...contractCashflows].sort((a,b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });
            
            sortedFlows.forEach(cf => {
                let dotColor = '#94a3b8'; // Planned (gray)
                if (cf.status === 'Paid') dotColor = '#10b981'; // Green
                else if (cf.status === 'Certified') dotColor = '#f59e0b'; // Amber/Yellow
                
                const valStr = (parseFloat(cf.value) || 0).toLocaleString('en-US');
                let dateDisplay = '-';
                if (cf.date) {
                    const d = new Date(cf.date);
                    dateDisplay = (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
                }
                
                const itemHtml = `
                    <div style="display: flex; gap: 1.5rem; position: relative; z-index: 2;">
                        <div style="width: 1.2rem; height: 1.2rem; border-radius: 50%; background: ${dotColor}; margin-top: 0.35rem; border: 3px solid white; box-shadow: 0 0 0 1px #cbd5e1;"></div>
                        <div style="flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <strong style="color: var(--text-dark); font-size: 1.05rem;">${cf.code || 'N/A'}</strong>
                                <span style="font-size: 0.85rem; font-weight: 600; color: ${dotColor}; border: 1px solid ${dotColor}; padding: 2px 6px; border-radius: 12px; opacity: 0.9;">${cf.status || 'Planned'}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.75rem;">${cf.desc || 'Không có diễn giải'}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>${dateDisplay}</div>
                                <div style="font-weight: 700; color: var(--primary-blue); font-size: 1.05rem;">VNĐ ${valStr}</div>
                            </div>
                        </div>
                    </div>
                `;
                timelineWrapper.insertAdjacentHTML('beforeend', itemHtml);
            });
            timelineContainer.appendChild(timelineWrapper);
            timelineContainer.style.alignItems = 'flex-start';
        }
    }

    updateCashflowSubtotal();
}
