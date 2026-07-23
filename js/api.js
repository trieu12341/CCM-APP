export async function fetchProjects() {
    const res = await fetch('/api/projects');
    return res.ok ? await res.json() : { Projects: [] };
}

export async function fetchBudget() {
    const res = await fetch('/api/budget');
    return res.ok ? await res.json() : { Contracts: [], Payment_Claims: [], Variations: [], Documents: [] };
}

export async function fetchTenders() {
    const res = await fetch('/api/tenders');
    return res.ok ? await res.json() : { Tenders: [] };
}

export async function fetchContracts() {
    const res = await fetch('/api/contracts');
    return res.ok ? await res.json() : [];
}

export async function fetchCashflow() {
    const res = await fetch('/api/cashflow');
    return res.ok ? await res.json() : [];
}

export async function fetchPayments() {
    const res = await fetch('/api/payments');
    return res.ok ? await res.json() : [];
}

export async function saveProject(project) {
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
    });
    return res.ok;
}

export async function saveTender(tender) {
    const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tender)
    });
    return res.ok;
}

export async function updateTender(tender) {
    const res = await fetch('/api/tenders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tender)
    });
    return res.ok;
}

export async function saveBudget(budgetData) {
    const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetData)
    });
    return res.ok;
}

export async function saveContracts(contracts) {
    const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contracts)
    });
    return res.ok;
}

export async function saveCashflow(cashflowData) {
    const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cashflowData)
    });
    return res.ok;
}

export async function savePayments(paymentsData) {
    const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentsData)
    });
    return res.ok;
}
