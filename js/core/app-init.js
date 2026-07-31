import { state } from '../app.js';
import { fetchProjects, fetchBudget, fetchTenders, fetchContracts, fetchCashflow, fetchPayments, apiLogin, apiGetMe } from '../api.js';
import { setupBudgetEvents, renderProjectTabs, renderDashboard } from '../budget.js';
import { setupTenderEvents } from '../tender.js';
import { setupContractEvents } from '../contract.js';
import { setupCashflowEvents, renderCashflow } from '../cashflow.js';
import { setupProjectSummaryEvents } from '../project.js';

export async function initApp() {
    // Check Auth
    const loginModal = document.getElementById('login-modal');
    
    // Auth Event Listener
    window.addEventListener('auth-unauthorized', () => {
        loginModal.classList.remove('hidden');
        document.body.classList.remove('is-manager');
    });

    const checkAuth = async () => {
        // --- BYPASS LOGIN FOR LOCAL DEV & LIVE PREVIEW ---
        const isLocalDev = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.protocol === 'file:';
                           
        if (isLocalDev) {
            if (!localStorage.getItem('jwt_token')) {
                localStorage.setItem('jwt_token', 'dev-bypass-token-2026');
            }
            state.user = { username: 'qs', role: 'admin', name: 'Triều QS' };
            
            if (loginModal) loginModal.classList.add('hidden');
            
            const userNameEl = document.getElementById('user-name');
            const userRoleEl = document.getElementById('user-role');
            if (userNameEl) userNameEl.textContent = state.user.name;
            if (userRoleEl) userRoleEl.textContent = state.user.role;
            
            document.body.classList.add('is-manager');
            return true;
        }
        // -------------------------------------------------

        if (!localStorage.getItem('jwt_token')) {
            if (loginModal) loginModal.classList.remove('hidden');
            return false;
        }
        
        try {
            const res = await apiGetMe();
            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
                if (loginModal) loginModal.classList.add('hidden');
                
                // Update User Info in Header
                const userNameEl = document.getElementById('user-name');
                const userRoleEl = document.getElementById('user-role');
                if (userNameEl) userNameEl.textContent = state.user.name || state.user.username;
                if (userRoleEl) userRoleEl.textContent = state.user.role;
                
                // RBAC Logic
                if (state.user.role === 'manager' || state.user.role === 'admin') {
                    document.body.classList.add('is-manager');
                } else {
                    document.body.classList.remove('is-manager');
                }
                return true;
            } else {
                if (loginModal) loginModal.classList.remove('hidden');
                return false;
            }
        } catch (error) {
            if (loginModal) loginModal.classList.remove('hidden');
            return false;
        }
    };

    // Setup Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorMsg = document.getElementById('login-error');
            const submitBtn = document.getElementById('btn-login-submit');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang đăng nhập...';
                
                const res = await apiLogin(username, password);
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('jwt_token', data.token);
                    errorMsg.style.display = 'none';
                    loginForm.reset();
                    if (await checkAuth()) {
                        await loadAppData();
                    }
                } else {
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'Lỗi kết nối máy chủ.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Đăng nhập';
            }
        });
    }

    // Setup Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('jwt_token');
            state.user = null;
            loginModal.classList.remove('hidden');
            document.body.classList.remove('is-manager');
        });
    }

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadAppData();
    }
}

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
        
        let fetchedProjects = projectsData.Projects || [];
        if (fetchedProjects.length === 0) {
            try {
                const lsProj = localStorage.getItem('vcre_projects');
                if (lsProj) fetchedProjects = JSON.parse(lsProj);
            } catch(e) {}
        }
        if (fetchedProjects.length === 0) {
            fetchedProjects = [{
                project_id: 'proj-1',
                project_name: 'Olimpic Stadium',
                start_date: '2024-01-01',
                end_date: '2024-12-01',
                location: 'Belgrade, Serbia',
                total_budget: 0,
                contingency_budget: 0
            }];
        }
        
        state.appData.Projects = fetchedProjects;
        state.appData.Contracts = (Array.isArray(contractsData) && contractsData.length > 0) ? contractsData : (budgetData.Contracts || []);
        state.appData.Cashflow = Array.isArray(cashflowData) ? cashflowData : [];
        state.appData.Payments = Array.isArray(paymentsData) ? paymentsData : [];
        state.appData.Payment_Claims = budgetData.Payment_Claims || [];
        state.appData.Variations = budgetData.Variations || [];
        state.appData.Documents = budgetData.Documents || [];
        state.appData.Tenders = tendersData.Tenders || [];
        
        if (state.appData.Projects.length > 0) {
            state.currentProjectId = state.appData.Projects[0].project_id;
        }

        renderProjectTabs();
        renderDashboard();
        
        setupSidebarEvents();
        setupBudgetEvents();
        setupTenderEvents();
        setupContractEvents();
        setupCashflowEvents();
        setupProjectSummaryEvents();
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function setupSidebarEvents() {
    const modules = [
        { menu: 'menu-overview', mod: 'module-overview' },
        { menu: 'menu-budget', mod: 'module-budget' },
        { menu: 'menu-tender', mod: 'module-tender' },
        { menu: 'menu-contract', mod: 'contract-view' },
        { menu: 'menu-cashflow', mod: 'cashflow-view' },
        { menu: 'menu-payment', mod: 'module-payment' },
        { menu: 'menu-vo', mod: 'module-vo' },
        { menu: 'menu-final', mod: 'module-final' }
    ];

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
                if (modEl) {
                    modEl.classList.remove('hidden');
                    if (m.mod === 'cashflow-view') {
                        // Small timeout to allow the display:block to take effect before rendering charts
                        setTimeout(renderCashflow, 50);
                    }
                }
            });
        }
    });
}
