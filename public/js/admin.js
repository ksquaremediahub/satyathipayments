const s = ensureRole('admin');
let chartTotals;
let chartComm;
let repTypeChart;
let repCommissionChart;
let repDailyTotalsChart;
let repDailyCommissionChart;
let lastRangeRows = [];

async function loadCompanyProfile() {
  const r = await api('/api/admin/profile');
  if (!r.ok) return;
  const p = r.profile || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('cnameCompany', p.companyName);
  set('cphoneCompany', p.phone);
  set('cemailCompany', p.email);
  set('caddr1Company', p.address && p.address.line1);
  set('caddr2Company', p.address && p.address.line2);
  set('ccityCompany', p.address && p.address.city);
  set('cstateCompany', p.address && p.address.state);
  set('cpincodeCompany', p.address && p.address.pincode);
}

async function saveCompanyProfile() {
  const companyName = (document.getElementById('cnameCompany') && document.getElementById('cnameCompany').value.trim()) || '';
  const phone = (document.getElementById('cphoneCompany') && document.getElementById('cphoneCompany').value.trim()) || '';
  const email = (document.getElementById('cemailCompany') && document.getElementById('cemailCompany').value.trim()) || '';
  const address = {
    line1: (document.getElementById('caddr1Company') && document.getElementById('caddr1Company').value.trim()) || '',
    line2: (document.getElementById('caddr2Company') && document.getElementById('caddr2Company').value.trim()) || '',
    city: (document.getElementById('ccityCompany') && document.getElementById('ccityCompany').value.trim()) || '',
    state: (document.getElementById('cstateCompany') && document.getElementById('cstateCompany').value.trim()) || '',
    pincode: (document.getElementById('cpincodeCompany') && document.getElementById('cpincodeCompany').value.trim()) || ''
  };
  let logoDataUrl = '';
  const f = document.getElementById('clogoCompany');
  if (f && f.files && f.files[0]) {
    logoDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(f.files[0]);
    });
  }
  const body = { companyName, phone, email, address };
  if (logoDataUrl) body.logoDataUrl = logoDataUrl;
  const r = await api('/api/admin/profile', { method: 'PUT', body });
  if (!r.ok) alert(r.error || 'Failed to save'); else alert('Profile saved');
}
async function loadBranches() {
  const r = await api('/api/admin/branches');
  const sel = document.getElementById('ubranch');
  const rsel = document.getElementById('rbranch');
  if (sel) sel.innerHTML = '';
  if (rsel) rsel.innerHTML = '<option value="">All</option>';
  r.branches.forEach((b) => {
    if (sel) { const o1 = document.createElement('option'); o1.value = b.id; o1.textContent = `${b.name} (#${b.id})`; sel.appendChild(o1); }
    if (rsel) { const o2 = document.createElement('option'); o2.value = b.id; o2.textContent = `${b.name}`; rsel.appendChild(o2); }
  });
}

async function createBranch() {
  const name = document.getElementById('bname').value.trim();
  const login = document.getElementById('blogin').value.trim();
  const password = document.getElementById('bpass').value.trim();
  const ownerName = (document.getElementById('bowner') && document.getElementById('bowner').value.trim()) || '';
  const phone = (document.getElementById('bphone') && document.getElementById('bphone').value.trim()) || '';
  const email = (document.getElementById('bemail') && document.getElementById('bemail').value.trim()) || '';
  const address = {
    line1: (document.getElementById('addr1') && document.getElementById('addr1').value.trim()) || '',
    line2: (document.getElementById('addr2') && document.getElementById('addr2').value.trim()) || '',
    city: (document.getElementById('city') && document.getElementById('city').value.trim()) || '',
    state: (document.getElementById('state') && document.getElementById('state').value.trim()) || '',
    pincode: (document.getElementById('pincode') && document.getElementById('pincode').value.trim()) || ''
  };
  const r = await api('/api/admin/branches', { method: 'POST', body: { name, login, password, ownerName, phone, email, address } });
  if (!r.ok) alert(r.error || 'Failed'); else { alert('Branch created'); loadBranches(); }
}

async function loadCommissionSettings() {
  const r = await api('/api/admin/branches');
  const rows = r.branches.map((b) => {
    const cashPerc = ((typeof b.commissionRateCash === 'number' ? b.commissionRateCash : (typeof b.commissionRate === 'number' ? b.commissionRate : 0.02)) * 100).toFixed(2);
    const billPerc = ((typeof b.commissionRateBill === 'number' ? b.commissionRateBill : (typeof b.commissionRate === 'number' ? b.commissionRate : 0.02)) * 100).toFixed(2);
    const inputCash = `<input class="form-control form-control-sm" type="number" step="0.01" min="0" id="rateCash_${b.id}" value="${cashPerc}">`;
    const inputBill = `<input class="form-control form-control-sm" type="number" step="0.01" min="0" id="rateBill_${b.id}" value="${billPerc}">`;
    const inputPass = `<input class="form-control form-control-sm" type="password" id="pass_${b.id}" placeholder="New password (optional)">`;
    const saveBtn = `<button class="btn btn-sm btn-primary" onclick="saveCommission(${b.id})">Save</button>`;
    return { id: b.id, branch: b.name, credit_card_to_cash_percent: inputCash, credit_card_bill_payment_percent: inputBill, new_password: inputPass, action: saveBtn };
  });
  table('commissionTable', rows, ['id','branch','credit_card_to_cash_percent','credit_card_bill_payment_percent','new_password','action']);
}

async function saveCommission(id) {
  const ec = document.getElementById('rateCash_' + id);
  const eb = document.getElementById('rateBill_' + id);
  const commissionRateCash = Number(ec && ec.value ? ec.value : 0) / 100;
  const commissionRateBill = Number(eb && eb.value ? eb.value : 0) / 100;
  const ep = document.getElementById('pass_' + id);
  const password = ep && ep.value ? ep.value : undefined;
  const body = { commissionRateCash, commissionRateBill };
  if (password !== undefined && password !== '') body.password = password;
  const r = await api(`/api/admin/branches/${id}`, { method: 'PUT', body });
  if (!r.ok) alert(r.error || 'Failed to save'); else alert('Saved');
}

async function loadReports() {
  const branchId = document.getElementById('rbranch').value;
  const userId = '';
  const date = document.getElementById('rdate') ? document.getElementById('rdate').value : '';
  const q = (document.getElementById('searchText') && document.getElementById('searchText').value) || '';
  const qs = new URLSearchParams({ branchId, userId, date, q });
  const r = await api('/api/admin/reports?' + qs.toString());
  const rows = r.payments.map((p) => {
    const phoneText = p.client && p.client.phone ? p.client.phone : '';
    const receiptUrl = receiptUrlForPayment(p);
    const printLink = receiptUrl ? `<a class="btn btn-sm btn-outline-secondary" href="${receiptUrl}&print=1" target="_blank">Print</a>` : '';
    const href = whatsappHrefForPayment(p);
    const shareLink = href ? `<a class="btn btn-sm btn-success" href="${href}" target="_blank">Share</a>` : '';
    const actions = [printLink, shareLink].filter(Boolean).join(' ');
    const cardNo = p.card && p.card.last4 ? `•••• ${p.card.last4}` : '';
    const brand = p.card && p.card.brand ? p.card.brand : '';
    const expiry = p.card && p.card.expiry ? p.card.expiry : '';
    const cd = p.cardDetails || {};
    return {
      id: p.id,
      date: p.createdAt.slice(0,10),
      time: p.createdAt.slice(11,19),
      branchId: p.branchId,
      userId: p.userId,
      type: p.type,
      amount: p.amount,
      client: (p.client && p.client.name) || '',
      phone: phoneText,
      CLIENT_CITY: (p.client && p.client.city) || '',
      BANK: cd.bankName || '',
      MOBILE: cd.cardMobile || '',
      CARD_NO: cardNo,
      BRAND: brand,
      EXPIRY: expiry,
      DUE_DATE: cd.dueDate || '',
      CARD_LIMIT: cd.cardLimit || '',
      TOTAL_BILL: cd.totalBill || '',
      PAID: cd.paid || '',
      NEED_TO_PAY: cd.needToPay || '',
      SWIPED: cd.swiped || '',
      HOLD_AMOUNT: cd.holdAmount || '',
      CHARGES_RATE: cd.chargesRate || '',
      CHARGES_AMOUNT: cd.chargesAmount || '',
      AMOUNT_SENT: cd.amountSent || '',
      RECEIVER_BANK: cd.receiverBankName || '',
      ACCOUNT_NO: cd.receiverAccount || '',
      actions
    };
  });
  table('adminReports', rows, ['id','date','time','branchId','userId','type','amount','client','phone','CLIENT_CITY','BANK','MOBILE','CARD_NO','BRAND','EXPIRY','DUE_DATE','CARD_LIMIT','TOTAL_BILL','PAID','NEED_TO_PAY','SWIPED','HOLD_AMOUNT','CHARGES_RATE','CHARGES_AMOUNT','AMOUNT_SENT','RECEIVER_BANK','ACCOUNT_NO','actions']);
  const start = (document.getElementById('rstart') && document.getElementById('rstart').value) || date || '';
  const end = (document.getElementById('rend') && document.getElementById('rend').value) || date || '';
  const qsRange = new URLSearchParams({ start, end, branchId });
  const rr = await api('/api/admin/reports/range?' + qsRange.toString());
  lastRangeRows = rr.rows || [];
  const labels = rr.rows.map((x) => x.date);
  const cashSeries = rr.rows.map((x) => x.cashTotal);
  const cardSeries = rr.rows.map((x) => x.cardTotal);
  const commCashSeries = rr.rows.map((x) => x.cardToCashCommission);
  const commBillSeries = rr.rows.map((x) => x.cardBillCommission);
  const dctx = document.getElementById('repDailyTotalsChart');
  if (repDailyTotalsChart) { try { repDailyTotalsChart.destroy(); } catch {} }
  if (dctx && window.Chart) {
    repDailyTotalsChart = new Chart(dctx, { type: 'line', data: { labels, datasets: [
      { label: 'Cash', data: cashSeries, borderColor: '#2C7BE5', backgroundColor: 'rgba(44,123,229,0.20)', tension: 0.3 },
      { label: 'Card', data: cardSeries, borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.20)', tension: 0.3 }
    ] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
  }
  const cctx = document.getElementById('repDailyCommissionChart');
  if (repDailyCommissionChart) { try { repDailyCommissionChart.destroy(); } catch {} }
  if (cctx && window.Chart) {
    repDailyCommissionChart = new Chart(cctx, { type: 'bar', data: { labels, datasets: [
      { label: 'Cash Commission', data: commCashSeries, backgroundColor: 'rgba(44,123,229,0.50)' },
      { label: 'Card Commission', data: commBillSeries, backgroundColor: 'rgba(255,179,0,0.60)' }
    ] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } } });
  }
  const br = await api('/api/admin/branches');
  const rateMap = new Map(br.branches.map((b) => [b.id, { cash: (typeof b.commissionRateCash === 'number' ? b.commissionRateCash : (typeof b.commissionRate === 'number' ? b.commissionRate : 0.02)), bill: (typeof b.commissionRateBill === 'number' ? b.commissionRateBill : (typeof b.commissionRate === 'number' ? b.commissionRate : 0.02)) }]));
  const cashAmt = r.payments.filter((p) => p.type === 'cash').reduce((s, p) => s + p.amount, 0);
  const cardAmt = r.payments.filter((p) => p.type === 'card').reduce((s, p) => s + p.amount, 0);
  const commCash = r.payments.filter((p) => p.type === 'cash').reduce((s, p) => {
    const rates = rateMap.get(p.branchId) || { cash: 0.02, bill: 0.02 };
    return s + p.amount * rates.cash;
  }, 0);
  const commBill = r.payments.filter((p) => p.type === 'card').reduce((s, p) => {
    const rates = rateMap.get(p.branchId) || { cash: 0.02, bill: 0.02 };
    return s + p.amount * rates.bill;
  }, 0);
  const kc = document.getElementById('repKpiCash'); if (kc) kc.textContent = Number(cashAmt.toFixed(2));
  const kd = document.getElementById('repKpiCard'); if (kd) kd.textContent = Number(cardAmt.toFixed(2));
  const km = document.getElementById('repKpiCommission'); if (km) km.textContent = Number((commCash + commBill).toFixed(2));
  const kn = document.getElementById('repKpiCount'); if (kn) kn.textContent = r.payments.length;
  const ctxT = document.getElementById('repTypeChart');
  if (repTypeChart) { try { repTypeChart.destroy(); } catch {} }
  if (ctxT && window.Chart) {
    repTypeChart = new Chart(ctxT, { type: 'bar', data: { labels: ['Cash','Card'], datasets: [{ label: 'Amount', data: [cashAmt, cardAmt], backgroundColor: ['rgba(44,123,229,0.50)','rgba(46,204,113,0.50)'] }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
  }
  const ctxC = document.getElementById('repCommissionChart');
  if (repCommissionChart) { try { repCommissionChart.destroy(); } catch {} }
  if (ctxC && window.Chart) {
    repCommissionChart = new Chart(ctxC, { type: 'doughnut', data: { labels: ['Cash Commission','Card Commission'], datasets: [{ data: [Number(commCash.toFixed(2)), Number(commBill.toFixed(2))], backgroundColor: ['#2C7BE5','#FFB300'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
  }
}

async function resetTransactions() {
  const ok = confirm('Reset all transactions across branches? This cannot be undone.');
  if (!ok) return;
  const r = await api('/api/admin/payments/reset', { method: 'POST' });
  if (!r.ok) { alert(r.error || 'Failed to reset'); return; }
  alert(`Reset done. Deleted ${r.deleted} payments.`);
  loadReports();
  loadReportsDashboard();
}

function downloadRangeCSV() {
  const rows = lastRangeRows || [];
  const header = ['DATE','CASH_TOTAL','CARD_TOTAL','CREDIT_CARD_TO_CASH_COMMISSION','CREDIT_CARD_BILL_PAYMENT_COMMISSION','COUNT'];
  const lines = [header.join(',')].concat(rows.map((r) => [r.date, r.cashTotal, r.cardTotal, r.cardToCashCommission, r.cardBillCommission, r.count].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')));
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'admin_range.csv';
  a.click();
}

async function loadCommission() {
  const date = document.getElementById('rdate').value;
  const qs = new URLSearchParams({ date });
  const r = await api('/api/admin/reports/commission?' + qs.toString());
  document.getElementById('commissionBox').textContent = `Commission: ${r.commissionAmount} (card payments: ${r.count})`;
}

async function loadReportsDashboard() {
  const date = document.getElementById('dashDate').value;
  const qs = new URLSearchParams({ date });
  const r = await api('/api/admin/reports/dashboard?' + qs.toString());
  const rows = r.rows.map((x) => ({ branch: x.branch, CREDIT_CARD_TO_CASH_RATE: (x.commissionRateCash*100).toFixed(2)+'%', CREDIT_CARD_BILL_PAYMENT_RATE: (x.commissionRateBill*100).toFixed(2)+'%', CASH_TOTAL: x.cashTotal, CARD_TOTAL: x.cardTotal, COMMISSION: x.commission, COUNT: x.count }));
  table('adminDash', rows, ['branch','CREDIT_CARD_TO_CASH_RATE','CREDIT_CARD_BILL_PAYMENT_RATE','CASH_TOTAL','CARD_TOTAL','COMMISSION','COUNT']);
  document.getElementById('dashTotals').textContent = `Totals — Cash: ${r.totals.cashTotal}, Card: ${r.totals.cardTotal}, Commission: ${r.totals.commission}, Count: ${r.totals.count}`;
  const kc = document.getElementById('kpiCash'); if (kc) kc.textContent = r.totals.cashTotal;
  const kd = document.getElementById('kpiCard'); if (kd) kd.textContent = r.totals.cardTotal;
  const km = document.getElementById('kpiCommission'); if (km) km.textContent = r.totals.commission;
  const kn = document.getElementById('kpiCount'); if (kn) kn.textContent = r.totals.count;
  const labels = r.rows.map((x) => x.branch);
  const cashData = r.rows.map((x) => x.cashTotal);
  const cardData = r.rows.map((x) => x.cardTotal);
  const commData = r.rows.map((x) => x.commission);
  const ctx1 = document.getElementById('chartTotals');
  if (chartTotals) { try { chartTotals.destroy(); } catch {} }
  if (ctx1 && window.Chart) {
    chartTotals = new Chart(ctx1, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Cash', data: cashData, backgroundColor: 'rgba(44,123,229,0.50)' },
        { label: 'Card', data: cardData, backgroundColor: 'rgba(46,204,113,0.50)' }
      ] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
  }
  const ctx2 = document.getElementById('chartComm');
  if (chartComm) { try { chartComm.destroy(); } catch {} }
  if (ctx2 && window.Chart) {
    chartComm = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: commData, backgroundColor: ['#2C7BE5','#2ECC71','#FFB300','#17C2EB','#E62E2E','#6366F1','#84CC16','#0EA5E9','#EAB308','#3B82F6'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
  const r2 = await api('/api/admin/reports/all?' + qs.toString());
  const rows2 = r.payments.map((p) => {
    const phoneText = p.client && p.client.phone ? p.client.phone : '';
    const receiptUrl = receiptUrlForPayment(p);
    const printLink = receiptUrl ? `<a class=\"btn btn-sm btn-outline-secondary\" href=\"${receiptUrl}&print=1\" target=\"_blank\">Print</a>` : '';
    const href = whatsappHrefForPayment(p);
    const shareLink = href ? `<a class=\"btn btn-sm btn-success\" href=\"${href}\" target=\"_blank\">Share</a>` : '';
    const actions = [printLink, shareLink].filter(Boolean).join(' ');
    const cardNo = p.card && p.card.last4 ? `•••• ${p.card.last4}` : '';
    const brand = p.card && p.card.brand ? p.card.brand : '';
    const expiry = p.card && p.card.expiry ? p.card.expiry : '';
    const cd = p.cardDetails || {};
    return { id: p.id, date: p.createdAt.slice(0,10), time: p.createdAt.slice(11,19), branch: p.branchName, type: p.type, amount: p.amount, commission: p.commissionAmount, client: (p.client && p.client.name) || '', phone: phoneText, BANK: cd.bankName || '', CARD_NO: cardNo, BRAND: brand, EXPIRY: expiry, DUE_DATE: cd.dueDate || '', SWIPED: cd.swiped || '', AMOUNT_SENT: cd.amountSent || '', CHARGES: cd.charges || '', CHARGES_AMOUNT: cd.chargesAmount || '', RECEIVER_BANK: cd.receiverBankName || '', ACCOUNT_NO: cd.receiverAccount || '', IFSC_CODE: cd.receiverIfsc || '', actions };
  });
  table('adminDashAll', rows2, ['id','date','time','branch','type','amount','commission','client','phone','BANK','CARD_NO','BRAND','EXPIRY','DUE_DATE','SWIPED','AMOUNT_SENT','CHARGES','CHARGES_AMOUNT','RECEIVER_BANK','ACCOUNT_NO','IFSC_CODE','actions']);
}

loadBranches();
loadCommissionSettings();
loadCompanyProfile();
const rsel = document.getElementById('rbranch');
if (rsel) rsel.addEventListener('change', () => { loadReports(); });
