async function loadReceipt() {
  const u = new URL(location.href);
  const id = u.searchParams.get('id');
  if (!id) { location.href = '/'; return; }
  const prof = await api('/api/admin/profile');
  const r = await api('/api/payment?id=' + encodeURIComponent(id));
  if (!r.ok) { alert(r.error || 'Not found'); return; }
  const p = r.payment;
  document.getElementById('receiptId').textContent = `Receipt #${p.id}`;
  if (prof && prof.ok && prof.profile) {
    const cp = prof.profile;
    const nameEl = document.getElementById('companyName'); if (nameEl) nameEl.textContent = cp.companyName || 'Sathiya Payments';
    const ct = [];
    if (cp.phone) ct.push(cp.phone);
    if (cp.email) ct.push(cp.email);
    const adr = cp.address || {};
    const addrText = [adr.line1, adr.line2, adr.city, adr.state, adr.pincode].filter(Boolean).join(', ');
    if (addrText) ct.push(addrText);
    const contactEl = document.getElementById('companyContact'); if (contactEl) contactEl.textContent = ct.join(' • ');
    const logoEl = document.getElementById('companyLogo'); if (logoEl && cp.logoDataUrl) { logoEl.src = cp.logoDataUrl; logoEl.style.display = 'block'; }
  }
  document.getElementById('clientName').textContent = `Name: ${p.client && p.client.name ? p.client.name : ''}`;
  document.getElementById('clientPhone').textContent = `Phone: ${p.client && p.client.phone ? p.client.phone : ''}`;
  document.getElementById('payDate').textContent = `Date: ${p.createdAt.slice(0,10)} ${p.createdAt.slice(11,19)}`;
  document.getElementById('payType').textContent = `Type: ${p.type}`;
  document.getElementById('amount').textContent = `Amount: ${p.amount}`;
  document.getElementById('branchName').textContent = r.branch ? `${r.branch.name} (#${r.branch.id})` : p.branchId;
  document.getElementById('userName').textContent = r.user ? `${r.user.name} (#${r.user.id})` : '—';
  if (p.type === 'card' || p.cardDetails) {
    const box = document.getElementById('cardInfo');
    if (box) { box.classList.remove('d-none'); }
    const brandText = p.card ? `${p.card.brand} •••• ${p.card.last4}` : '';
    const bankText = p.cardDetails && p.cardDetails.bankName ? p.cardDetails.bankName : '';
    const dueText = p.cardDetails && p.cardDetails.dueDate ? p.cardDetails.dueDate : '';
    const totals = p.cardDetails ? `Swiped: ${p.cardDetails.swiped || 0}` : '';
    const charges = p.cardDetails ? `Charges: ${p.cardDetails.charges || ''} (${p.cardDetails.chargesAmount || 0})` : '';
    const b1 = document.getElementById('cardBrand'); if (b1) b1.textContent = brandText;
    const b2 = document.getElementById('cardBank'); if (b2) b2.textContent = bankText ? `Bank: ${bankText}` : '';
    const b3 = document.getElementById('cardDue'); if (b3) b3.textContent = dueText ? `Due: ${dueText}` : '';
    const b4 = document.getElementById('cardTotals'); if (b4) b4.textContent = totals;
    const b5 = document.getElementById('cardCharges'); if (b5) b5.textContent = charges;
    if ((p.commissionType || 'card_to_cash') === 'card_to_cash') {
      const ctc = document.getElementById('ctcBox'); if (ctc) ctc.classList.remove('d-none');
      const s1 = document.getElementById('ctcSwiped'); if (s1) s1.textContent = `Amount Swiped: ${p.cardDetails && p.cardDetails.swiped ? p.cardDetails.swiped : 0}`;
      const s2 = document.getElementById('ctcSent'); if (s2) s2.textContent = `Amount Sent: ${p.cardDetails && p.cardDetails.amountSent ? p.cardDetails.amountSent : 0}`;
      const s3 = document.getElementById('ctcRecvBank'); if (s3) s3.textContent = p.cardDetails && p.cardDetails.receiverBankName ? `Receiver Bank: ${p.cardDetails.receiverBankName}` : '';
      const s4 = document.getElementById('ctcRecvAcc'); if (s4) s4.textContent = p.cardDetails && p.cardDetails.receiverAccount ? `Account No.: ${p.cardDetails.receiverAccount}` : '';
      const s5 = document.getElementById('ctcRecvIfsc'); if (s5) s5.textContent = p.cardDetails && p.cardDetails.receiverIfsc ? `IFSC: ${p.cardDetails.receiverIfsc}` : '';
    }
  }
  const waBtn = document.getElementById('waBtn');
  const href = whatsappHrefForPayment(p);
  if (href) waBtn.addEventListener('click', () => window.open(href, '_blank'));
  else waBtn.disabled = true;
  if (u.searchParams.get('print') === '1') { setTimeout(() => window.print(), 200); }
}

loadReceipt();
