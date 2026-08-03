import { state } from '../app.js';
import { fetchProjects, fetchBudget, fetchTenders, fetchContracts, fetchCashflow, fetchPayments, apiLogin, apiGetMe } from '../api.js';
import { loadBudgetsFromLS, loadTendersFromLS, loadContractsFromLS, loadCashflowFromLS, loadPaymentsFromLS } from '../core/data-store.js';
import { setupBudgetEvents, renderProjectTabs, renderDashboard } from '../budget.js';
import { setupTenderEvents } from '../tender.js';
import { setupContractEvents } from '../contract.js';
import { setupCashflowEvents, renderCashflow } from '../cashflow.js';
import { setupProjectSummaryEvents } from '../project.js';
import { setupPaymentEvents, renderPaymentDashboard } from '../payment.js';
import { initAdminUtils } from './admin-utils.js';

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

    // ─────────────────────────────────────────────────────
    // Global ESC Event Listener (FIFO Layer Stack)
    // ─────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const escapeStack = [
                // Priority 1: Popups
                { container: '#budgetFormModal', btn: '#close-budget-form-modal' },
                { container: '#cashflow-import-modal', btn: '#close-cf-import-modal' },

                // Priority 2: Layer 3
                { container: '#contract-detail-modal', btn: '#close-contract-modal' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-form' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-detail' },
                { container: '#tender-detail-modal', btn: '#close-tender-detail-modal' },
                
                // Priority 3: Layer 2
                { container: '#payment-list-modal', btn: '#btn-payment-back-l1' },
                { container: '#tender-list-modal', btn: '#close-tender-list-modal' },
                { container: '#contract-list-modal', btn: '#close-contract-list-modal' },
                { container: '#budget-list-modal', btn: '#close-budget-list-modal' },
                { container: '#cashflow-detail-modal', btn: '#close-cashflow-modal' },
            ];

            for (const layer of escapeStack) {
                const el = document.querySelector(layer.container);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    const btn = document.querySelector(layer.btn);
                    if (btn && btn.closest('.hidden') === null && btn.style.display !== 'none') {
                        btn.click();
                        return; // Stop after handling the highest priority layer
                    }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────
// LOAD APP DATA — fetch all data, then wire events, then render
// ─────────────────────────────────────────────────────────────
async function loadAppData() {
    try {
        const isCleared = localStorage.getItem('ccm_user_reset_cleared') === 'true';

        if (isCleared) {
            console.warn('✅ System was hard reset. Bypassing all mock data and fetching.');
            state.appData = {
                Projects: [],
                Budgets: [],
                Tenders: [],
                Contracts: [],
                Cashflow: [],
                Payments: [],
                Payment_Claims: [],
                Variations: [],
                Documents: []
            };
            
            // Wire events and render empty state
            const setupSteps = [
                { name: 'Sidebar',         fn: setupSidebarEvents },
                { name: 'Budget',          fn: setupBudgetEvents },
                { name: 'Tender',          fn: setupTenderEvents },
                { name: 'Contract',        fn: setupContractEvents },
                { name: 'Cashflow',        fn: setupCashflowEvents },
                { name: 'ProjectSummary',  fn: setupProjectSummaryEvents },
                { name: 'Payment',         fn: setupPaymentEvents },
                { name: 'AdminUtils',      fn: initAdminUtils },
            ];
            for (const step of setupSteps) {
                try { step.fn(); } catch (err) { console.error(`setup${step.name}Events failed:`, err); }
            }
            try { renderProjectTabs(); } catch (e) {}
            try { renderDashboard();   } catch (e) {}
            return;
        }

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
                const lsProj = localStorage.getItem('ccm_projects');
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
            localStorage.setItem('ccm_projects', JSON.stringify(fetchedProjects));
        }

        state.appData.Projects       = fetchedProjects;
        
        // Contracts fallback
        let fetchedContracts = (Array.isArray(contractsData) && contractsData.length > 0) ? contractsData : (budgetData.Contracts || []);
        if (fetchedContracts.length === 0) {
            const lsContracts = loadContractsFromLS();
            if (lsContracts) fetchedContracts = lsContracts;
        }
        state.appData.Contracts = fetchedContracts;
        
        // ── CASHFLOW RECOVERY LOGIC (STRICT) ──────────────
        let fetchedCashflow = Array.isArray(cashflowData) && cashflowData.length > 0 ? cashflowData : [];
        const localData = localStorage.getItem('ccm_cashflow');
        if (localData && localData !== '[]' && localData !== 'undefined') {
            try {
                // ALWAYS PRIORITIZE LOCALSTORAGE FOR CASHFLOW TO PREVENT DATA LOSS
                fetchedCashflow = JSON.parse(localData);
                console.log('✅ Khôi phục thành công dữ liệu Cashflow từ LocalStorage');
            } catch(e) { console.error('Lỗi khi khôi phục Cashflow:', e); }
        }
        state.appData.Cashflow = fetchedCashflow;

        state.appData.Payments = Array.isArray(paymentsData) ? paymentsData : [];

        // PAYMENTS RECOVERY LOGIC — prioritize localStorage
        const localPayments = localStorage.getItem('ccm_payments');
        if (localPayments && localPayments !== '[]' && localPayments !== 'undefined') {
            try {
                const parsed = JSON.parse(localPayments);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    state.appData.Payments = parsed;
                    console.log(`✅ Khôi phục ${parsed.length} IPC từ LocalStorage (ccm_payments)`);
                }
            } catch (e) { console.error('Lỗi khi khôi phục Payments:', e); }
        }
        
        // Load Budgets with fallback to localStorage
        let fetchedBudgets = budgetData.Budgets || [];
        if (fetchedBudgets.length === 0) {
            const lsBudgets = loadBudgetsFromLS();
            if (lsBudgets) fetchedBudgets = lsBudgets;
        }
        state.appData.Budgets = fetchedBudgets;

        state.appData.Payment_Claims = budgetData.Payment_Claims  || [];
        state.appData.Variations     = budgetData.Variations      || [];
        state.appData.Documents      = budgetData.Documents       || [];
        
        // Tenders fallback
        let fetchedTenders = tendersData.Tenders || [];
        if (fetchedTenders.length === 0) {
            const lsTenders = loadTendersFromLS();
            if (lsTenders) fetchedTenders = lsTenders;
        }
        state.appData.Tenders = fetchedTenders;

        const savedActiveId = localStorage.getItem('ccm_current_project_id');
        if (savedActiveId && state.appData.Projects.some(p => p.project_id === savedActiveId)) {
            state.currentProjectId = savedActiveId;
        } else if (state.appData.Projects.length > 0) {
            state.currentProjectId = state.appData.Projects[0].project_id;
            localStorage.setItem('ccm_current_project_id', state.currentProjectId);
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
            { name: 'Payment',         fn: setupPaymentEvents },
            { name: 'AdminUtils',      fn: initAdminUtils },
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

            // Clean up modal state before tab switch
            document.querySelectorAll('.modal-overlay, .inline-workspace, #payment-list-modal').forEach(el => el.classList.add('hidden'));
            document.body.classList.remove('modal-open', 'workspace-active', 'overflow-hidden');
            document.getElementById('sidebar')?.classList.remove('sidebar-collapsed');
            document.body.style.overflow = '';
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.overflowY = 'auto';
                mainContent.classList.remove('overflow-hidden');
            }

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

                // Force re-render of tenders to fix chart issues when hidden
                if (m.menu === 'menu-tender') {
                    import('../tender.js').then(module => {
                        if (typeof module.renderTenders === 'function') {
                            module.renderTenders();
                        }
                    });
                }
                
                // Cashflow charts need a tick to measure container size
                if (m.mod === 'cashflow-view') {
                    setTimeout(() => { try { renderCashflow(); } catch(e) { console.error(e); } }, 50);
                }

                // Payment dashboard re-render on tab switch
                if (m.mod === 'module-payment') {
                    setTimeout(() => { try { renderPaymentDashboard(); } catch(e) { console.error(e); } }, 50);
                }
            }
        });
    });
}
