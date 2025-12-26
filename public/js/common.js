async function api(url, opts = {}) {
  const method = opts.method || 'GET';
  const headers = { 'Content-Type': 'application/json' };
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const base = (typeof window !== 'undefined' && (window.API_BASE || localStorage.getItem('API_BASE'))) || '';
  const fullUrl = base ? (base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '')) : url;
  const r = await fetch(fullUrl, { method, headers, body });
  return await r.json();
}

function logout() {
  localStorage.removeItem('session');
  window.location.href = '/';
}

function ensureRole(role) {
  const s = JSON.parse(localStorage.getItem('session') || '{}');
  if (s.role !== role) window.location.href = '/';
  return s;
}

function table(id, rows, header) {
  const el = document.getElementById(id);
  const h = header || Object.keys(rows[0] || {});
  let html = '<thead><tr>' + h.map((x) => `<th>${x}</th>`).join('') + '</tr></thead><tbody>';
  html += rows.map((r) => '<tr>' + h.map((x) => `<td>${r[x] ?? ''}</td>`).join('') + '</tr>').join('');
  html += '</tbody>';
  el.innerHTML = html;
}

function downloadCSV(tableId) {
  const tableEl = document.getElementById(tableId);
  const rows = [...tableEl.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => '"' + String(td.textContent).replace(/"/g, '""') + '"').join(','));
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${tableId}.csv`;
  a.click();
}

function sanitizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function whatsappHrefForPayment(p) {
  const phone = sanitizePhone(p.client && p.client.phone);
  if (!phone) return '';
  const date = p.createdAt ? p.createdAt.slice(0,10) : '';
  const time = p.createdAt ? p.createdAt.slice(11,19) : '';
  const lines = [
    'Payment Receipt',
    `ID: #${p.id}`,
    `Date: ${date} ${time}`,
    `Client: ${p.client && p.client.name ? p.client.name : ''}`,
    `Amount: ${p.amount}`,
    `Type: ${p.type}`,
    `Branch: ${p.branchId}`,
    `User: ${p.userId}`
  ];
  const receiptUrl = receiptUrlForPayment(p);
  if (receiptUrl) lines.push(`Receipt: ${location.origin}${receiptUrl}`);
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${phone}?text=${text}`;
}

function receiptUrlForPayment(p) {
  if (!p || !p.id) return '';
  return `/receipt.html?id=${p.id}`;
}
async function loadHeaderLogo() {
  try {
    const r = await api('/api/admin/profile');
    if (!r || !r.ok || !r.profile) return;
    const el = document.getElementById('companyLogoHeader');
    if (el && r.profile.logoDataUrl) { el.src = r.profile.logoDataUrl; el.style.display = 'inline-block'; }
  } catch {}
}
if (document.getElementById('companyLogoHeader')) loadHeaderLogo();
async function loadModalCompanyProfile() {
  const r = await api('/api/admin/profile');
  const p = (r && r.profile) || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('cpName', p.companyName || '');
  set('cpPhone', p.phone || '');
  set('cpEmail', p.email || '');
  const a = p.address || {};
  set('cpAddr1', a.line1 || '');
  set('cpAddr2', a.line2 || '');
  set('cpCity', a.city || '');
  set('cpState', a.state || '');
  set('cpPincode', a.pincode || '');
  const img = document.getElementById('cpLogoPreview');
  if (img) { if (p.logoDataUrl) { img.src = p.logoDataUrl; img.style.display = 'inline-block'; } else { img.style.display = 'none'; } }
}
function setupCompanyProfileModal() {
  const icon = document.getElementById('companyLogoHeader');
  const modalEl = document.getElementById('companyProfileModal');
  const saveBtn = document.getElementById('cpSaveBtn');
  const fileInput = document.getElementById('cpLogoInput');
  const img = document.getElementById('cpLogoPreview');
  if (fileInput && img) {
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { img.src = String(reader.result || ''); img.style.display = 'inline-block'; };
      reader.readAsDataURL(f);
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const companyName = (document.getElementById('cpName') && document.getElementById('cpName').value.trim()) || '';
      const phone = (document.getElementById('cpPhone') && document.getElementById('cpPhone').value.trim()) || '';
      const email = (document.getElementById('cpEmail') && document.getElementById('cpEmail').value.trim()) || '';
      const address = {
        line1: (document.getElementById('cpAddr1') && document.getElementById('cpAddr1').value.trim()) || '',
        line2: (document.getElementById('cpAddr2') && document.getElementById('cpAddr2').value.trim()) || '',
        city: (document.getElementById('cpCity') && document.getElementById('cpCity').value.trim()) || '',
        state: (document.getElementById('cpState') && document.getElementById('cpState').value.trim()) || '',
        pincode: (document.getElementById('cpPincode') && document.getElementById('cpPincode').value.trim()) || ''
      };
      let logoDataUrl = '';
      const f = document.getElementById('cpLogoInput');
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
      if (r && r.ok) {
        try { await loadHeaderLogo(); } catch {}
        if (modalEl && window.bootstrap) { try { bootstrap.Modal.getInstance(modalEl)?.hide(); } catch {} }
      } else {
        alert((r && r.error) || 'Failed to save');
      }
    });
  }
  if (icon && modalEl && window.bootstrap) {
    icon.style.cursor = 'pointer';
    icon.addEventListener('click', async () => {
      await loadModalCompanyProfile();
      const m = new bootstrap.Modal(modalEl);
      m.show();
    });
  }
}
document.addEventListener('DOMContentLoaded', setupCompanyProfileModal);
