const getToken = () => localStorage.getItem('jwt_token');

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(url, { ...options, headers });
        
        if (res.status === 401) {
            localStorage.removeItem('jwt_token');
            // Let app.js handle showing the modal or we can dispatch an event
            window.dispatchEvent(new Event('auth-unauthorized'));
            return res;
        }
        
        if (res.status === 403) {
            alert('Lỗi phân quyền: Bạn không có quyền thực hiện thao tác này (Role manager chỉ được xem)!');
            return res;
        }
        
        return res;
    } catch (error) {
        console.warn(`[Network Error] Failed to fetch ${url}`, error);
        // Mock a failed response to allow fallbacks to trigger
        return { ok: false, status: 503, statusText: 'Service Unavailable' };
    }
}

export async function apiLogin(username, password) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return res;
}

export async function apiGetMe() {
    return authFetch('/api/me');
}

export async function fetchProjects() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return { Projects: [] };
    const res = await authFetch('/api/projects');
    return res.ok ? await res.json() : { Projects: [] };
}

export async function fetchBudget() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return { Budgets: [], Contracts: [], Variations: [], Documents: [] };
    const res = await authFetch('/api/budget');
    return res.ok ? await res.json() : { Contracts: [], Variations: [], Documents: [] };
}

export async function fetchTenders() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return { Tenders: [] };
    const res = await authFetch('/api/tenders');
    return res.ok ? await res.json() : { Tenders: [] };
}

export async function fetchContracts() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return [];
    const res = await authFetch('/api/contracts');
    return res.ok ? await res.json() : [];
}

export async function fetchCashflow() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return [];
    const res = await authFetch('/api/cashflow');
    return res.ok ? await res.json() : [];
}

export async function fetchPayments() {
    if (localStorage.getItem('ccm_user_reset_cleared') === 'true') return [];
    const res = await authFetch('/api/payments');
    return res.ok ? await res.json() : [];
}

export async function saveProject(project) {
    const res = await authFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(project)
    });
    return res.ok;
}

export async function saveTender(tender) {
    const res = await authFetch('/api/tenders', {
        method: 'POST',
        body: JSON.stringify(tender)
    });
    return res.ok;
}

export async function updateTender(tender) {
    const res = await authFetch('/api/tenders/update', {
        method: 'POST',
        body: JSON.stringify(tender)
    });
    return res.ok;
}

export async function saveBudget(budgetData) {
    const res = await authFetch('/api/budget', {
        method: 'POST',
        body: JSON.stringify(budgetData)
    });
    return res.ok;
}

export async function saveContracts(contracts) {
    const res = await authFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify(contracts)
    });
    return res.ok;
}

export async function saveCashflow(cashflowData) {
    const res = await authFetch('/api/cashflow', {
        method: 'POST',
        body: JSON.stringify(cashflowData)
    });
    return res.ok;
}

export async function savePayments(paymentsData) {
    const res = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify(paymentsData)
    });
    return res.ok;
}
