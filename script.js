let transactions = JSON.parse(localStorage.getItem('pockita_tx')) || [];
let recurringTemplates = JSON.parse(localStorage.getItem('pockita_recur')) || [];
let savingsGoals = JSON.parse(localStorage.getItem('pockita_goals')) || [];
let debtsData = JSON.parse(localStorage.getItem('pockita_debts')) || [];
let recurringAppliedMonths = JSON.parse(localStorage.getItem('pockita_applied_months')) || [];
let isBalanceHidden = JSON.parse(localStorage.getItem('pockita_hide_balance')) || false; 

let memberCards = JSON.parse(localStorage.getItem('pockita_members')) || [];

let pockitaMethods = JSON.parse(localStorage.getItem('pockita_custom_methods')) || {
    'Cash': '', 'BCA': '', 'Mandiri': '', 'DANA': '', 'GoPay': '', 'ShopeePay': '', 'Koin': ''
};
if (!pockitaMethods.hasOwnProperty('Mandiri')) pockitaMethods['Mandiri'] = '';
if (!pockitaMethods.hasOwnProperty('ShopeePay')) pockitaMethods['ShopeePay'] = '';
if (!pockitaMethods.hasOwnProperty('Koin')) pockitaMethods['Koin'] = '';
localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));

let savedSources = new Set(JSON.parse(localStorage.getItem('pockita_sources')) || []);
let savedDetails = new Set(JSON.parse(localStorage.getItem('pockita_details')) || []);

let chartTargetObj = null; let chartRealisasiObj = null; let chartKomparasiObj = null;
let editingTxId = null; let currentHistoryMode = 'bulan'; 

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
    document.getElementById('card-transfer').style.display = type === 'transfer' ? 'block' : 'none';
    
    document.getElementById('tab-pemasukan').className = type === 'income' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-pengeluaran').className = type === 'expense' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-transfer').className = type === 'transfer' ? 'tab-btn active' : 'tab-btn';
}

function switchDebtForm(type) {
    document.getElementById('card-piutang').style.display = type === 'piutang' ? 'block' : 'none';
    document.getElementById('card-hutang').style.display = type === 'hutang' ? 'block' : 'none';
    document.getElementById('tab-piutang-btn').className = type === 'piutang' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-hutang-btn').className = type === 'hutang' ? 'tab-btn active' : 'tab-btn';
}

function toggleBalance(e) {
    e.stopPropagation(); isBalanceHidden = !isBalanceHidden;
    localStorage.setItem('pockita_hide_balance', isBalanceHidden); renderApp();
}

function toggleBreakdown(e) {
    if(isBalanceHidden) return; 
    const breakdown = document.getElementById('balance-breakdown');
    breakdown.style.display = breakdown.style.display === 'none' ? 'block' : 'none';
}

function initMonthPicker() {
    const now = new Date();
    document.getElementById('global-month-picker').value = now.toISOString().slice(0, 7);
    document.getElementById('filter-hari').value = now.toISOString().split('T')[0];
}

function getSelectedMonth() { return document.getElementById('global-month-picker').value; }
function changeGlobalMonth() { setHistoryMode('bulan'); if(document.getElementById('page-analysis').style.display === 'block') renderCharts(); }

function attachMoneyFormat() {
    document.querySelectorAll('.format-uang').forEach(input => {
        input.removeEventListener('input', formatUangLive); 
        input.addEventListener('input', formatUangLive);
    });
}
function formatUangLive(e) { let val = e.target.value.replace(/[^0-9]/g, ''); e.target.value = val !== '' ? new Intl.NumberFormat('id-ID').format(val) : ''; }
function parseUang(str) { return parseInt(str.toString().replace(/[^0-9]/g, '')) || 0; }
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID').format(angka); }
function formatK(angka) { return angka >= 1000 ? ((angka % 1000 === 0) ? (angka / 1000) + 'K' : (angka / 1000).toFixed(1).replace('.0', '') + 'K') : angka.toString(); }

function populateSelectMethods() {
    const arrMethods = Object.keys(pockitaMethods);
    ['in-metode', 'out-metode', 'tf-metode-dari', 'tf-metode-ke', 'recur-metode', 'piutang-metode', 'hutang-metode'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const currentVal = el.value; el.innerHTML = '';
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
    nameInput.value = ''; fileInput.value = ''; populateSelectMethods(); renderApp();
}

function deleteMethod(name) {
    if(confirm(`Hapus metode ${name}?`)) {
        delete pockitaMethods[name];
        localStorage.setItem('pockita_custom_methods', JSON.stringify(pockitaMethods));
        populateSelectMethods(); renderApp();
    }
}

// ================= FITUR KARTU MEMBER =================
// MEMASTIKAN FUNGSI TERBACA GLOBAL
window.openMemberModal = function() { document.getElementById('memberModal').style.display = 'block'; renderMemberCards(); }
window.closeMemberModal = function() { document.getElementById('memberModal').style.display = 'none'; }

function saveMemberCard() {
    const nameInput = document.getElementById('new-member-name');
    const fileInput = document.getElementById('new-member-file');
    const name = nameInput.value.trim();
    if(!name || !fileInput.files || !fileInput.files[0]) return alert("Nama kartu dan gambar barcode wajib diisi!");

    const reader = new FileReader();
    reader.onload = function(e) { 
        memberCards.push({ id: Date.now(), name: name, image: e.target.result });
        localStorage.setItem('pockita_members', JSON.stringify(memberCards));
        nameInput.value = ''; fileInput.value = '';
        renderMemberCards();
    };
    reader.readAsDataURL(fileInput.files[0]);
}

function deleteMemberCard(id) {
    if(confirm("Hapus kartu member ini?")) {
        memberCards = memberCards.filter(c => c.id !== id);
        localStorage.setItem('pockita_members', JSON.stringify(memberCards));
        renderMemberCards();
    }
}

function showFullscreenImg(src) {
    let overlay = document.getElementById('fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'fullscreen-overlay';
        overlay.className = 'fullscreen-overlay';
        overlay.innerHTML = `<span class="close-fullscreen" onclick="this.parentElement.style.display='none'">&times;</span><img id="fullscreen-img-element" class="fullscreen-img" src="">`;
        document.body.appendChild(overlay);
    }
    document.getElementById('fullscreen-img-element').src = src;
    overlay.style.display = 'flex';
}

function renderMemberCards() {
    const list = document.getElementById('member-card-list');
    if(!list) return;
    list.innerHTML = '';
    if(memberCards.length === 0){
        list.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding: 10px 0; grid-column: span 2;">Belum ada kartu tersimpan.</div>`;
    } else {
        memberCards.forEach(c => {
            list.innerHTML += `
            <div class="member-card-item">
                <button class="member-card-delete" onclick="deleteMemberCard(${c.id})">✖</button>
                <img src="${c.image}" class="member-card-img" onclick="showFullscreenImg('${c.image}')" title="Klik perbesar">
                <div class="member-card-name">${c.name}</div>
            </div>`;
        });
    }
}
// ======================================================

function checkAndApplyRecurring() {
    const realMonth = new Date().toISOString().slice(0, 7); 
    if (recurringAppliedMonths.includes(realMonth)) return;
    if (recurringTemplates.length === 0) return;

    recurringTemplates.forEach(tpl => {
        transactions.push({ id: Date.now() + Math.random(), type: 'expense', amount: tpl.amount, category: tpl.category || 'kebutuhan', desc: `Auto: ${tpl.name}`, date: `${realMonth}-01`, time: "00:01", method: tpl.method });
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
        if (tx.type === 'income') { 
            grandTotalSaldo += tx.amount; balancesByMethod[tx.method] += tx.amount; 
        } else if (tx.type === 'expense') { 
            grandTotalSaldo -= tx.amount; balancesByMethod[tx.method] -= tx.amount; 
        } else if (tx.type === 'transfer') {
            if (!balancesByMethod[tx.methodTo]) balancesByMethod[tx.methodTo] = 0;
            balancesByMethod[tx.method] -= tx.amount; 
            balancesByMethod[tx.methodTo] += tx.amount; 
        }
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

    if (currentFilter !== 'Semua') { 
        displayTransactions = displayTransactions.filter(tx => tx.method === currentFilter || (tx.type === 'transfer' && tx.methodTo === currentFilter)); 
    }

    if (displayTransactions.length === 0) {
        transactionContainer.innerHTML = `<div class="empty-state"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" alt="Kosong">Tidak ada transaksi yang cocok.</div>`;
    } else {
        const groupedTx = {};
        displayTransactions.forEach(tx => {
            if (!groupedTx[tx.method]) groupedTx[tx.method] = [];
            groupedTx[tx.method].push(tx);
            if (tx.type === 'transfer' && currentFilter !== 'Semua' && tx.methodTo === currentFilter && tx.method !== currentFilter) {
                if (!groupedTx[tx.methodTo]) groupedTx[tx.methodTo] = [];
                groupedTx[tx.methodTo].push(tx);
            }
        });

        for (const method in groupedTx) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'method-group';
            const imgData = pockitaMethods[method] || `${method.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

            groupDiv.innerHTML = `<div class="method-group-title"><img src="${imgData}" class="method-icon" onerror="this.outerHTML='<div class=\\'method-icon fallback-icon\\'>${method.charAt(0)}</div>'">${method}</div>`;
            
            const txsByDate = {};
            groupedTx[method].forEach(tx => {
                if(!txsByDate[tx.date]) txsByDate[tx.date] = [];
                if(!txsByDate[tx.date].find(x => x.id === tx.id)) txsByDate[tx.date].push(tx);
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
                    let isTransfer = tx.type === 'transfer';
                    
                    let isPiutang = isBeriPiutang || isTerimaPiutang;
                    let isHutang = isTerimaHutang || isBayarHutang;

                    let cleanDesc = tx.desc.replace('Auto: ', '').replace('Target: ', '').replace('Memberi Piutang: ', '').replace('Terima Piutang: ', '').replace('Menerima Hutang: ', '').replace('Bayar Hutang: ', '');
                    
                    let pillExtra = '';
                    if (isAuto) pillExtra = `<span class="pill-outline pill-outline-auto">AUTO</span>`;
                    if (isTarget) pillExtra = `<span class="pill-outline pill-outline-target">TAGIHAN</span>`;
                    if (isPiutang) pillExtra = `<span class="pill-outline pill-outline-piutang">PIUTANG</span>`;
                    if (isHutang) pillExtra = `<span class="pill-outline pill-outline-hutang">HUTANG</span>`;
                    if (isTransfer) pillExtra = `<span class="pill-outline pill-outline-transfer">⇄ TRANSFER</span>`;

                    let catName = (tx.category && typeof tx.category === 'string') ? tx.category.toLowerCase() : "umum";
                    let catColorClass = catName === 'kebutuhan' ? 'pill-outline-kebutuhan' : (catName === 'keinginan' ? 'pill-outline-keinginan' : 'pill-outline-tabungan');
                    
                    let pillKategori = tx.type === 'expense' && !isPiutang && !isHutang && !isTransfer ? `<span class="pill-outline ${catColorClass}">${catName.toUpperCase()}</span>` : '';
                    
                    let txDisplayAmount = `Rp ${formatRupiah(tx.amount)}`;
                    let txColorClass = tx.type === 'income' ? 'tx-income' : 'tx-expense';
                    let sign = tx.type === 'income' ? '+' : '-';

                    if (isTransfer) {
                        txColorClass = 'tx-transfer'; sign = '';
                        cleanDesc = `Ke ${tx.methodTo} ${tx.desc ? ' - '+tx.desc : ''}`;
                        if (currentFilter !== 'Semua' && tx.methodTo === currentFilter) {
                            cleanDesc = `Dari ${tx.method} ${tx.desc ? ' - '+tx.desc : ''}`;
                        }
                    }

                    const li = document.createElement('li');
                    li.className = 'transaction-item';
                    li.innerHTML = `
                        <div class="tx-kiri">
                            <div class="tx-title">${cleanDesc}</div>
                            <div class="pill-container">${pillKategori}${pillExtra}</div>
                            <span class="tx-meta">Jam ${tx.time}</span>
                        </div>
                        <div class="tx-kanan">
                            <div class="tx-amount ${txColorClass}">${sign} ${txDisplayAmount}</div>
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
    
    attachMoneyFormat();
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
    } else if(tx.type === 'expense') {
        document.getElementById('out-jumlah').value = formatRupiah(tx.amount);
        document.getElementById('out-kategori').value = tx.category || 'kebutuhan';
        let cleanText = tx.desc.replace('Auto: ', '').replace('Target: ', '').replace('Memberi Piutang: ', '').replace('Terima Piutang: ', '').replace('Menerima Hutang: ', '').replace('Bayar Hutang: ', '');
        document.getElementById('out-detail').value = cleanText;
        document.getElementById('out-tanggal').value = tx.date;
        document.getElementById('out-waktu').value = tx.time;
        document.getElementById('out-metode').value = tx.method;
        document.getElementById('btn-submit-expense').innerText = "Update Pengeluaran ✓";
        document.getElementById('btn-submit-expense').style.backgroundColor = "var(--secondary-orange)";
    } else if(tx.type === 'transfer') {
        document.getElementById('tf-jumlah').value = formatRupiah(tx.amount);
        document.getElementById('tf-metode-dari').value = tx.method;
        document.getElementById('tf-metode-ke').value = tx.methodTo;
        document.getElementById('tf-detail').value = tx.desc;
        document.getElementById('tf-tanggal').value = tx.date;
        document.getElementById('tf-waktu').value = tx.time;
        document.getElementById('btn-submit-transfer').innerText = "Update Mutasi ✓";
        document.getElementById('btn-submit-transfer').style.backgroundColor = "var(--secondary-orange)";
    }
}

function resetFormButtons() {
    document.getElementById('btn-submit-income').innerText = "Simpan Pemasukan";
    document.getElementById('btn-submit-income').style.backgroundColor = "var(--income-green)";
    document.getElementById('btn-submit-expense').innerText = "Simpan Pengeluaran";
    document.getElementById('btn-submit-expense').style.backgroundColor = "var(--expense-red)";
    document.getElementById('btn-submit-transfer').innerText = "Mutasi Saldo";
    document.getElementById('btn-submit-transfer').style.backgroundColor = "#8492A6";
    editingTxId = null;
}

function simpanTransaksi(type, idAmount, idDesc, idDate, idTime, idMethod, idKategori = null, idMethodTo = null) {
    const amount = parseUang(document.getElementById(idAmount).value);
    const desc = idDesc ? document.getElementById(idDesc).value : ''; 
    const date = document.getElementById(idDate).value;
    const time = document.getElementById(idTime).value;
    const method = document.getElementById(idMethod).value;
    const category = idKategori ? document.getElementById(idKategori).value : null;
    const methodTo = idMethodTo ? document.getElementById(idMethodTo).value : null;

    if (amount <= 0) return;
    if (type === 'transfer' && method === methodTo) return alert("Pilih dompet tujuan yang berbeda!");

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

        transactions[idx] = { id: editingTxId, type, amount, desc: finalDesc, date, time, method, methodTo, category, goalId: linkedGoalId, debtId: linkedDebtId };
        resetFormButtons();
    } else {
        transactions.push({ id: Date.now(), type, amount, desc, date, time, method, methodTo, category });
    }
    
    if(type === 'income') savedSources.add(desc);
    if(type === 'expense') savedDetails.add(desc);

    document.getElementById(type === 'income' ? 'form-pemasukan' : (type === 'expense' ? 'form-pengeluaran' : 'form-transfer')).reset();
    setDefaultDateTime();
    renderApp();
}

document.getElementById('form-pemasukan').addEventListener('submit', function(e) { e.preventDefault(); simpanTransaksi('income', 'in-jumlah', 'in-sumber', 'in-tanggal', 'in-waktu', 'in-metode'); });
document.getElementById('form-pengeluaran').addEventListener('submit', function(e) { e.preventDefault(); simpanTransaksi('expense', 'out-jumlah', 'out-detail', 'out-tanggal', 'out-waktu', 'out-metode', 'out-kategori'); });
document.getElementById('form-transfer').addEventListener('submit', function(e) { e.preventDefault(); simpanTransaksi('transfer', 'tf-jumlah', 'tf-detail', 'tf-tanggal', 'tf-waktu', 'tf-metode-dari', null, 'tf-metode-ke'); });

function hapusTransaksi(id) {
    if (confirm("Hapus transaksi ini?")) {
        transactions = transactions.filter(tx => tx.id !== id);
        renderApp();
    }
}

function renderCharts() {
    const activeMonth = getSelectedMonth();
    const monthlyTx = transactions.filter(tx => tx.date.startsWith(activeMonth) && tx.type !== 'transfer');
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
    if (type === 'debt') {
        const debt = debtsData.find(x => x.id === id);
        let collectedAmount = 0;
        
        if (debt.type === 'piutang') {
            collectedAmount = transactions.filter(tx => tx.debtId === id && tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
        } else {
            collectedAmount = transactions.filter(tx => tx.debtId === id && tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
        }
        
        let confirmMsg = "Hapus item ini? (Riwayat saldo di menu Transaksi yang sudah terlanjur dicicil tidak akan berubah)";
        
        if (collectedAmount === 0) {
            confirmMsg = "Hapus item ini? Karena belum ada cicilan yang dibayar, sistem juga akan menghapus transaksi awalnya di Riwayat agar saldomu kembali normal (Tarik Dana/Batal).";
        }

        if (confirm(confirmMsg)) {
            debtsData = debtsData.filter(x => x.id !== id);
            
            if (collectedAmount === 0) {
                transactions = transactions.filter(tx => tx.debtId !== id);
                localStorage.setItem('pockita_tx', JSON.stringify(transactions));
            }
            
            localStorage.setItem('pockita_debts', JSON.stringify(debtsData));
            renderApp();
        }
    } else {
        if (confirm("Hapus item rencana ini? (Riwayat saldomu tidak akan berubah)")) {
            if (type === 'recur') recurringTemplates = recurringTemplates.filter(x => x.id !== id);
            if (type === 'goal') savingsGoals = savingsGoals.filter(x => x.id !== id);
            localStorage.setItem('pockita_recur', JSON.stringify(recurringTemplates));
            localStorage.setItem('pockita_goals', JSON.stringify(savingsGoals));
            renderApp();
        }
    }
}

function renderGroupedDebts(list, container, typeStr) {
    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><img src="pochita-sleep.png" class="empty-state-img empty-neon-orange" style="width:40px;height:40px;" alt="Kosong">Belum ada daftar ${typeStr}.</div>`;
        return;
    }

    let groups = {};
    list.forEach(item => {
        let key = item.name.trim().toLowerCase();
        if (!groups[key]) groups[key] = { name: item.name.trim(), items: [] };
        groups[key].items.push(item);
    });

    let html = '';
    for (let key in groups) {
        let g = groups[key];
        let totalTarget = 0;
        let totalCollected = 0;
        let itemsHtml = '';
        
        g.items.forEach(d => {
            let collected = 0;
            if (d.type === 'piutang') {
                collected = transactions.filter(tx => tx.debtId === d.id && tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
            } else {
                collected = transactions.filter(tx => tx.debtId === d.id && tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
            }
            
            totalTarget += d.target;
            totalCollected += collected;

            const pct = Math.min(Math.round((collected / d.target) * 100), 100);
            const arrMethods = Object.keys(pockitaMethods);
            let selectHtml = `<select class="filter-dropdown" style="padding:8px; border-radius:10px;">`;
            arrMethods.forEach(m => selectHtml += `<option value="${m}">${m}</option>`);
            selectHtml += `</select>`;
            let specificSelect = selectHtml.replace('<select class=', `<select id="method-bayar-debt-${d.id}" class=`);
            
            let isCompleted = collected >= d.target;
            
            let actionHTML = isCompleted ? 
                `<span style="color: var(--income-green); font-weight: 800; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">✓ LUNAS</span><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${d.id})">${iconDelete}</button>` : 
                `<input type="text" id="input-bayar-debt-${d.id}" class="format-uang" placeholder="+ Nominal">${specificSelect}<button class="btn-add-goal" onclick="bayarDebt(${d.id})">${d.type === 'piutang' ? 'Terima' : 'Bayar'}</button><button class="btn-delete" style="margin:0; width:auto; padding: 0 10px;" onclick="hapusPlan('debt', ${d.id})">${iconDelete}</button>`;

            let noteUI = d.note ? `<div class="piutang-note">Catatan: ${d.note}</div>` : '';
            
            let pillUI = '';
            if (d.type === 'piutang') {
                let safeCat = d.category ? d.category.toLowerCase() : 'umum';
                let catColorClass = safeCat === 'kebutuhan' ? 'pill-outline-kebutuhan' : 'pill-outline-keinginan';
                pillUI = `<span class="pill-outline ${catColorClass}">${safeCat.toUpperCase()}</span><span class="pill-outline pill-outline-method">${d.method || 'Cash'}</span>`;
            } else {
                pillUI = `<span class="pill-outline pill-outline-method">${d.method || 'Cash'}</span>`;
            }

            itemsHtml += `
            <div class="goal-box">
                <div class="goal-info">
                    <span>
                        <div class="pill-container" style="margin-top: 0px; margin-bottom: 6px;">
                            ${pillUI}
                        </div>
                    </span>
                    <span style="text-align:right;">${pct}%<br><small style="font-weight:normal;">${formatRupiah(collected)} / ${formatRupiah(d.target)}</small></span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${isCompleted ? 'var(--income-green)' : 'var(--primary-orange)'};"></div>
                </div>
                ${noteUI}
                <div class="goal-actions" style="margin-top: 5px;">${actionHTML}</div>
            </div>`;
        });

        let groupPct = totalTarget > 0 ? Math.min(Math.round((totalCollected / totalTarget) * 100), 100) : 0;
        let groupId = `group-${typeStr}-${key.replace(/[^a-z0-9]/g, '')}`;

        html += `
        <div class="person-group">
            <button class="person-header" onclick="document.getElementById('${groupId}').style.display = document.getElementById('${groupId}').style.display === 'none' ? 'block' : 'none'">
                <span>👤 ${g.name} <small style="font-weight:normal; color:var(--text-muted);">(${groupPct}%)</small></span>
                <span>Rp ${formatRupiah(totalTarget - totalCollected)} <small style="font-size:0.7rem">Sisa</small> ▼</span>
            </button>
            <div class="person-content" id="${groupId}">
                ${itemsHtml}
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

function renderPlans() {
    const arrMethods = Object.keys(pockitaMethods);
    let selectHtml = `<select class="filter-dropdown" style="padding:8px; border-radius:10px;">`;
    arrMethods.forEach(m => selectHtml += `<option value="${m}">${m}</option>`);
    selectHtml += `</select>`;

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

    const containerHutang = document.getElementById('list-hutang');
    const containerPiutang = document.getElementById('list-piutang');
    
    let hutangList = debtsData.filter(d => d.type === 'hutang');
    let piutangList = debtsData.filter(d => d.type === 'piutang');

    renderGroupedDebts(hutangList, containerHutang, 'hutang');
    renderGroupedDebts(piutangList, containerPiutang, 'piutang');

    attachMoneyFormat(); 
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
    if(document.getElementById('tf-tanggal')) document.getElementById('tf-tanggal').value = dateStr;
    
    document.getElementById('in-waktu').value = timeStr;
    document.getElementById('out-waktu').value = timeStr;
    if(document.getElementById('tf-waktu')) document.getElementById('tf-waktu').value = timeStr;
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
        let tipe = tx.type === 'income' ? 'Pemasukan' : (tx.type === 'transfer' ? 'Mutasi' : 'Pengeluaran');
        let kat = tx.category ? tx.category.toUpperCase() : 'UMUM';
        let dtl = tx.desc.replace(/,/g, " ");
        let method = tx.type === 'transfer' ? `${tx.method} -> ${tx.methodTo}` : tx.method;
        csvContent += `${tx.date},${tx.time},${tipe},${kat},${dtl},${method},${tx.amount}\n`;
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
