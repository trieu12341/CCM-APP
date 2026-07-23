let appData = {};
let currentProjectId = null;
let currentTenderDetailId = null;
let currentRoundIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        let response = null;
        try {
            response = await fetch('/api/data');
        } catch (e) {
            console.warn('Backend server not running, falling back to static data.json');
        }
        
        if (response && response.ok) {
            appData = await response.json();
        } else {
            // Fallback for local testing without server
            const localResponse = await fetch('data.json');
            appData = await localResponse.json();
        }
        
        if (appData && appData.Projects.length > 0) {
            currentProjectId = appData.Projects[0].project_id;
        }

        renderProjectTabs();
        renderDashboard();
        setupEventListeners();

    } catch (error) {
        console.error('Error loading data:', error);
    }
});

const formatCurrency = (value) => {
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    if (value >= 1000) {
        return '$' + (value / 1000).toFixed(0) + 'K';
    }
    return '$' + value;
};

const formatCurrencyVND = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
};

const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

function renderProjectTabs() {
    const container = document.getElementById('project-tabs-container');
    if (!container) return;
    container.innerHTML = '';
    
    appData.Projects.forEach(project => {
        const btn = document.createElement('button');
        btn.className = `project-tab ${project.project_id === currentProjectId ? 'active' : ''}`;
        btn.textContent = `[${project.project_name}]`;
        btn.onclick = () => {
            currentProjectId = project.project_id;
            renderProjectTabs();
            renderDashboard();
        };
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'project-tab';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm dự án';
    addBtn.onclick = () => {
        document.getElementById('new-project-form').reset();
        document.getElementById('new-project-modal').classList.remove('hidden');
    };
    container.appendChild(addBtn);
}

function renderDashboard() {
    if (!appData || !currentProjectId) return;

    const project = appData.Projects.find(p => p.project_id === currentProjectId);
    if (!project) return;

    document.getElementById('project-name').textContent = project.project_name;
    
    const metaElement = document.querySelector('.project-meta');
    if (metaElement) {
        const start = project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '1 January 2024';
        const end = project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '1 December 2024';
        const loc = project.location || 'Belgrade, Serbia';
        metaElement.textContent = `${start} - ${end} • ${loc}`;
    }
    
    const totalBudget = project.total_budget + project.contingency_budget;
    document.getElementById('metric-total-budget').textContent = formatCurrency(totalBudget);
    
    let allocatedBudget = 0;
    const projectContracts = appData.Contracts.filter(c => c.project_id === currentProjectId);

    projectContracts.forEach(contract => {
        allocatedBudget += contract.original_value;
        const variations = appData.Variations.filter(v => v.contract_id === contract.contract_id && v.status === 'Approved');
        variations.forEach(v => allocatedBudget += v.vo_amount);
    });
    document.getElementById('metric-allocated').textContent = formatCurrency(allocatedBudget);
    
    document.getElementById('metric-contingency').textContent = formatCurrency(project.contingency_budget) + ' - 10%';
    
    let totalPayments = 0;
    appData.Payment_Claims.forEach(claim => {
        if (claim.status === 'Approved' && projectContracts.some(c => c.contract_id === claim.contract_id)) {
            totalPayments += claim.claimed_amount;
        }
    });
    document.getElementById('metric-payments').textContent = formatCurrency(totalPayments);
    
    document.getElementById('metric-projected').textContent = formatCurrency(totalBudget - project.contingency_budget + totalPayments);

    // Render Table (Budget Breakdown)
    const tbody = document.getElementById('breakdown-tbody');
    tbody.innerHTML = ''; 
    projectContracts.forEach(contract => {
        let expended = 0;
        appData.Payment_Claims.filter(p => p.contract_id === contract.contract_id && p.status === 'Approved').forEach(p => {
            expended += p.claimed_amount;
        });
        
        const budgeted = contract.original_value;
        const committed = contract.original_value; 
        const varianceVal = budgeted - committed - expended;

        const progress = contract.original_value > 0 ? (expended / contract.original_value) * 100 : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${contract.contract_name}</td>
            <td>${formatCurrency(budgeted)}</td>
            <td>${formatCurrency(committed)}</td>
            <td>${formatCurrency(expended)}</td>
            <td class="${varianceVal < 0 ? 'negative' : ''}">${varianceVal < 0 ? '-' : ''}${formatCurrency(Math.abs(varianceVal))}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add a total row
    const trTotal = document.createElement('tr');
    const totalVariance = totalBudget - allocatedBudget - totalPayments;
    trTotal.innerHTML = `
        <td><strong>Total</strong></td>
        <td><strong>${formatCurrency(totalBudget)}</strong></td>
        <td><strong>${formatCurrency(allocatedBudget)}</strong></td>
        <td><strong>${formatCurrency(totalPayments)}</strong></td>
        <td class="${totalVariance < 0 ? 'negative' : ''}"><strong>${totalVariance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalVariance))}</strong></td>
        <td></td>
    `;
    tbody.appendChild(trTotal);

    // Populate Documents
    const docsGrid = document.getElementById('documents-grid');
    const uploader = docsGrid.querySelector('.document-upload');
    if (docsGrid) {
        docsGrid.innerHTML = '';
        
        appData.Documents.filter(d => projectContracts.some(c => c.contract_id === d.related_id)).forEach(doc => {
            const isPdf = doc.file_name.endsWith('.pdf');
            const docCard = document.createElement('div');
            docCard.className = 'doc-card';
            docCard.innerHTML = `
                <div class="doc-icon ${isPdf ? 'pdf' : 'excel'}">
                    <i class="fa-regular ${isPdf ? 'fa-file-pdf' : 'fa-file-excel'}"></i>
                </div>
                <div class="doc-info">
                    <h5>${doc.file_name}</h5>
                    <span>2MB - ${isPdf ? 'PDF' : 'DOC'}</span>
                </div>
            `;
            docsGrid.appendChild(docCard);
        });
        if (uploader) docsGrid.appendChild(uploader);
    }

    renderActivities();
    renderTenders();
}

function renderTenders() {
    if (!appData.Tenders) appData.Tenders = [];
    
    const tenders = appData.Tenders.filter(t => t.project_id === currentProjectId);
    
    let total = tenders.length;
    let floating = tenders.filter(t => t.status === 'Floating').length;
    let evaluating = tenders.filter(t => t.status === 'Evaluating' || t.status === 'Bidding').length;
    let awarded = tenders.filter(t => t.status === 'Awarded').length;
    
    const elTotal = document.getElementById('tender-kpi-total');
    if (elTotal) elTotal.textContent = total;
    const elFloating = document.getElementById('tender-kpi-floating');
    if (elFloating) elFloating.textContent = floating;
    const elEvaluating = document.getElementById('tender-kpi-evaluating');
    if (elEvaluating) elEvaluating.textContent = evaluating;
    const elAwarded = document.getElementById('tender-kpi-awarded');
    if (elAwarded) elAwarded.textContent = awarded;
    
    const tbody = document.getElementById('tender-tbody');
    if(tbody) {
        tbody.innerHTML = '';
        tenders.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.tender_id}</td>
                <td>${t.tender_name}</td>
                <td>${formatCurrency(t.approved_budget)}</td>
                <td>${formatDate(t.deadline)}</td>
                <td><span class="status-badge ${t.status.toLowerCase()}">${t.status}</span></td>
                <td>${t.winner || '-'}</td>
            `;
            tr.style.cursor = 'pointer';
            tr.onclick = () => openTenderDetail(t.tender_id);
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// TENDER DETAIL & CBA LOGIC
// ==========================================

function openTenderDetail(tenderId) {
    currentTenderDetailId = tenderId;
    const tender = appData.Tenders.find(t => t.tender_id === tenderId);
    if (!tender) return;

    // View Switching
    document.getElementById('tender-list-view').classList.add('hidden');
    document.getElementById('tender-detail-view').classList.remove('hidden');

    // Populate Overview
    document.getElementById('detail-tender-name').textContent = tender.tender_name || '-';
    document.getElementById('detail-tender-code').textContent = tender.tender_id || '-';
    document.getElementById('detail-tender-status').textContent = tender.status || '-';
    document.getElementById('detail-tender-deadline').textContent = tender.deadline ? formatDate(tender.deadline) : '-';
    document.getElementById('detail-tender-winner').textContent = tender.winner || 'Chưa chốt';
    document.getElementById('detail-tender-final-price').textContent = tender.final_price ? formatCurrency(tender.final_price) : '-';

    // Handle Empty State vs Table
    if (!tender.cba || tender.cba.rounds.length === 0) {
        document.getElementById('cba-empty-state').classList.remove('hidden');
        document.getElementById('cba-table-view').classList.add('hidden');
        document.getElementById('tender-rounds-tabs').innerHTML = '';
    } else {
        document.getElementById('cba-empty-state').classList.add('hidden');
        document.getElementById('cba-table-view').classList.remove('hidden');
        currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
    }
}

function initCBA() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender) return;
    
    tender.cba = {
        bidders: [],
        rounds: [
            {
                round_name: "Round 1",
                items: []
            }
        ]
    };
    
    document.getElementById('cba-empty-state').classList.add('hidden');
    document.getElementById('cba-table-view').classList.remove('hidden');
    currentRoundIndex = 0;
    renderTenderRoundTabs();
    renderCBATable();
}

function renderTenderRoundTabs() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    const tabsContainer = document.getElementById('tender-rounds-tabs');
    tabsContainer.innerHTML = '';
    
    tender.cba.rounds.forEach((round, index) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'tab' + (index === currentRoundIndex ? ' active' : '');
        a.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${round.round_name}`;
        a.onclick = (e) => {
            e.preventDefault();
            currentRoundIndex = index;
            renderTenderRoundTabs();
            renderCBATable();
        };
        tabsContainer.appendChild(a);
    });
}

function parseFormattedNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

function formatInputNumber(input) {
    let val = parseFormattedNumber(input.value);
    if (val !== 0 || input.value.trim() !== '') {
        input.value = formatCurrencyVND(val);
    }
}

function renderCBATable() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    const round = tender.cba.rounds[currentRoundIndex];
    const bidders = tender.cba.bidders;
    
    const theadTr = document.getElementById('cba-thead-tr');
    let theadHtml = `
        <th style="width: 50px;">STT</th>
        <th style="width: 250px;">DIỄN GIẢI</th>
        <th style="width: 150px; text-align: right; background: #e0f2fe; color: #0284c7;">PTE (Giá TV)</th>
    `;
    bidders.forEach((bidder, idx) => {
        theadHtml += `<th style="width: 150px; text-align: right; position: relative; padding-right: 25px;">
            <input type="text" value="${bidder}" onchange="updateBidderName(${idx}, this.value)" placeholder="Tên Nhà thầu" style="text-align: right; font-weight: bold;">
            <button onclick="removeBidder(${idx})" class="btn-remove-col" title="Xóa cột này">❌</button>
        </th>`;
    });
    theadHtml += `<th style="width: 40px;"></th>`;
    theadTr.innerHTML = theadHtml;

    const tbody = document.getElementById('cba-tbody');
    tbody.innerHTML = '';

    round.items.forEach((item, itemIdx) => {
        let tr = document.createElement('tr');
        let pteVal = item.pte ? formatCurrencyVND(item.pte) : '';
        let tdHtml = `
            <td>${itemIdx + 1}</td>
            <td><input type="text" value="${item.description || ''}" onchange="updateItemDesc(${itemIdx}, this.value)" placeholder="VD: Bill 1 Preliminaries"></td>
            <td><input type="text" value="${pteVal}" oninput="updateItemValue(${itemIdx}, 'pte', this.value)" onblur="formatInputNumber(this)" placeholder="0"></td>
        `;
        
        bidders.forEach((bidder, bIdx) => {
            let val = (item.bids && item.bids[bidder]) ? item.bids[bidder] : 0;
            let formattedVal = val ? formatCurrencyVND(val) : '';
            tdHtml += `<td><input type="text" value="${formattedVal}" oninput="updateItemValue(${itemIdx}, '${bidder}', this.value)" onblur="formatInputNumber(this)" placeholder="0"></td>`;
        });
        
        tdHtml += `<td style="text-align: center;"><button onclick="removeItem(${itemIdx})" class="btn-remove-row" title="Xóa hàng này">🗑️</button></td>`;
        tr.innerHTML = tdHtml;
        tbody.appendChild(tr);
    });

    recalculateCBA();
}

function recalculateCBA() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const round = tender.cba.rounds[currentRoundIndex];
    const bidders = tender.cba.bidders;

    let sumPTE = 0;
    let sumBidders = new Array(bidders.length).fill(0);

    round.items.forEach((item) => {
        sumPTE += (item.pte || 0);
        bidders.forEach((bidder, bIdx) => {
            let val = (item.bids && item.bids[bidder]) ? item.bids[bidder] : 0;
            sumBidders[bIdx] += val;
        });
    });

    const tfoot = document.getElementById('cba-tfoot');
    let tfootSumHtml = `
        <tr>
            <td colspan="2">TỔNG CỘNG (TOTAL)</td>
            <td style="text-align: right; background: #e0f2fe; color: #0284c7;">${formatCurrencyVND(sumPTE)}</td>
    `;
    
    let tfootVarHtml = `
        <tr>
            <td colspan="2">Chênh lệch so với PTE</td>
            <td style="text-align: right; background: #e0f2fe; color: #0284c7;">-</td>
    `;

    bidders.forEach((bidder, bIdx) => {
        tfootSumHtml += `<td style="text-align: right;">${formatCurrencyVND(sumBidders[bIdx])}</td>`;
        
        let variance = sumBidders[bIdx] - sumPTE;
        let varPercent = sumPTE === 0 ? 0 : (variance / sumPTE * 100);
        let colorClass = variance > 0 ? "text-orange" : "text-green";
        let sign = variance > 0 ? "+" : "";
        
        tfootVarHtml += `<td style="text-align: right;" class="variance-cell ${colorClass}">
            ${sign}${formatCurrencyVND(variance)}<br>
            <small>${sign}${varPercent.toFixed(2)}%</small>
        </td>`;
    });
    
    tfootSumHtml += `<td></td></tr>`;
    tfootVarHtml += `<td></td></tr>`;
    tfoot.innerHTML = tfootSumHtml + tfootVarHtml;
}

function updateBidderName(bIdx, newName) {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender) return;
    
    const oldName = tender.cba.bidders[bIdx];
    tender.cba.bidders[bIdx] = newName || `Bidder ${bIdx+1}`;
    
    // Update keys in items
    tender.cba.rounds.forEach(round => {
        round.items.forEach(item => {
            if (item.bids && item.bids.hasOwnProperty(oldName)) {
                item.bids[newName] = item.bids[oldName];
                delete item.bids[oldName];
            }
        });
    });
    
    renderCBATable();
}

function updateItemDesc(itemIdx, desc) {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    tender.cba.rounds[currentRoundIndex].items[itemIdx].description = desc;
}

function updateItemValue(itemIdx, key, val) {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    const item = tender.cba.rounds[currentRoundIndex].items[itemIdx];
    
    let numVal = parseFormattedNumber(val);
    
    if (key === 'pte') {
        item.pte = numVal;
    } else {
        if (!item.bids) item.bids = {};
        item.bids[key] = numVal;
    }
    
    recalculateCBA(); // Only recalculate totals to preserve focus
}

function addBidder() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const count = tender.cba.bidders.length + 1;
    tender.cba.bidders.push(`Nhà thầu ${count}`);
    renderCBATable();
}

function addItem() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    tender.cba.rounds[currentRoundIndex].items.push({
        description: "",
        pte: 0,
        bids: {}
    });
    renderCBATable();
}

function removeBidder(bIdx) {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const bidderName = tender.cba.bidders[bIdx];
    
    tender.cba.bidders.splice(bIdx, 1);
    
    tender.cba.rounds.forEach(round => {
        round.items.forEach(item => {
            if (item.bids && item.bids.hasOwnProperty(bidderName)) {
                delete item.bids[bidderName];
            }
        });
    });
    
    renderCBATable();
}

function removeItem(itemIdx) {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    tender.cba.rounds[currentRoundIndex].items.splice(itemIdx, 1);
    renderCBATable();
}

async function saveTenderDetail() {
    const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender) return;

    try {
        const response = await fetch('/api/tenders/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tender)
        });

        if (response.ok) {
            alert('Đã lưu cập nhật gói thầu thành công!');
            renderTenders(); // Refresh list to catch any changes
        } else {
            alert('Lưu thất bại!');
        }
    } catch (error) {
        console.error("Error saving tender detail:", error);
    }
}

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length < 1) return;
        
        const headers = json[0];
        
        const pteIndex = headers.findIndex(h => h && h.toString().trim().toUpperCase() === 'PTE') !== -1 
            ? headers.findIndex(h => h && h.toString().trim().toUpperCase() === 'PTE') 
            : 2;
            
        const descIndex = headers.findIndex(h => h && ['DESCRIPTION', 'DIỄN GIẢI', 'HẠNG MỤC', 'ITEM'].includes(h.toString().trim().toUpperCase())) !== -1
            ? headers.findIndex(h => h && ['DESCRIPTION', 'DIỄN GIẢI', 'HẠNG MỤC', 'ITEM'].includes(h.toString().trim().toUpperCase()))
            : 1;
            
        const bidders = [];
        const bidderIndices = [];
        headers.forEach((h, i) => {
            if (h && i !== pteIndex && i !== descIndex && i !== 0) {
                const headerText = h.toString().trim().toUpperCase();
                // Bỏ qua các cột thừa, không có ý nghĩa làm Nhà thầu
                if (!['TOTAL', 'SUM', 'GHI CHÚ', 'REMARK', 'REMARKS', 'ĐƠN VỊ', 'UNIT', 'SỐ LƯỢNG', 'QTY'].includes(headerText)) {
                    bidders.push(h.toString().trim());
                    bidderIndices.push(i);
                }
            }
        });
        
        const items = [];
        for (let r = 1; r < json.length; r++) {
            const row = json[r];
            if (!row || row.length === 0) continue;
            
            const description = row[descIndex] || "";
            const descText = description.toString().trim().toUpperCase();
            if (!descText && !row[pteIndex]) continue;
            
            // Tự động bỏ qua các dòng Tổng Cộng
            if (['TOTAL', 'TỔNG CỘNG', 'TOTAL AMOUNT', 'SUM', 'TỔNG', 'GRAND TOTAL'].some(keyword => descText.includes(keyword))) {
                continue;
            }
            
            const pte = parseFloat(row[pteIndex]) || 0;
            const bids = {};
            
            bidders.forEach((b, idx) => {
                bids[b] = parseFloat(row[bidderIndices[idx]]) || 0;
            });
            
            items.push({ description, pte, bids });
        }
        
        const tender = appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
        if (!tender) return;
        
        tender.cba = {
            bidders: bidders,
            rounds: [
                {
                    round_name: "Round 1",
                    items: items
                }
            ]
        };
        
        document.getElementById('cba-empty-state').classList.add('hidden');
        document.getElementById('cba-table-view').classList.remove('hidden');
        currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
        
        // Reset file input
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// Activity logic
const mockActivities = [
    { text: 'Initiate Payment Claims or VO approved', date: new Date().toISOString() }
];

function renderActivities() {
    const timeline = document.getElementById('activities-timeline');
    if(!timeline) return;
    timeline.innerHTML = '';
    mockActivities.forEach(act => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
            <div class="activity-dot"></div>
            <div class="activity-content">
                <p><strong>${act.text}</strong></p>
                <span>${formatDate(act.date)}</span>
            </div>
        `;
        timeline.appendChild(div);
    });
}

async function saveDataToServer() {
    try {
        await fetch('/api/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appData)
        });
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

function setupEventListeners() {
    // Module switching
    const modules = [
        { menu: 'menu-overview', mod: 'module-overview' },
        { menu: 'menu-budget', mod: 'module-budget' },
        { menu: 'menu-tender', mod: 'module-tender' },
        { menu: 'menu-contract', mod: 'module-contract' },
        { menu: 'menu-payment', mod: 'module-payment' },
        { menu: 'menu-vo', mod: 'module-vo' },
        { menu: 'menu-final', mod: 'module-final' }
    ];

    // Detail view button listeners
    const btnBackTender = document.getElementById('btn-back-tender');
    if (btnBackTender) {
        btnBackTender.addEventListener('click', () => {
            document.getElementById('tender-detail-view').classList.add('hidden');
            document.getElementById('tender-list-view').classList.remove('hidden');
            currentTenderDetailId = null;
        });
    }

    const btnInitCBA = document.getElementById('btn-init-cba');
    if (btnInitCBA) btnInitCBA.addEventListener('click', initCBA);

    const btnAddBidder = document.getElementById('btn-add-bidder');
    if (btnAddBidder) btnAddBidder.addEventListener('click', addBidder);

    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) btnAddItem.addEventListener('click', addItem);

    const btnSaveCBA = document.getElementById('btn-save-cba');
    if (btnSaveCBA) btnSaveCBA.addEventListener('click', saveTenderDetail);
    
    const btnImportExcel = document.getElementById('btn-import-excel');
    const excelUploadInput = document.getElementById('excel-upload-input');
    if (btnImportExcel && excelUploadInput) {
        btnImportExcel.addEventListener('click', () => excelUploadInput.click());
        excelUploadInput.addEventListener('change', handleExcelUpload);
    }

    modules.forEach(m => {
        const menuEl = document.getElementById(m.menu);
        if (menuEl) {
            menuEl.addEventListener('click', (e) => {
                e.preventDefault();
                modules.forEach(x => {
                    const elMenu = document.getElementById(x.menu);
                    const elMod = document.getElementById(x.mod);
                    if (elMenu) elMenu.classList.remove('active');
                    if (elMod) elMod.classList.add('hidden');
                });
                menuEl.classList.add('active');
                const modEl = document.getElementById(m.mod);
                if (modEl) modEl.classList.remove('hidden');
            });
        }
    });

    const paymentModal = document.getElementById('payment-modal');
    const newEntryModal = document.getElementById('new-entry-modal');
    
    // Payment Claim logic
    const openPaymentModal = () => {
        const select = document.getElementById('contract-select');
        select.innerHTML = '';
        appData.Contracts.filter(c => c.project_id === currentProjectId).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.contract_id;
            opt.textContent = c.contract_name;
            select.appendChild(opt);
        });
        document.getElementById('payment-amount').value = '';
        paymentModal.classList.remove('hidden');
    };
    
    document.getElementById('btn-initiate-payment').addEventListener('click', openPaymentModal);
    document.getElementById('close-modal').addEventListener('click', () => paymentModal.classList.add('hidden'));
    document.getElementById('cancel-modal').addEventListener('click', () => paymentModal.classList.add('hidden'));
    
    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const contractId = document.getElementById('contract-select').value;
        const amount = parseFloat(document.getElementById('payment-amount').value);
        
        if (!amount || amount <= 0) return;
        
        appData.Payment_Claims.push({
            claim_id: "PC" + (appData.Payment_Claims.length + 1).toString().padStart(3, '0'),
            contract_id: contractId,
            period_number: 1, 
            claimed_amount: amount,
            advance_deduction: 0,
            retention_amount: 0,
            status: "Approved"
        });
        
        const contractName = appData.Contracts.find(c => c.contract_id === contractId)?.contract_name;
        mockActivities.unshift({
            text: `Payment Claim Approved: $${amount.toLocaleString()} for ${contractName}`,
            date: new Date().toISOString()
        });
        
        await saveDataToServer();
        renderDashboard();
        paymentModal.classList.add('hidden');
    });

    // New Entry (Category) logic
    const openEntryModal = () => {
        document.getElementById('entry-category').value = '';
        document.getElementById('entry-amount').value = '';
        newEntryModal.classList.remove('hidden');
    };

    document.getElementById('btn-new-entry').addEventListener('click', openEntryModal);
    document.getElementById('close-entry-modal').addEventListener('click', () => newEntryModal.classList.add('hidden'));
    document.getElementById('cancel-entry-modal').addEventListener('click', () => newEntryModal.classList.add('hidden'));

    document.getElementById('new-entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = document.getElementById('entry-category').value;
        const amount = parseFloat(document.getElementById('entry-amount').value);

        if (!categoryName || !amount || amount <= 0) return;

        const newContract = {
            contract_id: "C" + (appData.Contracts.length + 1).toString().padStart(3, '0'),
            project_id: currentProjectId,
            contract_name: categoryName,
            vendor_name: "TBD", // default
            original_value: amount,
            advance_rate: 0,
            retention_rate: 0
        };

        appData.Contracts.push(newContract);

        mockActivities.unshift({
            text: `New Budget Entry added: ${categoryName} for $${amount.toLocaleString()}`,
            date: new Date().toISOString()
        });

        await saveDataToServer();
        renderDashboard();
        newEntryModal.classList.add('hidden');
    });

    // New Project Modal logic
    const newProjectModal = document.getElementById('new-project-modal');
    if (newProjectModal) {
        document.getElementById('close-project-modal').addEventListener('click', () => newProjectModal.classList.add('hidden'));
        document.getElementById('cancel-project-modal').addEventListener('click', () => newProjectModal.classList.add('hidden'));

        document.getElementById('new-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('proj-name').value;
            const location = document.getElementById('proj-location').value;
            const start = document.getElementById('proj-start').value;
            const end = document.getElementById('proj-end').value;
            const budget = parseFloat(document.getElementById('proj-budget').value);
            const contingency = parseFloat(document.getElementById('proj-contingency').value);
            
            const newId = "P" + (appData.Projects.length + 1).toString().padStart(3, '0');
            
            const newProject = {
                project_id: newId,
                project_name: name,
                location: location,
                start_date: start,
                end_date: end,
                total_budget: budget,
                contingency_budget: contingency
            };
            
            try {
                const response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProject)
                });
                
                if (response.ok) {
                    appData.Projects.push(newProject);
                    currentProjectId = newId;
                    renderProjectTabs();
                    renderDashboard();
                    newProjectModal.classList.add('hidden');
                }
            } catch (err) {
                console.error("Lỗi khi thêm dự án:", err);
            }
        });
    }

    // New Tender Modal logic
    const newTenderModal = document.getElementById('new-tender-modal');
    if (newTenderModal) {
        const btnNewTender = document.getElementById('btn-new-tender');
        if (btnNewTender) {
            btnNewTender.addEventListener('click', () => {
                document.getElementById('new-tender-form').reset();
                newTenderModal.classList.remove('hidden');
            });
        }
        document.getElementById('close-tender-modal').addEventListener('click', () => newTenderModal.classList.add('hidden'));
        document.getElementById('cancel-tender-modal').addEventListener('click', () => newTenderModal.classList.add('hidden'));

        document.getElementById('new-tender-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!appData.Tenders) appData.Tenders = [];
            
            const code = document.getElementById('tender-code').value;
            const name = document.getElementById('tender-name').value;
            const budget = parseFloat(document.getElementById('tender-budget').value);
            const status = document.getElementById('tender-status').value;
            const deadline = document.getElementById('tender-deadline').value;
            
            const newTender = {
                tender_id: code,
                project_id: currentProjectId,
                tender_name: name,
                approved_budget: budget,
                status: status,
                deadline: deadline,
                winner: ""
            };
            
            try {
                const response = await fetch('/api/tenders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTender)
                });
                
                if (response.ok) {
                    appData.Tenders.push(newTender);
                    renderTenders();
                    newTenderModal.classList.add('hidden');
                }
            } catch (err) {
                console.error("Lỗi khi thêm gói thầu:", err);
            }
        });
    }
}
