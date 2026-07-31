import { state } from '../app.js';
import { fetchProjects, fetchBudget, fetchTenders, fetchContracts, fetchCashflow, fetchPayments, apiLogin, apiGetMe } from '../api.js';
import { setupBudgetEvents, renderProjectTabs, renderDashboard } from '../budget.js';
import { setupTenderEvents } from '../tender.js';
import { setupContractEvents } from '../contract.js';
import { setupCashflowEvents, renderCashflow } from '../cashflow.js';
import { setupProjectSummaryEvents } from '../project.js';

// ─────────────────────────────────────────────────────────────
// Safe Event Binder — skips silently if element not in DOM
// ─────────────────────────────────────────────────────────────
function bindEvent(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`[app-init] Element #${id} not found — skipping.`);
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — called after all HTML components are loaded
// ─────────────────────────────────────────────────────────────

function showApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = '';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.add('hidden');
}

function hideApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = 'none';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
}

export async function initApp() {
    const loginModal = document.getElementById('login-modal');

    // ── 401 from API: force back to login ──
    window.addEventListener('auth-unauthorized', () => {
        hideApp();
        document.body.classList.remove('is-manager');
    });

    // ── Clear session link in login form ──
    document.getElementById('btn-clear-session')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('jwt_token');
        const errorEl = document.getElementById('login-error');
        if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Đã xóa session cũ. Vui lòng đăng nhập lại.'; }
    });

    // ─────────────────────────────────────────────────────
    // checkAuth: verifies existing JWT with /api/me
    // Returns true if authenticated, false otherwise.
    // NO bypass code — login is always required.
    // ─────────────────────────────────────────────────────
    const checkAuth = async () => {
        console.log("Current Auth State:", localStorage.getItem('jwt_token') ? "LOGGED IN" : "NOT LOGGED IN");
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            if (loginModal) loginModal.classList.remove('hidden');
            return false;
        }
        try {
            const res = await apiGetMe();
            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
                if (loginModal) loginModal.classList.add('hidden');

                // Update sidebar user info
                const nameEl = document.getElementById('user-name');
                const roleEl = document.getElementById('user-role');
                if (nameEl) nameEl.textContent = state.user.name || state.user.username || 'Triều';
                if (roleEl) roleEl.textContent = state.user.role || 'Quantity Surveyor';

                // Role-based CSS
                const isAdmin = ['manager', 'admin'].includes(state.user.role);
                document.body.classList.toggle('is-manager', isAdmin);
                showApp(); // Reveal main app only here
                return true;
            } else {
                if (loginModal) loginModal.classList.remove('hidden');
                return false;
            }
        } catch (err) {
            console.error('[checkAuth] Network error:', err);
            if (loginModal) loginModal.classList.remove('hidden');
            return false;
        }
    };

    // ─────────────────────────────────────────────────────
    // Login Form submit handler
    // ─────────────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username  = document.getElementById('login-username')?.value;
            const password  = document.getElementById('login-password')?.value;
            const errorMsg  = document.getElementById('login-error');
            const submitBtn = document.getElementById('btn-login-submit');

            if (!username || !password) return;

            try {
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng nhập...'; }
                const res = await apiLogin(username, password);
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('jwt_token', data.token);
                    if (errorMsg) errorMsg.style.display = 'none';
                    loginForm.reset();
                    const authed = await checkAuth();
                    if (authed) await loadAppData();
                } else {
                    if (errorMsg) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Sai tên đăng nhập hoặc mật khẩu.'; }
                }
            } catch (err) {
                if (errorMsg) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Lỗi kết nối máy chủ.'; }
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng nhập'; }
            }
        });
    }

    // ─────────────────────────────────────────────────────
    // Logout handler
    // ─────────────────────────────────────────────────────
    bindEvent('btn-logout', 'click', () => {
        localStorage.removeItem('jwt_token');
        state.user = null;
        hideApp();
        document.body.classList.remove('is-manager');
    });

    // ─────────────────────────────────────────────────────
    // Initial auth check on page load
    // ─────────────────────────────────────────────────────
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadAppData();
    }
}

// ─────────────────────────────────────────────────────────────
// LOAD APP DATA — fetch all data, then wire events, then render
// ─────────────────────────────────────────────────────────────
async function loadAppData() {
    try {
        const [projectsData, budgetData, tendersData, contractsData, cashflowData, paymentsData] = await Promise.all([
            fetchProjects(),
            fetchBudget(),
            fetchTenders(),
            fetchContracts(),
            fetchCashflow(),
            fetchPayments()
        ]);

        // ── 1. Hydrate state ──────────────────────────────
        let fetchedProjects = projectsData.Projects || [];
        if (fetchedProjects.length === 0) {
            try {
                const lsProj = localStorage.getItem('vcre_projects');
                if (lsProj) fetchedProjects = JSON.parse(lsProj);
            } catch (e) {}
        }
        if (fetchedProjects.length === 0) {
            fetchedProjects = [{
                project_id: 'proj-1',
                project_name: 'Dự án Demo',
                start_date: '2024-01-01',
                end_date: '2025-12-01',
                location: 'Hà Nội, Việt Nam',
                total_budget: 0,
                contingency_budget: 0
            }];
        }

        state.appData.Projects       = fetchedProjects;
        state.appData.Contracts      = (Array.isArray(contractsData) && contractsData.length > 0)
                                         ? contractsData : (budgetData.Contracts || []);
        state.appData.Cashflow       = Array.isArray(cashflowData)  ? cashflowData  : [];
        state.appData.Payments       = Array.isArray(paymentsData)  ? paymentsData  : [];
        state.appData.Payment_Claims = budgetData.Payment_Claims  || [];
        state.appData.Variations     = budgetData.Variations      || [];
        state.appData.Documents      = budgetData.Documents       || [];
        state.appData.Tenders        = tendersData.Tenders        || [];

        if (state.appData.Projects.length > 0) {
            state.currentProjectId = state.appData.Projects[0].project_id;
        }

        // ── 2. Wire all event listeners FIRST ────────────
        // Each setup function is wrapped so one failure cannot crash the chain
        const setupSteps = [
            { name: 'Sidebar',         fn: setupSidebarEvents },
            { name: 'Budget',          fn: setupBudgetEvents },
            { name: 'Tender',          fn: setupTenderEvents },
            { name: 'Contract',        fn: setupContractEvents },
            { name: 'Cashflow',        fn: setupCashflowEvents },
            { name: 'ProjectSummary',  fn: setupProjectSummaryEvents },
        ];

        for (const step of setupSteps) {
            try {
                step.fn();
            } catch (err) {
                console.error(`[loadAppData] setup${step.name}Events failed:`, err);
            }
        }

        // ── 3. Render UI ──────────────────────────────────
        try { renderProjectTabs(); } catch (e) { console.error('renderProjectTabs error:', e); }
        try { renderDashboard();   } catch (e) { console.error('renderDashboard error:', e); }

        // Activate default tab (menu-budget is marked active in sidebar.html)
        const activeTab = document.querySelector('.menu-item.active');
        if (activeTab) activeTab.click();

    } catch (error) {
        console.error('[loadAppData] Fatal error loading app data:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────
function setupSidebarEvents() {
    const modules = [
        { menu: 'menu-overview',  mod: 'module-overview' },
        { menu: 'menu-budget',    mod: 'module-budget' },
        { menu: 'menu-tender',    mod: 'module-tender' },
        { menu: 'menu-contract',  mod: 'contract-view' },
        { menu: 'menu-cashflow',  mod: 'cashflow-view' },
        { menu: 'menu-payment',   mod: 'module-payment' },
        { menu: 'menu-vo',        mod: 'module-vo' },
        { menu: 'menu-final',     mod: 'module-final' }
    ];

    modules.forEach(m => {
        const menuEl = document.getElementById(m.menu);
        if (!menuEl) return;

        menuEl.addEventListener('click', (e) => {
            e.preventDefault();
            // Deactivate all
            modules.forEach(x => {
                document.getElementById(x.menu)?.classList.remove('active');
                document.getElementById(x.mod)?.classList.add('hidden');
            });
            // Activate clicked
            menuEl.classList.add('active');
            const modEl = document.getElementById(m.mod);
            if (modEl) {
                modEl.classList.remove('hidden');
                // Cashflow charts need a tick to measure container size
                if (m.mod === 'cashflow-view') {
                    setTimeout(() => { try { renderCashflow(); } catch(e) { console.error(e); } }, 50);
                }
            }
        });
    });
}
