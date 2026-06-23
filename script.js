let transactions = JSON.parse(localStorage.getItem('pockita_tx')) || [];
let recurringTemplates = JSON.parse(localStorage.getItem('pockita_recur')) || [];
let savingsGoals = JSON.parse(localStorage.getItem('pockita_goals')) || [];
let debtsData = JSON.parse(localStorage.getItem('pockita_debts')) || [];
let recurringAppliedMonths = JSON.parse(localStorage.getItem('pockita_applied_months')) || [];
let isBalanceHidden = JSON.parse(localStorage.getItem('pockita_hide_balance')) || false; 

// MENAMBAH KOIN SEBAGAI METODE DEFAULT BARU
let pockitaMethods = JSON.parse(localStorage.getItem('pockita_custom_methods')) || {
    'Cash': '', 'BCA': '', 'Mandiri': '', 'DANA': '', 'GoPay': '', 'ShopeePay': '', 'Koin': ''
};
if (!pockitaMethods.hasOwnProperty('Mandiri')) pockitaMethods['Mandiri'] = '';
if (!pockitaMethods.hasOwnProperty('ShopeePay')) pockitaMethods['ShopeePay'] = '';
if (!pockitaMethods.hasOwnProperty('Koin')) pockitaMethods['Koin'] = '';
localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));

let savedSources = new Set(JSON.parse(localStorage.getItem('pockita_sources')) || []);
let savedDetails = new Set(JSON.parse(localStorage.getItem('pockita_details')) || []);

let chartTargetObj = null;
let chartRealisasiObj = null;
let chartKomparasiObj = null;
let editingTxId = null;
let currentHistoryMode = 'bulan'; 

const iconEdit = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
const iconDelete = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

function switchPage(page) {
    document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.className = 'nav-btn');
    document.getElementById(`page-${page}`).style.display = 'block';
    document.getElementById(`nav-${page}`).className = 'nav-btn active';
    if (page === 'analysis') setTimeout(renderCharts, 50);
}

function switchForm(type) {
    document.getElementById('card-pemasukan').style.display = type === 'income' ? 'block' : 'none';
    document.getElementById('card-pengeluaran').style.display = type === 'expense' ? 'block' : 'none';
    document.getElementById('tab-pemasukan').className = type === 'income' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-pengeluaran').className = type === 'expense' ? 'tab-btn active' : 'tab-btn';
}

function switchDebtForm(type) {
    document.getElementById('card-piutang').style.display = type === 'piutang' ? 'block' : 'none';
    document.getElementById('card-hutang').style.display = type === 'hutang' ? 'block' : 'none';
    document.getElementById('tab-piutang-btn').className = type === 'piutang' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-hutang-btn').className = type === 'hutang' ? 'tab-btn active' : 'tab-btn';
}

// REST OF CODE REMOVED TO PREVENT LONG-FORM CONFLICTS WITH TRUNCATION

initMonthPicker();
checkAndApplyRecurring();
setDefaultDateTime();
renderApp();
