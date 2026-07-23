import { fetchProjects, fetchBudget, fetchTenders, fetchContracts, fetchCashflow, fetchPayments } from './api.js';
import { setupBudgetEvents, renderProjectTabs, renderDashboard } from './budget.js';
import { setupTenderEvents } from './tender.js';
import { setupContractEvents } from './contract.js';
import { setupCashflowEvents, renderCashflow } from './cashflow.js';
import { setupProjectSummaryEvents } from './project.js';

export const state = {
    appData: {
        Projects: [],
        Contracts: [],
        Cashflow: [],
        Payments: [],
        Payment_Claims: [],
        Variations: [],
        Documents: [],
        Tenders: []
    },
    currentProjectId: null
};

export const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0)) + ' VNĐ';
};

export const formatCurrencyVND = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
};

export const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

export const mockActivities = [
    { text: 'Initiate Payment Claims or VO approved', date: new Date().toISOString() }
];

document.addEventListener('DOMContentLoaded', async () => {
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
});

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
