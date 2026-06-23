let transactions = JSON.parse(localStorage.getItem('pockita_tx')) || [];
let recurringTemplates = JSON.parse(localStorage.getItem('pockita_recur')) || [];
let savingsGoals = JSON.parse(localStorage.getItem('pockita_goals')) || [];
let debtsData = JSON.parse(localStorage.getItem('pockita_debts')) || [];
let recurringAppliedMonths = JSON.parse(localStorage.getItem('pockita_applied_months')) || [];
let isBalanceHidden = JSON.parse(localStorage.getItem('pockita_hide_balance')) || false; 

// MIGRASI DATA LAMA (Mencegah Crash)
let oldPiutang = JSON.parse(localStorage.getItem('pockita_piutang'));
if (oldPiutang && oldPiutang.length > 0) {
    oldPiutang.forEach(p => { debtsData.push({...p, type: 'piutang'}); });
    localStorage.removeItem('pockita_piutang');
    localStorage.setItem('pockita_debts', JSON.stringify(debtsData));
}

let pockitaMethods = JSON.parse(localStorage.getItem('pockita_custom_methods')) || {
    'Cash': '', 'BCA': '', 'DANA': '', 'GoPay': ''
};

let legacyMethods = JSON.parse(localStorage.getItem('pockita_methods'));
if (Array.isArray(legacyMethods)) {
    legacyMethods.forEach(m => { if(!pockitaMethods[m]) pockitaMethods[m] = ''; });
    localStorage.removeItem('pockita_methods');
    localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));
}

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

function toggleBalance(e) {
    e.stopPropagation(); 
    isBalanceHidden = !isBalanceHidden;
    localStorage.setItem('pockita_hide_balance', isBalanceHidden);
    renderApp();
}

function toggleBreakdown(e) {
    if(isBalanceHidden) return; 
    const breakdown = document.getElementById('balance-breakdown');
    breakdown.style.display = breakdown.style.display === 'none' ? 'block' : 'none';
}

function initMonthPicker() {
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); 
    const todayStr = now.toISOString().split('T')[0];
    document.getElementById('global-month-picker').value = currentMonthStr;
    document.getElementById('filter-hari').value = todayStr;
}

function getSelectedMonth() { return document.getElementById('global-month-picker').value; }
function changeGlobalMonth() { setHistoryMode('bulan'); if(document.getElementById('page-analysis').style.display === 'block') renderCharts(); }

document.querySelectorAll('.format-uang').forEach(input => {
    input.addEventListener('input', function(e) {
        let val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val !== '' ? new Intl.NumberFormat('id-ID').format(val) : '';
    });
});

function parseUang(str) { return parseInt(str.toString().replace(/[^0-9]/g, '')) || 0; }
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID').format(angka); }
function formatK(angka) {
    if (angka >= 1000) { return (angka % 1000 === 0) ? (angka / 1000) + 'K' : (angka / 1000).toFixed(1).replace('.0', '') + 'K'; }
    return angka.toString();
}

function populateSelectMethods() {
    const arrMethods = Object.keys(pockitaMethods);
    ['in-metode', 'out-metode', 'recur-metode', 'piutang-metode', 'hutang-metode'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const currentVal = el.value;
            el.innerHTML = '';
            arrMethods.forEach(m => el.innerHTML += `<option value="${m}">${m}</option>`);
            if(currentVal && arrMethods.includes(currentVal)) el.value = currentVal;
        }
    });
    renderModalMethodList();
}

function openMethodModal(e) { e.preventDefault(); document.getElementById('methodModal').style.display = 'block'; renderModalMethodList(); }
function closeMethodModal() { document.getElementById('methodModal').style.display = 'none'; }

function renderModalMethodList() {
    const list = document.getElementById('modal-method-list');
    if(!list) return;
    list.innerHTML = '';
    for (let method in pockitaMethods) {
        const imgData = pockitaMethods[method] || `${method.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
        list.innerHTML += `
            <li class="transaction-item" style="padding: 6px 0;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${imgData}" class="method-icon" style="width:28px;height:28px;" onerror="this.outerHTML='<div class=\\'method-icon fallback-icon\\' style=\\'width:28px;height:28px;\\'>${method.charAt(0)}</div>'">
                    <span style="font-weight:600; font-size:0.9rem;">${method}</span>
                </div>
                <button class="btn-delete" style="width:28px;height:28px;" onclick="deleteMethod('${method}')">${iconDelete}</button>
            </li>`;
    }
}

function saveNewMethod() {
    const nameInput = document.getElementById('new-method-name');
    const fileInput = document.getElementById('new-method-file');
    const name = nameInput.value.trim();
    if(!name) return alert("Nama metode tidak boleh kosong!");

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { pockitaMethods[name] = e.target.result; finalizeSaveMethod(nameInput, fileInput); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        pockitaMethods[name] = ''; finalizeSaveMethod(nameInput, fileInput);
    }
}

function finalizeSaveMethod(nameInput, fileInput) {
    localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));
    nameInput.value = ''; fileInput.value = '';
    populateSelectMethods(); renderApp();
}

function deleteMethod(name) {
    if(confirm(`Hapus metode ${name}?`)) {
        delete pockitaMethods[name];
        localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));
        populateSelectMethods(); renderApp();
    }
}

function checkAndApplyRecurring() {
    const realDate = new Date();
    const realMonth = realDate.toISOString().slice(0, 7); 
    if (recurringAppliedMonths.includes(realMonth)) return;
    if (recurringTemplates.length === 0) return;

    recurringTemplates.forEach(tpl => {
        const txDate = `${realMonth}-01`;
        transactions.push({ id: Date.now() + Math.random(), type: 'expense', amount: tpl.amount, category: tpl.category || 'kebutuhan', desc: `Auto: ${tpl.name}`, date: txDate, time: "00:01", method: tpl.method });
    });

    recurringAppliedMonths.push(realMonth);
    localStorage.setItem('pockita_applied_months', JSON.stringify(recurringAppliedMonths));
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
}

function setHistoryMode(mode) {
    currentHistoryMode = mode;
    if (mode === 'bulan') {
        document.getElementById('btn-mode-bulan').className = 'time-btn active';
        document.getElementById('btn-mode-hari').className = 'time-btn';
        document.getElementById('filter-hari').style.display = 'none';
    } else {
        document.getElementById('btn-mode-bulan').className = 'time-btn';
        document.getElementById('btn-mode-hari').className = 'time-btn active';
        document.getElementById('filter-hari').style.display = 'inline-block';
    }
    renderApp();
}

function renderApp() {
    const activeMonth = getSelectedMonth();
    const transactionContainer = document.getElementById('daftar-transaksi');
    const filterMetode = document.getElementById('filter-metode');
    
    transactionContainer.innerHTML = '';
    let grandTotalSaldo = 0; let balancesByMethod = {};

    transactions.forEach(tx => {
        if (!balancesByMethod[tx.method]) balancesByMethod[tx.method] = 0;
        if (tx.type === 'income') { grandTotalSaldo += tx.amount; balancesByMethod[tx.method] += tx.amount; } 
        else { grandTotalSaldo -= tx.amount; balancesByMethod[tx.method] -= tx.amount; }
    });

    const saldoEl = document.getElementById('total-saldo');
    const eyeBtn = document.getElementById('btn-toggle-eye');
    const breakdownContainer = document.getElementById('balance-breakdown');
    breakdownContainer.innerHTML = '';

    if (isBalanceHidden) {
        saldoEl.innerText = '***';
        eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        breakdownContainer.style.display = 'none'; 
    } else {
        saldoEl.innerText = formatRupiah(grandTotalSaldo);
        eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        for (const [method, amount] of Object.entries(balancesByMethod)) {
            breakdownContainer.innerHTML += `<div class="breakdown-item"><span>${method}</span><span>Rp ${formatRupiah(amount)}</span></div>`;
        }
    }

    let displayTransactions = [];
    if (currentHistoryMode === 'bulan') { displayTransactions = transactions.filter(tx => tx.date.startsWith(activeMonth)); } 
    else { const specificDate = document.getElementById('filter-hari').value; displayTransactions = transactions.filter(tx => tx.date === specificDate); }

    updateDatalist('sumber-list', savedSources);
    updateDatalist('detail-list', savedDetails);
    populateSelectMethods(); 

    const currentFilter = filterMetode.value; 
    filterMetode.innerHTML = '<option value="Semua">Semua Dompet</option>';
    Object.keys(pockitaMethods).forEach(method => {
        const isSelected = method === currentFilter ? 'selected' : '';
        filterMetode.innerHTML += `<option value="${method}" ${isSelected}>${method}</option>`;
    });

    if (currentFilter !== 'Semua') { displayTransactions = displayTransactions.filter(tx => tx.method === currentFilter); }

    if (displayTransactions.length === 0) {
        transactionContainer.innerHTML = `<div class="empty-state"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" alt="Kosong">Tidak ada transaksi yang cocok.</div>`;
    } else {
        const groupedTx = {};
        displayTransactions.forEach(tx => {
            if (!groupedTx[tx.method]) groupedTx[tx.method] = [];
            groupedTx[tx.method].push(tx);
        });

        for (const method in groupedTx) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'method-group';
            const imgData = pockitaMethods[method] || `${method.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

            groupDiv.innerHTML = `<div class="method-group-title"><img src="${imgData}" class="method-icon" onerror="this.outerHTML='<div class=\\'method-icon fallback-icon\\'>${method.charAt(0)}</div>'">${method}</div>`;
            
            const txsByDate = {};
            groupedTx[method].forEach(tx => {
                if(!txsByDate[tx.date]) txsByDate[tx.date] = [];
                txsByDate[tx.date].push(tx);
            });

            const sortedDates = Object.keys(txsByDate).sort((a, b) => new Date(b) - new Date(a));

            sortedDates.forEach(dateStr => {
                const d = new Date(dateStr);
                const formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-group-title';
                dateHeader.innerText = `📅 ${formattedDate}`;
                groupDiv.appendChild(dateHeader);

                const ul = document.createElement('ul');
                ul.className = 'transaction-list';

                txsByDate[dateStr].sort((a, b) => {
                    const timeA = new Date((a.date||'') + 'T' + (a.time||'00:00')).getTime() || a.id;
                    const timeB = new Date((b.date||'') + 'T' + (b.time||'00:00')).getTime() || b.id;
                    if (timeA === timeB) return b.id - a.id; 
                    return timeB - timeA;
                }).forEach(tx => {
                    let isAuto = tx.desc.startsWith('Auto: ');
                    let isTarget = tx.desc.startsWith('Target: ');
                    let isBeriPiutang = tx.desc.startsWith('Memberi Piutang: ');
                    let isTerimaPiutang = tx.desc.startsWith('Terima Piutang: ');
                    let isTerimaHutang = tx.desc.startsWith('Menerima Hutang: ');
                    let isBayarHutang = tx.desc.startsWith('Bayar Hutang: ');
                    
                    let isPiutang = isBeriPiutang || isTerimaPiutang;
                    let isHutang = isTerimaHutang || isBayarHutang;

                    let cleanDesc = tx.desc.replace('Auto: ', '').replace('Target: ', '').replace('Memberi Piutang: ', '').replace('Terima Piutang: ', '').replace('Menerima Hutang: ', '').replace('Bayar Hutang: ', '');
                    
                    let pillExtra = '';
                    if (isAuto) pillExtra = `<span class="pill-outline pill-outline-auto">AUTO</span>`;
                    if (isTarget) pillExtra = `<span class="pill-outline pill-outline-target">TAGIHAN</span>`;
                    if (isPiutang) pillExtra = `<span class="pill-outline pill-outline-piutang">PIUTANG</span>`;
                    if (isHutang) pillExtra = `<span class="pill-outline pill-outline-hutang">HUTANG</span>`;

                    let catName = (tx.category && typeof tx.category === 'string') ? tx.category.toLowerCase() : "umum";
                    let catColorClass = catName === 'kebutuhan' ? 'pill-outline-kebutuhan' : (catName === 'keinginan' ? 'pill-outline-keinginan' : 'pill-outline-tabungan');
                    
                    let pillKategori = tx.type === 'expense' && !isPiutang && !isHutang ? `<span class="pill-outline ${catColorClass}">${catName.toUpperCase()}</span>` : '';
                    
                    const li = document.createElement('li');
                    li.className = 'transaction-item';
                    li.innerHTML = `
                        <div class="tx-kiri">
                            <div class="tx-title">${cleanDesc}</div>
                            <div class="pill-container">${pillKategori}${pillExtra}</div>
                            <span class="tx-meta">Jam ${tx.time}</span>
                        </div>
                        <div class="tx-kanan">
                            <div class="tx-amount ${tx.type === 'income' ? 'tx-income' : 'tx-expense'}">
                                ${tx.type === 'income' ? '+' : '-'} Rp ${formatRupiah(tx.amount)}
                            </div>
                            <div class="tx-actions">
                                <button class="btn-edit" onclick="editTransaksi(${tx.id})" title="Edit">${iconEdit}</button>
                                <button class="btn-delete" onclick="hapusTransaksi(${tx.id})" title="Hapus">${iconDelete}</button>
                            </div>
                        </div>`;
                    ul.appendChild(li);
                });
                groupDiv.appendChild(ul);
            });
            transactionContainer.appendChild(groupDiv);
        }
    }

    renderPlans();
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    localStorage.setItem('pockita_sources', JSON.stringify([...savedSources]));
    localStorage.setItem('pockita_details', JSON.stringify([...savedDetails]));
}

function editTransaksi(id) {
    const tx = transactions.find(t => t.id === id);
    if(!tx) return;
    
    editingTxId = id;
    switchPage('tx');
    switchForm(tx.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if(tx.type === 'income') {
        document.getElementById('in-jumlah').value = formatRupiah(tx.amount);
        document.getElementById('in-sumber').value = tx.desc;
        document.getElementById('in-tanggal').value = tx.date;
        document.getElementById('in-waktu').value = tx.time;
        document.getElementById('in-metode').value = tx.method;
        document.getElementById('btn-submit-income').innerText = "Update Pemasukan ✓";
        document.getElementById('btn-submit-income').style.backgroundColor = "var(--secondary-orange)"; 
    } else {
        document.getElementById('out-jumlah').value = formatRupiah(tx.amount);
        document.getElementById('out-kategori').value = tx.category || 'kebutuhan';
        let cleanText = tx.desc.replace('Auto: ', '').replace('Target: ', '').replace('Memberi Piutang: ', '').replace('Terima Piutang: ', '').replace('Menerima Hutang: ', '').replace('Bayar Hutang: ', '');
        document.getElementById('out-detail').value = cleanText;
        document.getElementById('out-tanggal').value = tx.date;
        document.getElementById('out-waktu').value = tx.time;
        document.getElementById('out-metode').value = tx.method;
        document.getElementById('btn-submit-expense').innerText = "Update Pengeluaran ✓";
        document.getElementById('btn-submit-expense').style.backgroundColor = "var(--secondary-orange)";
    }
}

function resetFormButtons() {
    document.getElementById('btn-submit-income').innerText = "Simpan Pemasukan";
    document.getElementById('btn-submit-income').style.backgroundColor = "var(--income-green)";
    document.getElementById('btn-submit-expense').innerText = "Simpan Pengeluaran";
    document.getElementById('btn-submit-expense').style.backgroundColor = "var(--expense-red)";
    editingTxId = null;
}

function simpanTransaksi(type, idAmount, idDesc, idDate, idTime, idMethod, idKategori = null) {
    const amount = parseUang(document.getElementById(idAmount).value);
    const desc = document.getElementById(idDesc).value;
    const date = document.getElementById(idDate).value;
    const time = document.getElementById(idTime).value;
    const method = document.getElementById(idMethod).value;
    const category = idKategori ? document.getElementById(idKategori).value : null;

    if (amount <= 0) return;

    if (editingTxId !== null) {
        const idx = transactions.findIndex(t => t.id === editingTxId);
        const oldDesc = transactions[idx].desc;
        const linkedGoalId = transactions[idx].goalId; 
        const linkedDebtId = transactions[idx].debtId; 

        let finalDesc = desc;
        if(oldDesc.startsWith('Auto: ')) finalDesc = 'Auto: ' + desc;
        if(oldDesc.startsWith('Target: ')) finalDesc = 'Target: ' + desc;
        if(oldDesc.startsWith('Memberi Piutang: ')) finalDesc = 'Memberi Piutang: ' + desc;
        if(oldDesc.startsWith('Terima Piutang: ')) finalDesc = 'Terima Piutang: ' + desc;
        if(oldDesc.startsWith('Menerima Hutang: ')) finalDesc = 'Menerima Hutang: ' + desc;
        if(oldDesc.startsWith('Bayar Hutang: ')) finalDesc = 'Bayar Hutang: ' + desc;

        transactions[idx] = { id: editingTxId, type, amount, desc: finalDesc, date, time, method, category, goalId: linkedGoalId, debtId: linkedDebtId };
        resetFormButtons();
    } else {
        transactions.push({ id: Date.now(), type, amount, desc, date, time, method, category });
    }
    
    if(type === 'income') savedSources.add(desc);
    else savedDetails.add(desc);

    document.getElementById(type === 'income' ? 'form-pemasukan' : 'form-pengeluaran').reset();
    setDefaultDateTime();
    renderApp();
}

document.getElementById('form-pemasukan').addEventListener('submit', function(e) { e.preventDefault(); simpanTransaksi('income', 'in-jumlah', 'in-sumber', 'in-tanggal', 'in-waktu', 'in-metode'); });
document.getElementById('form-pengeluaran').addEventListener('submit', function(e) { e.preventDefault(); simpanTransaksi('expense', 'out-jumlah', 'out-detail', 'out-tanggal', 'out-waktu', 'out-metode', 'out-kategori'); });

function hapusTransaksi(id) {
    if (confirm("Hapus transaksi ini?")) {
        transactions = transactions.filter(tx => tx.id !== id);
        renderApp();
    }
}

function renderCharts() {
    const activeMonth = getSelectedMonth();
    const monthlyTx = transactions.filter(tx => tx.date.startsWith(activeMonth));
    let totalPemasukanBulanIni = monthlyTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);

    let pengeluaranAktual = { kebutuhan: 0, keinginan: 0, tabungan: 0 };
    monthlyTx.filter(tx => tx.type === 'expense').forEach(tx => {
        const cat = (tx.category && typeof tx.category === 'string') ? tx.category.toLowerCase() : 'kebutuhan';
        if (pengeluaranAktual.hasOwnProperty(cat)) { pengeluaranAktual[cat] += tx.amount; } 
        else { pengeluaranAktual.kebutuhan += tx.amount; }
    });

    let targetIdeal = { kebutuhan: totalPemasukanBulanIni * 0.5, keinginan: totalPemasukanBulanIni * 0.3, tabungan: totalPemasukanBulanIni * 0.2 };
    updateStatusBadge('kebutuhan', pengeluaranAktual.kebutuhan, targetIdeal.kebutuhan);
    updateStatusBadge('keinginan', pengeluaranAktual.keinginan, targetIdeal.keinginan);
    updateStatusBadge('tabungan', pengeluaranAktual.tabungan, targetIdeal.tabungan);

    if (totalPemasukanBulanIni === 0) {
        document.getElementById('empty-target-chart').style.display = 'flex';
        document.getElementById('chartTarget').style.display = 'none';
    } else {
        document.getElementById('empty-target-chart').style.display = 'none';
        document.getElementById('chartTarget').style.display = 'block';
        if(chartTargetObj) chartTargetObj.destroy();
        const ctxTarget = document.getElementById('chartTarget').getContext('2d');
        chartTargetObj = new Chart(ctxTarget, {
            type: 'pie',
            data: { labels: ['Kebutuhan Ideal', 'Keinginan Ideal', 'Tabungan Ideal'], datasets: [{ data: [targetIdeal.kebutuhan, targetIdeal.keinginan, targetIdeal.tabungan], backgroundColor: ['#3498DB', '#F39C12', '#2ECC71'], borderWidth: 2, borderColor: '#FFFFFF' }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    if (monthlyTx.length === 0) {
        document.getElementById('empty-realisasi-chart').style.display = 'flex';
        document.getElementById('chartRealisasi').style.display = 'none';
    } else {
        document.getElementById('empty-realisasi-chart').style.display = 'none';
        document.getElementById('chartRealisasi').style.display = 'block';

        let totalTerpakai = pengeluaranAktual.kebutuhan + pengeluaranAktual.keinginan + pengeluaranAktual.tabungan;
        let sisaPemasukan = totalPemasukanBulanIni - totalTerpakai;
        
        let labelChart2 = ['Kebutuhan', 'Keinginan', 'Tabungan'];
        let dataChart2 = [pengeluaranAktual.kebutuhan, pengeluaranAktual.keinginan, pengeluaranAktual.tabungan];
        let colorChart2 = ['#3498DB', '#F39C12', '#2ECC71'];

        if (sisaPemasukan > 0) {
            labelChart2.push('Sisa Pemasukan'); dataChart2.push(sisaPemasukan); colorChart2.push('#DCDCD3'); 
        }

        if(chartRealisasiObj) chartRealisasiObj.destroy();
        const ctxRealisasi = document.getElementById('chartRealisasi').getContext('2d');
        chartRealisasiObj = new Chart(ctxRealisasi, {
            type: 'pie',
            data: { labels: labelChart2, datasets: [{ data: dataChart2, backgroundColor: colorChart2, borderWidth: 2, borderColor: '#FFFFFF' }] },
            options: { 
                responsive: true, 
                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(context) {
                    let label = context.label || ''; let val = context.raw || 0;
                    if(totalPemasukanBulanIni === 0) return `${label}: Rp ${formatRupiah(val)}`;
                    let persentase = ((val / totalPemasukanBulanIni) * 100).toFixed(1);
                    if (label.includes('Sisa')) { return ` Tersisa: Rp ${formatRupiah(val)} - ${persentase}%`; } 
                    else { let batas = label === 'Kebutuhan' ? 50 : (label === 'Keinginan' ? 30 : 20); return ` ${label}: Rp ${formatRupiah(val)} - ${persentase}% / Batas ${batas}%`; }
                }}}} 
            }
        });
    }
    renderBarChartKomparasi();
}

function updateStatusBadge(catName, aktual, target) {
    const badge = document.getElementById(`badge-${catName}`);
    const imgEl = document.getElementById(`img-${catName}`);
    const maxNominalEl = document.getElementById(`max-${catName}`);
    const frontBg = document.getElementById(`bg-${catName}`);
    maxNominalEl.innerText = formatK(target);

    let defaultColor = "var(--primary-orange)";
    if(catName === 'kebutuhan') defaultColor = "#2ECC71";
    if(catName === 'keinginan') defaultColor = "#F39C12";
    if(catName === 'tabungan') defaultColor = "#E74C3C";
    frontBg.style.backgroundColor = defaultColor;

    imgEl.style.display = "block";
    if (target === 0) { badge.innerHTML = "0%"; imgEl.src = "mode-aman.png"; return; }

    const rasio = aktual / target;
    let pct = Math.round(rasio * 100);
    if(pct > 999) pct = ">999"; 
    badge.innerHTML = `${pct}%`;

    if (rasio > 1.0) { imgEl.src = "mode-bahaya.png"; } 
    else if (rasio >= 0.85) { imgEl.src = "mode-waspada.png"; } 
    else { imgEl.src = "mode-aman.png"; }
}

function renderBarChartKomparasi() {
    let monthsLabel = []; let expensesData = []; let incomesData = []; let sisaData = [];
    for (let i = 5; i >= 0; i--) {
        let d = new Date(); d.setMonth(d.getMonth() - i);
        let mStr = d.toISOString().slice(0, 7); 
        monthsLabel.push(d.toLocaleString('id-ID', { month: 'short', year: 'numeric' }));
        
        let outSum = transactions.filter(tx => tx.date.startsWith(mStr) && tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
        let inSum = transactions.filter(tx => tx.date.startsWith(mStr) && tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
                                   
        expensesData.push(outSum); incomesData.push(inSum); sisaData.push(inSum - outSum); 
    }

    if(chartKomparasiObj) chartKomparasiObj.destroy();
    const ctxBar = document.getElementById('chartKomparasi').getContext('2d');
    chartKomparasiObj = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: monthsLabel, datasets: [
            { label: 'Pemasukan', data: incomesData, backgroundColor: '#2ECC71', borderRadius: 6 },
            { label: 'Pengeluaran', data: expensesData, backgroundColor: '#E74C3C', borderRadius: 6 },
            { label: 'Sisa Saldo Net', data: sisaData, backgroundColor: '#F39C12', borderRadius: 6 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
    });
}

// LOGIKA INPUT FORM RENCANA
document.getElementById('form-berulang').addEventListener('submit', function(e){
    e.preventDefault();
    const amount = parseUang(document.getElementById('recur-jumlah').value);
    const category = document.getElementById('recur-kategori').value;
    const name = document.getElementById('recur-nama').value;
    const method = document.getElementById('recur-metode').value;

    recurringTemplates.push({ id: Date.now(), amount, category, name, method });
    localStorage.setItem('pockita_recur', JSON.stringify(recurringTemplates));
    
    const realMonth = new Date().toISOString().slice(0, 7);
    transactions.push({ id: Date.now() + Math.random(), type: 'expense', amount: amount, category: category, desc: `Auto: ${name}`, date: `${realMonth}-01`, time: "00:01", method: method });
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    this.reset(); renderApp();
});

document.getElementById('form-goals').addEventListener('submit', function(e){
    e.preventDefault();
    const name = document.getElementById('goal-nama').value;
    const target = parseUang(document.getElementById('goal-target').value);
    const category = document.getElementById('goal-kategori').value; 
    savingsGoals.push({ id: Date.now(), name, target, category });
    localStorage.setItem('pockita_goals', JSON.stringify(savingsGoals));
    this.reset(); renderApp();
});

document.getElementById('form-piutang').addEventListener('submit', function(e){
    e.preventDefault();
    const name = document.getElementById('piutang-nama').value;
    const target = parseUang(document.getElementById('piutang-jumlah').value);
    const method = document.getElementById('piutang-metode').value; 
    const category = document.getElementById('piutang-kategori').value; 
    const note = document.getElementById('piutang-catatan').value; 

    if (target <= 0) return;
    const debtId = Date.now();
    debtsData.push({ id: debtId, type: 'piutang', name, target, note, method, category });
    localStorage.setItem('pockita_debts', JSON.stringify(debtsData));

    const now = new Date();
    transactions.push({ id: Date.now() + 1, type: 'expense', amount: target, category: category, desc: `Memberi Piutang: ${name}`, date: now.toISOString().split('T')[0], time: now.toTimeString().split(' ')[0].slice(0,5), method: method, debtId: debtId });
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    this.reset(); renderApp();
});

document.getElementById('form-hutang').addEventListener('submit', function(e){
    e.preventDefault();
    const name = document.getElementById('hutang-nama').value;
    const target = parseUang(document.getElementById('hutang-jumlah').value);
    const method = document.getElementById('hutang-metode').value; 
    const note = document.getElementById('hutang-catatan').value; 

    if (target <= 0) return;
    const debtId = Date.now();
    debtsData.push({ id: debtId, type: 'hutang', name, target, note, method });
    localStorage.setItem('pockita_debts', JSON.stringify(debtsData));

    const now = new Date();
    transactions.push({ id: Date.now() + 1, type: 'income', amount: target, category: 'umum', desc: `Menerima Hutang: ${name}`, date: now.toISOString().split('T')[0], time: now.toTimeString().split(' ')[0].slice(0,5), method: method, debtId: debtId });
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    this.reset(); renderApp();
});

function tambahTabunganGoal(id) {
    const inputEl = document.getElementById(`input-add-goal-${id}`);
    const methodEl = document.getElementById(`method-add-goal-${id}`); 
    let moneyToAdd = parseUang(inputEl.value);
    const selectedMethod = methodEl.value;
    if(moneyToAdd <= 0) return;

    const goal = savingsGoals.find(g => g.id === id);
    let collectedAmount = transactions.filter(tx => tx.goalId === goal.id).reduce((sum, tx) => sum + tx.amount, 0);
    let remaining = goal.target - collectedAmount;

    if (moneyToAdd > remaining) {
        moneyToAdd = remaining;
        alert(`Nominal dilebihkan. Otomatis disesuaikan dengan sisa nominal (Rp ${formatRupiah(remaining)}).`);
    }

    const now = new Date();
    transactions.push({ id: Date.now(), type: 'expense', amount: moneyToAdd, category: goal.category || 'tabungan', desc: `Target: ${goal.name}`, date: now.toISOString().split('T')[0], time: now.toTimeString().split(' ')[0].slice(0,5), method: selectedMethod, goalId: goal.id });
    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    renderApp();
}

function bayarDebt(id) {
    const inputEl = document.getElementById(`input-bayar-debt-${id}`);
    const methodEl = document.getElementById(`method-bayar-debt-${id}`); 
    let moneyPaid = parseUang(inputEl.value);
    const selectedMethod = methodEl.value;
    if(moneyPaid <= 0) return;

    const debt = debtsData.find(d => d.id === id);
    let collectedAmount = 0;
    
    if (debt.type === 'piutang') {
        collectedAmount = transactions.filter(tx => tx.debtId === debt.id && tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    } else {
        collectedAmount = transactions.filter(tx => tx.debtId === debt.id && tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    }

    let remaining = debt.target - collectedAmount;
    if (moneyPaid > remaining) {
        moneyPaid = remaining;
        alert(`Nominal dilebihkan. Otomatis disesuaikan dengan sisa nominal (Rp ${formatRupiah(remaining)}).`);
    }

    const now = new Date();
    if (debt.type === 'piutang') {
        transactions.push({ id: Date.now(), type: 'income', amount: moneyPaid, category: 'umum', desc: `Terima Piutang: ${debt.name}`, date: now.toISOString().split('T')[0], time: now.toTimeString().split(' ')[0].slice(0,5), method: selectedMethod, debtId: debt.id });
    } else {
        transactions.push({ id: Date.now(), type: 'expense', amount: moneyPaid, category: 'umum', desc: `Bayar Hutang: ${debt.name}`, date: now.toISOString().split('T')[0], time: now.toTimeString().split(' ')[0].slice(0,5), method: selectedMethod, debtId: debt.id });
    }

    localStorage.setItem('pockita_tx', JSON.stringify(transactions));
    renderApp();
}

function hapusPlan(type, id) {
    if(confirm("Hapus item ini? (Riwayat saldo di menu Transaksi tidak akan berubah)")){
        if(type === 'recur') recurringTemplates = recurringTemplates.filter(x => x.id !== id);
        if(type === 'goal') savingsGoals = savingsGoals.filter(x => x.id !== id);
        if(type === 'debt') debtsData = debtsData.filter(x => x.id !== id);
        
        localStorage.setItem('pockita_recur', JSON.stringify(recurringTemplates));
        localStorage.setItem('pockita_goals', JSON.stringify(savingsGoals));
        localStorage.setItem('pockita_debts', JSON.stringify(debtsData));
        renderApp();
    }
}

function renderPlans() {
    const arrMethods = Object.keys(pockitaMethods);
    let selectHtml = `<select class="filter-dropdown" style="padding:8px; border-radius:10px;">`;
    arrMethods.forEach(m => selectHtml += `<option value="${m}">${m}</option>`);
    selectHtml += `</select>`;

    // 1. RENDER RUTINITAS
    const listRecur = document.getElementById('list-berulang');
    listRecur.innerHTML = '';
    if(recurringTemplates.length === 0){
        listRecur.innerHTML = `<div class="empty-state"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" alt="Kosong">Belum ada langganan rutin.</div>`;
    } else {
        recurringTemplates.forEach(t => {
            let safeCat = t.category ? t.category.toLowerCase() : 'umum';
            let catColorClass = safeCat === 'kebutuhan' ? 'pill-outline-kebutuhan' : 'pill-outline-keinginan';
            
            listRecur.innerHTML += `
                <li class="plan-item">
                    <span><b>${t.name}</b> Rp ${formatRupiah(t.amount)}<br>
                        <div class="pill-container" style="margin-top: 4px;">
                            <span class="pill-outline ${catColorClass}">${safeCat.toUpperCase()}</span>
                            <span class="pill-outline pill-outline-method">${t.method || 'Cash'}</span>
                        </div>
                    </span>
                    <button class="btn-delete" style="margin:0; height:fit-content;" onclick="hapusPlan('recur', ${t.id})">${iconDelete}</button>
                </li>`;
        });
    }

    // 2. RENDER TAGIHAN/TARGET
    const containerGoals = document.getElementById('list-goals');
    containerGoals.innerHTML = '';
    if(savingsGoals.length === 0){
        containerGoals.innerHTML = `<div class="empty-state"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" alt="Kosong">Belum ada target menabung/tagihan.</div>`;
    } else {
        savingsGoals.forEach(g => {
            let collectedAmount = transactions.filter(tx => tx.goalId === g.id).reduce((sum, tx) => sum + tx.amount, 0);
            const pct = Math.min(Math.round((collectedAmount / g.target) * 100), 100);
            let specificSelect = selectHtml.replace('<select class=', `<select id="method-add-goal-${g.id}" class=`);

            let isCompleted = collectedAmount >= g.target;
            let actionHTML = isCompleted ? 
                `<span style="color: var(--income-green); font-weight: 800; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">✓ TERCAPAI</span><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('goal', ${g.id})">${iconDelete}</button>` : 
                `<input type="text" id="input-add-goal-${g.id}" class="format-uang" placeholder="+ Nominal">${specificSelect}<button class="btn-add-goal" onclick="tambahTabunganGoal(${g.id})">Setor</button><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('goal', ${g.id})">${iconDelete}</button>`;

            let safeCat = g.category ? g.category.toLowerCase() : 'tabungan';
            let catColorClass = safeCat === 'kebutuhan' ? 'pill-outline-kebutuhan' : (safeCat === 'keinginan' ? 'pill-outline-keinginan' : 'pill-outline-tabungan');

            containerGoals.innerHTML += `
                <div class="goal-box">
                    <div class="goal-info">
                        <span><b>${g.name}</b> <br>
                            <div class="pill-container" style="margin-top: 4px;">
                                <span class="pill-outline ${catColorClass}">${safeCat.toUpperCase()}</span>
                            </div>
                        </span>
                        <span style="text-align:right;">${pct}%<br><small style="font-weight:normal;">${formatRupiah(collectedAmount)} / ${formatRupiah(g.target)}</small></span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${isCompleted ? 'var(--income-green)' : 'var(--primary-orange)'};"></div>
                    </div>
                    <div class="goal-actions" style="margin-top: 15px;">${actionHTML}</div>
                </div>`;
        });
    }

    // 3. RENDER HUTANG PIUTANG
    const containerPiutang = document.getElementById('list-piutang');
    const containerHutang = document.getElementById('list-hutang');
    containerPiutang.innerHTML = ''; containerHutang.innerHTML = '';

    let piutangList = debtsData.filter(d => d.type === 'piutang');
    let hutangList = debtsData.filter(d => d.type === 'hutang');

    if(hutangList.length === 0){
        containerHutang.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" style="width:40px;height:40px;" alt="Kosong">Belum ada daftar hutang.</div>`;
    } else {
        hutangList.forEach(h => {
            let collectedAmount = transactions.filter(tx => tx.debtId === h.id && tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
            const pct = Math.min(Math.round((collectedAmount / h.target) * 100), 100);
            let specificSelect = selectHtml.replace('<select class=', `<select id="method-bayar-debt-${h.id}" class=`);

            let isCompleted = collectedAmount >= h.target;
            let actionHTML = isCompleted ? 
                `<span style="color: var(--text-main); font-weight: 800; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">✓ LUNAS</span><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${h.id})">${iconDelete}</button>` : 
                `<input type="text" id="input-bayar-debt-${h.id}" class="format-uang" placeholder="+ Nominal">${specificSelect}<button class="btn-add-goal" onclick="bayarDebt(${h.id})">Bayar</button><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${h.id})">${iconDelete}</button>`;

            let noteUI = h.note ? `<div class="piutang-note">Catatan: ${h.note}</div>` : '';

            containerHutang.innerHTML += `
                <div class="goal-box">
                    <div class="goal-info">
                        <span><b>${h.name}</b> <br>
                            <div class="pill-container" style="margin-top: 4px;">
                                <span class="pill-outline pill-outline-method">${h.method || 'Cash'}</span>
                            </div>
                        </span>
                        <span style="text-align:right;">${pct}%<br><small style="font-weight:normal;">${formatRupiah(collectedAmount)} / ${formatRupiah(h.target)}</small></span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${isCompleted ? 'var(--income-green)' : 'var(--primary-orange)'};"></div>
                    </div>
                    ${noteUI}
                    <div class="goal-actions" style="margin-top: 5px;">${actionHTML}</div>
                </div>`;
        });
    }

    if(piutangList.length === 0){
        containerPiutang.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" style="width:40px;height:40px;" alt="Kosong">Belum ada daftar piutang.</div>`;
    } else {
        piutangList.forEach(p => {
            let collectedAmount = transactions.filter(tx => tx.debtId === p.id && tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
            const pct = Math.min(Math.round((collectedAmount / p.target) * 100), 100);
            let specificSelect = selectHtml.replace('<select class=', `<select id="method-bayar-debt-${p.id}" class=`);

            let isCompleted = collectedAmount >= p.target;
            let actionHTML = isCompleted ? 
                `<span style="color: var(--text-main); font-weight: 800; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">✓ LUNAS</span><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${p.id})">${iconDelete}</button>` : 
                `<input type="text" id="input-bayar-debt-${p.id}" class="format-uang" placeholder="+ Nominal">${specificSelect}<button class="btn-add-goal" onclick="bayarDebt(${p.id})">Terima</button><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${p.id})">${iconDelete}</button>`;

            let noteUI = p.note ? `<div class="piutang-note">Catatan: ${p.note}</div>` : '';
            let safeCat = p.category ? p.category.toLowerCase() : 'umum';
            let catColorClass = safeCat === 'kebutuhan' ? 'pill-outline-kebutuhan' : 'pill-outline-keinginan';

            containerPiutang.innerHTML += `
                <div class="goal-box">
                    <div class="goal-info">
                        <span><b>${p.name}</b> <br>
                            <div class="pill-container" style="margin-top: 4px;">
                                <span class="pill-outline ${catColorClass}">${safeCat.toUpperCase()}</span>
                                <span class="pill-outline pill-outline-method">${p.method || 'Cash'}</span>
                            </div>
                        </span>
                        <span style="text-align:right;">${pct}%<br><small style="font-weight:normal;">${formatRupiah(collectedAmount)} / ${formatRupiah(p.target)}</small></span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${isCompleted ? 'var(--income-green)' : 'var(--primary-orange)'};"></div>
                    </div>
                    ${noteUI}
                    <div class="goal-actions" style="margin-top: 5px;">${actionHTML}</div>
                </div>`;
        });
    }

    // Format Uang Dinamis untuk progress inputs
    document.querySelectorAll('.goal-actions .format-uang').forEach(input => {
        // Hapus duplikasi event listener
        input.replaceWith(input.cloneNode(true));
    });
    
    document.querySelectorAll('.goal-actions .format-uang').forEach(input => {
        input.addEventListener('input', function(e) {
            let val = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = val !== '' ? new Intl.NumberFormat('id-ID').format(val) : '';
        });
    });
}

function updateDatalist(id, dataSet) {
    const el = document.getElementById(id);
    if(el) {
        el.innerHTML = '';
        dataSet.forEach(item => el.appendChild(new Option(item, item)));
    }
}

function setDefaultDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0,5);
    document.getElementById('in-tanggal').value = dateStr;
    document.getElementById('out-tanggal').value = dateStr;
    document.getElementById('in-waktu').value = timeStr;
    document.getElementById('out-waktu').value = timeStr;
}

function exportToExcel() {
    const activeMonth = getSelectedMonth();
    let displayTx = [];
    if (currentHistoryMode === 'bulan') { displayTx = transactions.filter(tx => tx.date.startsWith(activeMonth)); } 
    else { const specificDate = document.getElementById('filter-hari').value; displayTx = transactions.filter(tx => tx.date === specificDate); }
    
    if (displayTx.length === 0) { alert("Tidak ada data untuk diekspor!"); return; }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFTanggal,Jam,Tipe,Kategori,Detail,Metode,Jumlah (Rp)\n";
    displayTx.sort((a,b) => {
        const timeA = new Date((a.date||'') + 'T' + (a.time||'00:00')).getTime() || a.id;
        const timeB = new Date((b.date||'') + 'T' + (b.time||'00:00')).getTime() || b.id;
        if (timeA === timeB) return b.id - a.id; 
        return timeB - timeA;
    }).forEach(tx => {
        const tipe = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const kat = tx.category ? tx.category.toUpperCase() : 'UMUM';
        const dtl = tx.desc.replace(/,/g, " ");
        csvContent += `${tx.date},${tx.time},${tipe},${kat},${dtl},${tx.method},${tx.amount}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    let fileName = currentHistoryMode === 'bulan' ? `Pockita_Laporan_${activeMonth}.csv` : `Pockita_Laporan_Harian_${document.getElementById('filter-hari').value}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

initMonthPicker();
checkAndApplyRecurring();
setDefaultDateTime();
renderApp();
