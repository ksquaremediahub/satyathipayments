const s = ensureRole('branch');
const bt = document.getElementById('branchTitle');
if (bt) bt.textContent = `Branch: ${s.branchName}`;
let branchTypeChart;
let branchCommissionChart;

// Card-to-Cash details always visible


async function submitBranchPayment() {
  const type = document.getElementById('ptype').value;
  const swiped = Number((document.getElementById('swipedAmount') && document.getElementById('swipedAmount').value) || 0);
  const cashSwiped = Number((document.getElementById('cashSwipedAmount') && document.getElementById('cashSwipedAmount').value) || 0);
  const amount = type === 'card' ? swiped : cashSwiped;
  const client = { name: document.getElementById('cname').value.trim(), phone: document.getElementById('cphone').value.trim(), city: (document.getElementById('ccity') && document.getElementById('ccity').value.trim()) || '' };
  const userId = null;
  const card = type === 'card'
    ? { number: document.getElementById('cnum').value.trim(), expiry: document.getElementById('cexp').value.trim() }
    : { number: (document.getElementById('cashCardNo') && document.getElementById('cashCardNo').value.trim()) || '', expiry: (document.getElementById('cashExpDate') && document.getElementById('cashExpDate').value.trim()) || '' };
  const cardDetails = type === 'card' ? {
    bankName: (document.getElementById('bankName') && document.getElementById('bankName').value.trim()) || '',
    dueDate: (document.getElementById('dueDate') && document.getElementById('dueDate').value) || '',
    swiped: swiped,
    cardLimit: Number((document.getElementById('cardLimit') && document.getElementById('cardLimit').value) || 0),
    totalBill: Number((document.getElementById('totalBill') && document.getElementById('totalBill').value) || 0),
    paid: Number((document.getElementById('billPaid') && document.getElementById('billPaid').value) || 0),
    needToPay: Number((document.getElementById('needToPay') && document.getElementById('needToPay').value) || 0),
    holdAmount: Number((document.getElementById('holdAmount') && document.getElementById('holdAmount').value) || 0),
    chargesRate: Number((document.getElementById('chargesRate') && document.getElementById('chargesRate').value) || 0),
    chargesAmount: Number((document.getElementById('chargesAmount') && document.getElementById('chargesAmount').value) || 0),
    cardMobile: (document.getElementById('cardMobile') && document.getElementById('cardMobile').value.trim()) || ''
  } : {
    bankName: (document.getElementById('cashBankName') && document.getElementById('cashBankName').value.trim()) || '',
    swiped: Number((document.getElementById('cashSwipedAmount') && document.getElementById('cashSwipedAmount').value) || 0),
    chargesRate: Number((document.getElementById('cashChargesRate') && document.getElementById('cashChargesRate').value) || 0),
    chargesAmount: Number((document.getElementById('cashChargesAmount') && document.getElementById('cashChargesAmount').value) || 0),
    amountSent: Number((document.getElementById('cashAmountSent') && document.getElementById('cashAmountSent').value) || 0),
    receiverBankName: (document.getElementById('cashReceiverBankName') && document.getElementById('cashReceiverBankName').value.trim()) || '',
    receiverAccount: (document.getElementById('cashReceiverAccount') && document.getElementById('cashReceiverAccount').value.trim()) || '',
    cardMobile: (document.getElementById('cashMobile') && document.getElementById('cashMobile').value.trim()) || ''
  };
  const shareChecked = document.getElementById('shareWaBranch') && document.getElementById('shareWaBranch').checked;
  let waWindow = null;
  if (shareChecked) { try { waWindow = window.open('', '_blank'); } catch {}
  }
  {
    const err = validateBeforePay();
    const msg = document.getElementById('pmsg');
    if (err) { if (msg) { msg.className = 'text-danger'; msg.textContent = err; } return; }
  }
  const r = await api('/api/payments', { method: 'POST', body: { type, amount, client, card, cardDetails, userId, branchId: s.branchId } });
  const msg = document.getElementById('pmsg');
  if (!r.ok) { msg.className = 'text-danger'; msg.textContent = r.error || 'Payment failed'; } else {
    msg.className = 'text-success';
    const href = whatsappHrefForPayment(r.payment);
    if (href && shareChecked) {
      if (waWindow) { try { waWindow.location = href; } catch {} } else { window.open(href, '_blank'); }
    } else if (waWindow) { try { waWindow.close(); } catch {} }
    if (href) {
      const phone = r.payment.client && r.payment.client.phone ? r.payment.client.phone : 'WhatsApp';
      const receiptUrl = receiptUrlForPayment(r.payment);
      const printLink = receiptUrl ? `<a href="${receiptUrl}" target="_blank">View Receipt</a>` : '';
      msg.innerHTML = `Payment successful — ${printLink} &nbsp; <a href="${href}" target="_blank">Share to WhatsApp (${phone})</a>`;
    } else {
      const receiptUrl = receiptUrlForPayment(r.payment);
      msg.innerHTML = receiptUrl ? `Payment successful — <a href="${receiptUrl}" target="_blank">View Receipt</a>` : 'Payment successful';
    }
    loadBranchReports();
  }
}

async function loadBranchReports() {
  const date = document.getElementById('date').value;
  const q = (document.getElementById('searchTextBranch') && document.getElementById('searchTextBranch').value) || '';
  const qs = new URLSearchParams({ branchId: s.branchId, date, q });
  const r = await api('/api/branch/reports?' + qs.toString());
  const rows = r.payments.map((p) => {
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
    const base = {
      id: p.id,
      date: p.createdAt.slice(0,10),
      time: p.createdAt.slice(11,19),
      userId: p.userId,
      type: p.type,
      amount: p.amount,
      client: (p.client && p.client.name) || '',
      phone: phoneText,
      BANK: cd.bankName || '',
      CARD_NO: cardNo,
      BRAND: brand,
      EXPIRY: expiry,
      DUE_DATE: cd.dueDate || '',
      SWIPED: cd.swiped || '',
      CHARGES: cd.charges || '',
      CHARGES_AMOUNT: cd.chargesAmount || '',
      AMOUNT_SENT: cd.amountSent || '',
      RECEIVER_BANK: cd.receiverBankName || '',
      ACCOUNT_NO: cd.receiverAccount || '',
      IFSC_CODE: cd.receiverIfsc || ''
    };
    return { ...base, actions };
  });
  table('branchTable', rows, ['id','date','time','userId','type','amount','client','phone','BANK','CARD_NO','BRAND','EXPIRY','DUE_DATE','SWIPED','AMOUNT_SENT','CHARGES','CHARGES_AMOUNT','RECEIVER_BANK','ACCOUNT_NO','IFSC_CODE','actions']);
  const br = await api('/api/admin/branches');
  const rates = br.branches.find((b) => b.id === s.branchId) || {};
  const billRate = typeof rates.commissionRateBill === 'number' ? rates.commissionRateBill : (typeof rates.commissionRate === 'number' ? rates.commissionRate : 0.02);
  const cashAmt = r.payments.filter((p) => p.type === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const cardAmt = r.payments.filter((p) => p.type === 'card').reduce((sum, p) => sum + p.amount, 0);
  const commCash = r.payments.filter((p) => p.type === 'cash').reduce((sum, p) => sum + p.amount * (typeof rates.commissionRateCash === 'number' ? rates.commissionRateCash : (typeof rates.commissionRate === 'number' ? rates.commissionRate : 0.02)), 0);
  const commBill = r.payments.filter((p) => p.type === 'card').reduce((sum, p) => sum + p.amount * billRate, 0);
  const kc = document.getElementById('bkpiCash'); if (kc) kc.textContent = Number(cashAmt.toFixed(2));
  const kd = document.getElementById('bkpiCard'); if (kd) kd.textContent = Number(cardAmt.toFixed(2));
  const km = document.getElementById('bkpiCommission'); if (km) km.textContent = Number((commCash + commBill).toFixed(2));
  const kn = document.getElementById('bkpiCount'); if (kn) kn.textContent = r.payments.length;
  const ctxT = document.getElementById('branchTypeChart');
  if (branchTypeChart) { try { branchTypeChart.destroy(); } catch {} }
  if (ctxT && window.Chart) {
    branchTypeChart = new Chart(ctxT, { type: 'bar', data: { labels: ['Cash','Card'], datasets: [{ label: 'Amount', data: [Number(cashAmt.toFixed(2)), Number(cardAmt.toFixed(2))], backgroundColor: ['rgba(44,123,229,0.50)','rgba(46,204,113,0.50)'] }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
  }
  const ctxC = document.getElementById('branchCommissionChart');
  if (branchCommissionChart) { try { branchCommissionChart.destroy(); } catch {} }
  if (ctxC && window.Chart) {
    branchCommissionChart = new Chart(ctxC, { type: 'doughnut', data: { labels: ['Cash Commission','Card Commission'], datasets: [{ data: [Number(commCash.toFixed(2)), Number(commBill.toFixed(2))], backgroundColor: ['#2C7BE5','#FFB300'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
  }
}

loadBranchReports();

function validateBeforePay() {
  const clear = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('is-invalid'); const err = document.getElementById('err_' + id); if (err) err.textContent = ''; };
  const inv = (id, msg) => { const el = document.getElementById(id); if (el) el.classList.add('is-invalid'); const err = document.getElementById('err_' + id); if (err) err.textContent = msg || 'Invalid'; };
  ['cname','cphone','ccity','cnum','cexp','bankName','dueDate','swipedAmount','cardLimit','chargesRate','chargesAmount','totalBill','billPaid','needToPay','holdAmount','cardMobile','cashBankName','cashMobile','cashCardNo','cashExpDate','cashSwipedAmount','cashChargesRate','cashChargesAmount','cashAmountSent','cashReceiverBankName','cashReceiverAccount'].forEach(clear);
  const type = (document.getElementById('ptype') && document.getElementById('ptype').value) || 'card';
  const num = (document.getElementById('cnum') && document.getElementById('cnum').value.trim()) || '';
  const exp = (document.getElementById('cexp') && document.getElementById('cexp').value.trim()) || '';
  const bank = (document.getElementById('bankName') && document.getElementById('bankName').value.trim()) || '';
  const due = (document.getElementById('dueDate') && document.getElementById('dueDate').value) || '';
  const swiped = Number((document.getElementById('swipedAmount') && document.getElementById('swipedAmount').value) || 0);
  const chargesRate = Number((document.getElementById('chargesRate') && document.getElementById('chargesRate').value) || 0);
  const chargesAmt = Number((document.getElementById('chargesAmount') && document.getElementById('chargesAmount').value) || 0);
  const cardLimit = Number((document.getElementById('cardLimit') && document.getElementById('cardLimit').value) || 0);
  const totalBill = Number((document.getElementById('totalBill') && document.getElementById('totalBill').value) || 0);
  const paid = Number((document.getElementById('billPaid') && document.getElementById('billPaid').value) || 0);
  const need = Number((document.getElementById('needToPay') && document.getElementById('needToPay').value) || 0);
  const hold = Number((document.getElementById('holdAmount') && document.getElementById('holdAmount').value) || 0);
  const cname = (document.getElementById('cname') && document.getElementById('cname').value.trim()) || '';
  const cphone = (document.getElementById('cphone') && document.getElementById('cphone').value.trim()) || '';
  const ccity = (document.getElementById('ccity') && document.getElementById('ccity').value.trim()) || '';
  const cardMobile = (document.getElementById('cardMobile') && document.getElementById('cardMobile').value.trim()) || '';
  const cashBankName = (document.getElementById('cashBankName') && document.getElementById('cashBankName').value.trim()) || '';
  const cashMobile = (document.getElementById('cashMobile') && document.getElementById('cashMobile').value.trim()) || '';
  const cashCardNo = (document.getElementById('cashCardNo') && document.getElementById('cashCardNo').value.trim()) || '';
  const cashExpDate = (document.getElementById('cashExpDate') && document.getElementById('cashExpDate').value.trim()) || '';
  const cashSwiped = Number((document.getElementById('cashSwipedAmount') && document.getElementById('cashSwipedAmount').value) || 0);
  const cashChargesRate = Number((document.getElementById('cashChargesRate') && document.getElementById('cashChargesRate').value) || 0);
  const cashChargesAmount = Number((document.getElementById('cashChargesAmount') && document.getElementById('cashChargesAmount').value) || 0);
  const cashAmountSent = Number((document.getElementById('cashAmountSent') && document.getElementById('cashAmountSent').value) || 0);
  const cashReceiverBankName = (document.getElementById('cashReceiverBankName') && document.getElementById('cashReceiverBankName').value.trim()) || '';
  const cashReceiverAccount = (document.getElementById('cashReceiverAccount') && document.getElementById('cashReceiverAccount').value.trim()) || '';
  let bad = 0;
  if (type === 'cash') {
    if (!cashBankName) { inv('cashBankName','Enter bank name'); bad++; }
    const cashMobDigits = cashMobile.replace(/\D/g,'');
    if (cashMobDigits.length !== 10) { inv('cashMobile','Enter 10-digit mobile'); bad++; }
    if (!cashCardNo || cashCardNo.replace(/\D/g, '').length < 12) { inv('cashCardNo','Enter a valid card number'); bad++; }
    if (!cashExpDate) { inv('cashExpDate','Enter expiry'); bad++; }
    if (!cashSwiped || cashSwiped <= 0) { inv('cashSwipedAmount','Enter amount swiped'); bad++; }
    if (cashChargesRate < 0) { inv('cashChargesRate','Cannot be negative'); bad++; }
    if (cashChargesAmount < 0) { inv('cashChargesAmount','Cannot be negative'); bad++; }
    if (cashAmountSent < 0) { inv('cashAmountSent','Cannot be negative'); bad++; }
    if (!cashReceiverBankName) { inv('cashReceiverBankName','Enter beneficiary bank'); bad++; }
    if (!cashReceiverAccount) { inv('cashReceiverAccount','Enter account number'); bad++; }
  }
  if (!cname) { inv('cname','Enter client name'); bad++; }
  const digits = cphone.replace(/\D/g,'');
  if (digits.length !== 10) { inv('cphone','Enter 10-digit mobile'); bad++; }
  if (!ccity) { inv('ccity','Enter city'); bad++; }
  if (type === 'card') {
    if (!num || num.replace(/\D/g, '').length < 12) { inv('cnum','Enter a valid card number'); bad++; }
    if (!exp) { inv('cexp','Enter expiry'); bad++; }
    if (!bank) { inv('bankName','Enter bank name'); bad++; }
    const cmDigits = cardMobile.replace(/\D/g,'');
    if (cmDigits.length !== 10) { inv('cardMobile','Enter 10-digit mobile'); bad++; }
    if (!swiped || swiped <= 0) { inv('swipedAmount','Enter amount swiped'); bad++; }
    if (cardLimit < 0) { inv('cardLimit','Cannot be negative'); bad++; }
    if (totalBill < 0) { inv('totalBill','Cannot be negative'); bad++; }
    if (paid < 0) { inv('billPaid','Cannot be negative'); bad++; }
    if (need < 0) { inv('needToPay','Cannot be negative'); bad++; }
    if (hold < 0) { inv('holdAmount','Cannot be negative'); bad++; }
  }
  if (swiped < 0) { inv('swipedAmount','Cannot be negative'); bad++; }
  if (chargesRate < 0) { inv('chargesRate','Cannot be negative'); bad++; }
  if (chargesAmt < 0) { inv('chargesAmount','Cannot be negative'); bad++; }
  return bad ? 'Please fix the highlighted fields' : '';
}

document.addEventListener('DOMContentLoaded', function(){
  const sel = document.getElementById('ptype');
  const cardBox = document.getElementById('cardBox');
  const cashBox = document.getElementById('cashBox');
  const clearIds = (ids) => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.classList.remove('is-invalid'); }
      const err = document.getElementById('err_' + id);
      if (err) err.textContent = '';
    });
  };
  const cardIds = ['cnum','cexp','bankName','dueDate','swipedAmount','cardLimit','chargesRate','chargesAmount','totalBill','billPaid','needToPay','holdAmount','cardMobile'];
  const cashIds = ['cashBankName','cashMobile','cashCardNo','cashExpDate','cashSwipedAmount','cashChargesRate','cashChargesAmount','cashAmountSent','cashReceiverBankName','cashReceiverAccount'];
  const toggle = () => {
    const t = (sel && sel.value) || 'card';
    if (cardBox) cardBox.style.display = t === 'card' ? '' : 'none';
    if (cashBox) cashBox.style.display = t === 'cash' ? '' : 'none';
    if (t === 'cash') clearIds(cardIds);
    else clearIds(cashIds);
  };
  if (sel) sel.addEventListener('change', toggle);
  toggle();
});
const tb = document.getElementById('totalBill');
const bp = document.getElementById('billPaid');
const ntp = document.getElementById('needToPay');
if (tb && bp && ntp) {
  const recalc = () => { const t = Number(tb.value || 0); const p = Number(bp.value || 0); ntp.value = String(Math.max(0, t - p)); };
  tb.addEventListener('input', recalc);
  bp.addEventListener('input', recalc);
}
