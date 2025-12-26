const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
require('dotenv').config();
const mongoose = require('mongoose');
const { initSequelize, getModels: getSqlModels } = require('./sequelize-db');

const DATA_PATH = path.join(__dirname, 'data', 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const MYSQL_URI = process.env.MYSQL_URI;

// --- Data Layer Abstraction ---
let useMongo = false;
let useMySQL = false;
let sqlModels = {};

// Mongoose Schemas (Keep existing)
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  profile: {
    companyName: String,
    phone: String,
    email: String,
    address: { line1: String, line2: String, city: String, state: String, pincode: String },
    logoDataUrl: String
  },
  profileHistory: [Object]
});
const Admin = mongoose.model('Admin', adminSchema);

const branchSchema = new mongoose.Schema({
  id: Number,
  name: String,
  login: String,
  password: String,
  commissionRateCash: Number,
  commissionRateBill: Number,
  ownerName: String,
  phone: String,
  email: String,
  address: { line1: String, line2: String, city: String, state: String, pincode: String }
});
const Branch = mongoose.model('Branch', branchSchema);

const userSchema = new mongoose.Schema({
  id: Number,
  branchId: Number,
  name: String,
  username: String,
  password: String,
  active: Boolean
});
const User = mongoose.model('User', userSchema);

const paymentSchema = new mongoose.Schema({
  id: Number,
  amount: Number,
  type: String,
  commissionType: String,
  userId: Number,
  branchId: Number,
  client: Object,
  card: Object,
  cardDetails: Object,
  status: String,
  createdAt: String
});
const Payment = mongoose.model('Payment', paymentSchema);

async function connectDB() {
  // Priority: MySQL > Mongo > JSON
  if (MYSQL_URI) {
    try {
      const { sequelize, models } = initSequelize(MYSQL_URI);
      await sequelize.authenticate();
      await sequelize.sync(); // Auto-create tables
      sqlModels = models;
      useMySQL = true;
      console.log('Connected to MySQL');

      // Init Admin
      const admin = await sqlModels.Admin.findOne();
      if (!admin) {
        await sqlModels.Admin.create({
          username: 'admin',
          password: 'admin123',
          profile: { companyName: '', phone: '', email: '', address: { line1: '', line2: '', city: '', state: '', pincode: '' }, logoDataUrl: '' },
          profileHistory: []
        });
      }
      return;
    } catch (err) {
      console.error('MySQL connection error:', err);
    }
  }

  if (MONGO_URI) {
    try {
      await mongoose.connect(MONGO_URI);
      useMongo = true;
      console.log('Connected to MongoDB');
      const admin = await Admin.findOne();
      if (!admin) {
        await new Admin({
          username: 'admin',
          password: 'admin123',
          profile: { companyName: '', phone: '', email: '', address: { line1: '', line2: '', city: '', state: '', pincode: '' }, logoDataUrl: '' },
          profileHistory: []
        }).save();
      }
      return;
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }

  console.log('Using local JSON file storage (WARNING: Data will be lost on Render restart).');
}

connectDB();

function ensureDataFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    const initial = {
      admin: { username: 'admin', password: 'admin123', profile: { companyName: '', phone: '', email: '', address: { line1: '', line2: '', city: '', state: '', pincode: '' }, logoDataUrl: '' }, profileHistory: [] },
      branches: [],
      users: [],
      payments: []
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
  }
}

function readDataSync() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!data.admin) data.admin = { username: 'admin', password: 'admin123' };
  if (!data.admin.profile) {
    data.admin.profile = {
      companyName: '',
      phone: '',
      email: '',
      address: { line1: '', line2: '', city: '', state: '', pincode: '' },
      logoDataUrl: ''
    };
  }
  if (!data.admin.profileHistory) data.admin.profileHistory = [];
  return data;
}

function writeDataSync(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Helper to get all data in the structure expected by the app
async function getAllData() {
  if (useMySQL) {
    // MySQL returns Sequelize instances, need totoJSON() or .get({plain: true}) usually
    // But for basic usage we can map.
    const admin = await sqlModels.Admin.findOne() || { username: 'admin', password: 'admin123', profile: {}, profileHistory: [] };
    const branches = await sqlModels.Branch.findAll();
    const users = await sqlModels.User.findAll();
    const payments = await sqlModels.Payment.findAll();
    return { admin, branches, users, payments };
  } else if (useMongo) {
    const admin = await Admin.findOne() || { username: 'admin', password: 'admin123', profile: {}, profileHistory: [] };
    const branches = await Branch.find();
    const users = await User.find();
    const payments = await Payment.find();
    return { admin, branches, users, payments };
  } else {
    return readDataSync();
  }
}

// Helper for ID generation
async function getNextId(model, list) {
  if (useMySQL) {
    // Sequelize max
    const max = await model.max('id');
    return (max || 0) + 1;
  } else if (useMongo) {
    const last = await model.findOne().sort({ id: -1 });
    return last ? last.id + 1 : 1;
  } else {
    return list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
  }
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function serveStatic(req, res) {
  let pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  if (req.method === 'OPTIONS') { sendJSON(res, 200, { ok: true }); return; }

  try {
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const { role, username, password } = body;
      
      if (role === 'admin') {
        let admin;
        if (useMySQL) {
          admin = await sqlModels.Admin.findOne({ where: { username, password } });
        } else if (useMongo) {
          admin = await Admin.findOne({ username, password });
        } else {
          const data = readDataSync();
          if (username === data.admin.username && password === data.admin.password) admin = data.admin;
        }
        
        if (admin) { sendJSON(res, 200, { ok: true, role: 'admin' }); } else { sendJSON(res, 401, { ok: false, error: 'Invalid admin credentials' }); }
        return;
      }
      if (role === 'branch') {
        let branch;
        if (useMySQL) {
          branch = await sqlModels.Branch.findOne({ where: { login: username, password } });
        } else if (useMongo) {
          branch = await Branch.findOne({ login: username, password });
        } else {
          const data = readDataSync();
          branch = data.branches.find((b) => b.login === username && b.password === password);
        }
        
        if (branch) { sendJSON(res, 200, { ok: true, role: 'branch', branchId: branch.id, branchName: branch.name }); } else { sendJSON(res, 401, { ok: false, error: 'Invalid branch credentials' }); }
        return;
      }
      sendJSON(res, 400, { ok: false, error: 'Unknown role' });
      return;
    }

    if (pathname === '/api/admin/profile' && req.method === 'GET') {
      let profile, history;
      if (useMySQL) {
        const admin = await sqlModels.Admin.findOne();
        profile = admin ? admin.profile : {};
        history = admin ? admin.profileHistory : [];
      } else if (useMongo) {
        const admin = await Admin.findOne();
        profile = admin ? admin.profile : {};
        history = admin ? admin.profileHistory : [];
      } else {
        const data = readDataSync();
        profile = data.admin.profile;
        history = data.admin.profileHistory;
      }
      sendJSON(res, 200, { ok: true, profile, history });
      return;
    }

    if (pathname === '/api/admin/profile' && req.method === 'PUT') {
      const body = await parseBody(req);
      if (useMySQL) {
        const admin = await sqlModels.Admin.findOne();
        // Sequelize objects are immutable by default for `prev` copy? No, just JS objects.
        const prev = admin.profile ? JSON.parse(JSON.stringify(admin.profile)) : null;
        const p = admin.profile || {};
        p.companyName = String(body.companyName || p.companyName || '');
        p.phone = String(body.phone || p.phone || '');
        p.email = String(body.email || p.email || '');
        p.address = {
          line1: String((body.address && body.address.line1) || (p.address && p.address.line1) || ''),
          line2: String((body.address && body.address.line2) || (p.address && p.address.line2) || ''),
          city: String((body.address && body.address.city) || (p.address && p.address.city) || ''),
          state: String((body.address && body.address.state) || (p.address && p.address.state) || ''),
          pincode: String((body.address && body.address.pincode) || (p.address && p.address.pincode) || '')
        };
        if (typeof body.logoDataUrl === 'string') p.logoDataUrl = body.logoDataUrl;
        
        // Sequelize JSON updates need explicit set or new object
        admin.profile = p;
        let hist = admin.profileHistory || [];
        if (prev) {
          hist.push({ timestamp: new Date().toISOString(), previous: prev });
          admin.profileHistory = hist; // Update field
        }
        await admin.save();
        sendJSON(res, 200, { ok: true, profile: p });
      } else if (useMongo) {
        const admin = await Admin.findOne();
        const prev = admin.profile ? JSON.parse(JSON.stringify(admin.profile)) : null;
        const p = admin.profile || {};
        p.companyName = String(body.companyName || p.companyName || '');
        p.phone = String(body.phone || p.phone || '');
        p.email = String(body.email || p.email || '');
        p.address = {
          line1: String((body.address && body.address.line1) || (p.address && p.address.line1) || ''),
          line2: String((body.address && body.address.line2) || (p.address && p.address.line2) || ''),
          city: String((body.address && body.address.city) || (p.address && p.address.city) || ''),
          state: String((body.address && body.address.state) || (p.address && p.address.state) || ''),
          pincode: String((body.address && body.address.pincode) || (p.address && p.address.pincode) || '')
        };
        if (typeof body.logoDataUrl === 'string') p.logoDataUrl = body.logoDataUrl;
        
        admin.profile = p;
        if (prev) {
          admin.profileHistory.push({ timestamp: new Date().toISOString(), previous: prev });
        }
        await admin.save();
        sendJSON(res, 200, { ok: true, profile: p });
      } else {
        const data = readDataSync();
        const prev = data.admin.profile ? JSON.parse(JSON.stringify(data.admin.profile)) : null;
        const p = data.admin.profile || {};
        p.companyName = String(body.companyName || p.companyName || '');
        p.phone = String(body.phone || p.phone || '');
        p.email = String(body.email || p.email || '');
        p.address = {
          line1: String((body.address && body.address.line1) || (p.address && p.address.line1) || ''),
          line2: String((body.address && body.address.line2) || (p.address && p.address.line2) || ''),
          city: String((body.address && body.address.city) || (p.address && p.address.city) || ''),
          state: String((body.address && body.address.state) || (p.address && p.address.state) || ''),
          pincode: String((body.address && body.address.pincode) || (p.address && p.address.pincode) || '')
        };
        if (typeof body.logoDataUrl === 'string') p.logoDataUrl = body.logoDataUrl;
        data.admin.profile = p;
        if (prev) {
          data.admin.profileHistory = data.admin.profileHistory || [];
          data.admin.profileHistory.push({ timestamp: new Date().toISOString(), previous: prev });
        }
        writeDataSync(data);
        sendJSON(res, 200, { ok: true, profile: p });
      }
      return;
    }

    if (pathname === '/api/forgot' && req.method === 'POST') {
      const body = await parseBody(req);
      const role = String(body.role || '').trim();
      const username = String(body.username || '').trim();
      const newPassword = String(body.newPassword || '').trim();
      
      if (!role || !username || !newPassword) { sendJSON(res, 400, { ok: false, error: 'Missing fields' }); return; }
      if (role === 'branch') { sendJSON(res, 403, { ok: false, error: 'Branch password reset is Admin-only' }); return; }
      sendJSON(res, 400, { ok: false, error: 'Unsupported role' }); 
      return;
    }

    if (pathname === '/api/admin/branches' && req.method === 'GET') {
      let branches;
      if (useMySQL) {
        branches = await sqlModels.Branch.findAll();
      } else if (useMongo) {
        branches = await Branch.find();
      } else {
        branches = readDataSync().branches;
      }
      sendJSON(res, 200, { ok: true, branches });
      return;
    }

    if (pathname === '/api/admin/branches' && req.method === 'POST') {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const login = String(body.login || '').trim();
      const password = String(body.password || '').trim();
      
      if (!name || !login || !password) { sendJSON(res, 400, { ok: false, error: 'Missing fields' }); return; }
      
      if (useMySQL) {
        const exists = await sqlModels.Branch.findOne({ where: { login } });
        if (exists) { sendJSON(res, 409, { ok: false, error: 'Login already exists' }); return; }
      } else if (useMongo) {
        const exists = await Branch.findOne({ login });
        if (exists) { sendJSON(res, 409, { ok: false, error: 'Login already exists' }); return; }
      } else {
        const data = readDataSync();
        if (data.branches.some((b) => b.login === login)) { sendJSON(res, 409, { ok: false, error: 'Login already exists' }); return; }
      }

      const commissionRateCash = typeof body.commissionRateCash === 'number' ? Number(body.commissionRateCash) : (typeof body.commissionRate === 'number' ? Number(body.commissionRate) : 0.02);
      const commissionRateBill = typeof body.commissionRateBill === 'number' ? Number(body.commissionRateBill) : (typeof body.commissionRate === 'number' ? Number(body.commissionRate) : 0.02);
      const ownerName = String(body.ownerName || '').trim();
      const phone = String(body.phone || '').trim();
      const email = String(body.email || '').trim();
      const address = {
        line1: String((body.address && body.address.line1) || '').trim(),
        line2: String((body.address && body.address.line2) || '').trim(),
        city: String((body.address && body.address.city) || '').trim(),
        state: String((body.address && body.address.state) || '').trim(),
        pincode: String((body.address && body.address.pincode) || '').trim(),
      };

      if (useMySQL) {
        const id = await getNextId(sqlModels.Branch, []);
        const branch = await sqlModels.Branch.create({ id, name, login, password, commissionRateCash, commissionRateBill, ownerName, phone, email, address });
        sendJSON(res, 201, { ok: true, branch });
      } else if (useMongo) {
        const id = await getNextId(Branch, []);
        const branch = new Branch({ id, name, login, password, commissionRateCash, commissionRateBill, ownerName, phone, email, address });
        await branch.save();
        sendJSON(res, 201, { ok: true, branch });
      } else {
        const data = readDataSync();
        const id = nextId(data.branches);
        const branch = { id, name, login, password, commissionRateCash, commissionRateBill, ownerName, phone, email, address };
        data.branches.push(branch);
        writeDataSync(data);
        sendJSON(res, 201, { ok: true, branch });
      }
      return;
    }

    if (pathname.startsWith('/api/admin/branches/') && req.method === 'PUT') {
      const id = Number(pathname.split('/').pop());
      const body = await parseBody(req);
      
      if (useMySQL) {
        const branch = await sqlModels.Branch.findOne({ where: { id } });
        if (!branch) { sendJSON(res, 404, { ok: false, error: 'Branch not found' }); return; }
        if (typeof body.commissionRate === 'number') { branch.commissionRateCash = Number(body.commissionRate); branch.commissionRateBill = Number(body.commissionRate); }
        if (typeof body.commissionRateCash === 'number') branch.commissionRateCash = Number(body.commissionRateCash);
        if (typeof body.commissionRateBill === 'number') branch.commissionRateBill = Number(body.commissionRateBill);
        if (typeof body.name === 'string') branch.name = String(body.name);
        if (typeof body.password === 'string') branch.password = String(body.password);
        await branch.save();
        sendJSON(res, 200, { ok: true, branch });
      } else if (useMongo) {
        const branch = await Branch.findOne({ id });
        if (!branch) { sendJSON(res, 404, { ok: false, error: 'Branch not found' }); return; }
        if (typeof body.commissionRate === 'number') { branch.commissionRateCash = Number(body.commissionRate); branch.commissionRateBill = Number(body.commissionRate); }
        if (typeof body.commissionRateCash === 'number') branch.commissionRateCash = Number(body.commissionRateCash);
        if (typeof body.commissionRateBill === 'number') branch.commissionRateBill = Number(body.commissionRateBill);
        if (typeof body.name === 'string') branch.name = String(body.name);
        if (typeof body.password === 'string') branch.password = String(body.password);
        await branch.save();
        sendJSON(res, 200, { ok: true, branch });
      } else {
        const data = readDataSync();
        const branch = data.branches.find((b) => b.id === id);
        if (!branch) { sendJSON(res, 404, { ok: false, error: 'Branch not found' }); return; }
        if (typeof body.commissionRate === 'number') { branch.commissionRateCash = Number(body.commissionRate); branch.commissionRateBill = Number(body.commissionRate); }
        if (typeof body.commissionRateCash === 'number') branch.commissionRateCash = Number(body.commissionRateCash);
        if (typeof body.commissionRateBill === 'number') branch.commissionRateBill = Number(body.commissionRateBill);
        if (typeof body.name === 'string') branch.name = String(body.name);
        if (typeof body.password === 'string') branch.password = String(body.password);
        writeDataSync(data);
        sendJSON(res, 200, { ok: true, branch });
      }
      return;
    }

    if (pathname === '/api/payments' && req.method === 'POST') {
      const body = await parseBody(req);
      const amount = Number(body.amount || 0);
      const type = String(body.type || '').trim();
      const userIdRaw = body.userId;
      const userId = userIdRaw === null || userIdRaw === undefined ? null : Number(userIdRaw || 0);
      const branchId = Number(body.branchId || 0);
      const client = body.client || {};
      
      if (!amount || !type || !branchId) { sendJSON(res, 400, { ok: false, error: 'Missing fields' }); return; }
      
      let user = null;
      if (userId && userId > 0) {
        if (useMySQL) {
          user = await sqlModels.User.findOne({ where: { id: userId, branchId, active: true } });
        } else if (useMongo) {
          user = await User.findOne({ id: userId, branchId, active: true });
        } else {
          const data = readDataSync();
          user = data.users.find((u) => u.id === userId && u.branchId === branchId && u.active);
        }
        if (!user) { sendJSON(res, 404, { ok: false, error: 'User not found or inactive' }); return; }
      }

      let card = null;
      {
        const num = String((body.card && body.card.number) || '').replace(/\s+/g, '');
        if (num) {
          const last4 = num.slice(-4);
          const first4 = num.slice(0, 4);
          const brand = num.startsWith('4') ? 'VISA' : num.startsWith('5') ? 'MASTERCARD' : 'CARD';
          const expiry = String((body.card && body.card.expiry) || '').trim();
          card = { brand, first4, last4, expiry };
        }
      }
      const cardDetails = {
        bankName: String((body.cardDetails && body.cardDetails.bankName) || ''),
        dueDate: String((body.cardDetails && body.cardDetails.dueDate) || ''),
        totalBill: Number((body.cardDetails && body.cardDetails.totalBill) || 0),
        paid: Number((body.cardDetails && body.cardDetails.paid) || 0),
        needToPay: Number((body.cardDetails && body.cardDetails.needToPay) || 0),
        swiped: Number((body.cardDetails && body.cardDetails.swiped) || 0),
        holdAmount: Number((body.cardDetails && body.cardDetails.holdAmount) || 0),
        chargesAmount: Number((body.cardDetails && body.cardDetails.chargesAmount) || 0),
        cardLimit: Number((body.cardDetails && body.cardDetails.cardLimit) || 0),
        chargesRate: Number((body.cardDetails && body.cardDetails.chargesRate) || 0),
        cardMobile: String((body.cardDetails && body.cardDetails.cardMobile) || ''),
        amountSent: Number((body.cardDetails && body.cardDetails.amountSent) || 0),
        receiverBankName: String((body.cardDetails && body.cardDetails.receiverBankName) || ''),
        receiverAccount: String((body.cardDetails && body.cardDetails.receiverAccount) || ''),
      };
      
      const createdAt = new Date().toISOString();
      const commissionType = type === 'card' ? 'card_to_cash' : null;

      if (useMySQL) {
        const id = await getNextId(sqlModels.Payment, []);
        const payment = await sqlModels.Payment.create({ id, amount, type, commissionType, userId: user ? user.id : null, branchId, client, card, cardDetails, status: 'success', createdAt });
        sendJSON(res, 201, { ok: true, payment });
      } else if (useMongo) {
        const id = await getNextId(Payment, []);
        const payment = new Payment({ id, amount, type, commissionType, userId: user ? user.id : null, branchId, client, card, cardDetails, status: 'success', createdAt });
        await payment.save();
        sendJSON(res, 201, { ok: true, payment });
      } else {
        const data = readDataSync();
        const id = nextId(data.payments);
        const payment = { id, amount, type, commissionType, userId: user ? user.id : null, branchId, client, card, cardDetails, status: 'success', createdAt };
        data.payments.push(payment);
        writeDataSync(data);
        sendJSON(res, 201, { ok: true, payment });
      }
      return;
    }

    if (pathname === '/api/admin/reports' && req.method === 'GET') {
      const branchId = Number(urlObj.searchParams.get('branchId') || 0);
      const userId = Number(urlObj.searchParams.get('userId') || 0);
      const date = urlObj.searchParams.get('date') || '';
      const q = (urlObj.searchParams.get('q') || '').replace(/\D/g, '');
      
      let items;
      if (useMySQL) {
        const query = {};
        if (branchId) query.branchId = branchId;
        if (userId) query.userId = userId;
        items = await sqlModels.Payment.findAll({ where: query });
      } else if (useMongo) {
        const query = {};
        if (branchId) query.branchId = branchId;
        if (userId) query.userId = userId;
        items = await Payment.find(query);
      } else {
        const data = readDataSync();
        items = data.payments.slice();
        if (branchId) items = items.filter((p) => p.branchId === branchId);
        if (userId) items = items.filter((p) => p.userId === userId);
      }

      if (date) items = items.filter((p) => p.createdAt.slice(0, 10) === date);
      if (q) {
        items = items.filter((p) => {
          const phoneDigits = String(p.client && p.client.phone || '').replace(/\D/g, '');
          const cardLast4 = p.card && p.card.last4 ? String(p.card.last4) : '';
          const cardFirst4 = p.card && p.card.first4 ? String(p.card.first4) : '';
          const matchPhone = phoneDigits.includes(q);
          const qLast4 = q.length >= 4 ? q.slice(-4) : '';
          const qFirst4 = q.length >= 4 ? q.slice(0, 4) : '';
          const matchCardLast4 = cardLast4 && qLast4 && cardLast4 === qLast4;
          const matchCardFirst4 = cardFirst4 && qFirst4 && cardFirst4 === qFirst4;
          return matchPhone || matchCardFirst4 || matchCardLast4;
        });
      }
      sendJSON(res, 200, { ok: true, payments: items });
      return;
    }

    if (pathname === '/api/admin/payments/reset' && req.method === 'POST') {
      let deleted;
      if (useMySQL) {
        deleted = await sqlModels.Payment.destroy({ where: {} });
      } else if (useMongo) {
        const result = await Payment.deleteMany({});
        deleted = result.deletedCount;
      } else {
        const data = readDataSync();
        deleted = data.payments.length;
        data.payments = [];
        writeDataSync(data);
      }
      sendJSON(res, 200, { ok: true, deleted });
      return;
    }

    // Common logic for reports requiring branch info
    const getReportData = async () => {
      let payments, branches;
      if (useMySQL) {
        payments = await sqlModels.Payment.findAll();
        branches = await sqlModels.Branch.findAll();
      } else if (useMongo) {
        payments = await Payment.find();
        branches = await Branch.find();
      } else {
        const data = readDataSync();
        payments = data.payments;
        branches = data.branches;
      }
      return { payments, branches };
    };

    if (pathname === '/api/admin/reports/commission' && req.method === 'GET') {
      const { payments, branches } = await getReportData();
      const date = urlObj.searchParams.get('date') || '';
      let items = payments;
      if (date) items = items.filter((p) => p.createdAt.slice(0, 10) === date);
      
      const total = items.reduce((sum, p) => {
        const branch = branches.find((b) => b.id === p.branchId);
        const cashRate = branch && typeof branch.commissionRateCash === 'number' ? branch.commissionRateCash : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        const billRate = branch && typeof branch.commissionRateBill === 'number' ? branch.commissionRateBill : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        const rate = p.type === 'card' ? billRate : cashRate;
        return sum + p.amount * rate;
      }, 0);
      const cardCount = items.filter((p) => p.type === 'card').length;
      sendJSON(res, 200, { ok: true, commissionAmount: Number(total.toFixed(2)), count: cardCount });
      return;
    }

    if (pathname === '/api/admin/reports/dashboard' && req.method === 'GET') {
      const { payments, branches } = await getReportData();
      const date = urlObj.searchParams.get('date') || '';
      let items = payments;
      if (date) items = items.filter((p) => p.createdAt.slice(0, 10) === date);
      
      const byBranch = new Map();
      items.forEach((p) => {
        const b = byBranch.get(p.branchId) || { branchId: p.branchId, cashTotal: 0, cardTotal: 0, count: 0, commission: 0 };
        b.count += 1;
        if (p.type === 'card') {
          b.cardTotal += p.amount;
          const branch = branches.find((br) => br.id === p.branchId);
          const billRate = branch && typeof branch.commissionRateBill === 'number' ? branch.commissionRateBill : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
          b.commission += p.amount * billRate;
        } else {
          b.cashTotal += p.amount;
          const branch = branches.find((br) => br.id === p.branchId);
          const cashRate = branch && typeof branch.commissionRateCash === 'number' ? branch.commissionRateCash : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
          b.commission += p.amount * cashRate;
        }
        byBranch.set(p.branchId, b);
      });
      const rows = Array.from(byBranch.values()).map((r) => {
        const branch = branches.find((br) => br.id === r.branchId);
        const name = branch ? branch.name : String(r.branchId);
        const cashRate = branch && typeof branch.commissionRateCash === 'number' ? branch.commissionRateCash : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        const billRate = branch && typeof branch.commissionRateBill === 'number' ? branch.commissionRateBill : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        return { branchId: r.branchId, branch: name, commissionRateCash: cashRate, commissionRateBill: billRate, cashTotal: Number(r.cashTotal.toFixed(2)), cardTotal: Number(r.cardTotal.toFixed(2)), count: r.count, commission: Number(r.commission.toFixed(2)) };
      });
      const totals = rows.reduce((acc, r) => { acc.cashTotal += r.cashTotal; acc.cardTotal += r.cardTotal; acc.count += r.count; acc.commission += r.commission; return acc; }, { cashTotal: 0, cardTotal: 0, count: 0, commission: 0 });
      totals.cashTotal = Number(totals.cashTotal.toFixed(2));
      totals.cardTotal = Number(totals.cardTotal.toFixed(2));
      totals.commission = Number(totals.commission.toFixed(2));
      sendJSON(res, 200, { ok: true, rows, totals });
      return;
    }

    if (pathname === '/api/admin/reports/all' && req.method === 'GET') {
      const { payments, branches } = await getReportData();
      const date = urlObj.searchParams.get('date') || '';
      let items = payments;
      if (date) items = items.filter((p) => p.createdAt.slice(0, 10) === date);
      
      const paymentsWithComm = items.map((p) => {
        const branch = branches.find((b) => b.id === p.branchId);
        const name = branch ? branch.name : String(p.branchId);
        const cashRate = branch && typeof branch.commissionRateCash === 'number' ? branch.commissionRateCash : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        const billRate = branch && typeof branch.commissionRateBill === 'number' ? branch.commissionRateBill : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
        const rate = p.type === 'card' ? billRate : cashRate;
        const commissionAmount = Number((p.amount * rate).toFixed(2));
        return { ...p, branchName: name, commissionAmount }; // Sequelize returns JSON or instance, spread works if JSON/instance allows it. For safety we rely on simple objects or Sequelize instances behaving like objects.
      });
      sendJSON(res, 200, { ok: true, payments: paymentsWithComm });
      return;
    }

    if (pathname === '/api/admin/reports/range' && req.method === 'GET') {
      const { payments, branches } = await getReportData();
      const start = urlObj.searchParams.get('start') || '';
      const end = urlObj.searchParams.get('end') || start || '';
      const branchId = Number(urlObj.searchParams.get('branchId') || 0);
      let items = payments;
      if (branchId) items = items.filter((p) => p.branchId === branchId);
      const s = start || ''; const e = end || '';
      if (s && e) {
        items = items.filter((p) => {
          const d = p.createdAt.slice(0,10);
          return d >= s && d <= e;
        });
      }
      const byDate = new Map();
      items.forEach((p) => {
        const d = p.createdAt.slice(0,10);
        const rec = byDate.get(d) || { date: d, cashTotal: 0, cardTotal: 0, cardToCashCommission: 0, cardBillCommission: 0, count: 0 };
        if (p.type === 'card') {
          rec.cardTotal += p.amount;
          const branch = branches.find((b) => b.id === p.branchId);
          const billRate = branch && typeof branch.commissionRateBill === 'number' ? branch.commissionRateBill : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
          rec.cardBillCommission += p.amount * billRate;
        } else {
          rec.cashTotal += p.amount;
          const branch = branches.find((b) => b.id === p.branchId);
          const cashRate = branch && typeof branch.commissionRateCash === 'number' ? branch.commissionRateCash : (branch && typeof branch.commissionRate === 'number' ? branch.commissionRate : 0.02);
          rec.cardToCashCommission += p.amount * cashRate;
        }
        rec.count += 1;
        byDate.set(d, rec);
      });
      const rows = Array.from(byDate.values()).sort((a,b) => a.date.localeCompare(b.date)).map((x) => ({
        date: x.date,
        cashTotal: Number(x.cashTotal.toFixed(2)),
        cardTotal: Number(x.cardTotal.toFixed(2)),
        cardToCashCommission: Number(x.cardToCashCommission.toFixed(2)),
        cardBillCommission: Number(x.cardBillCommission.toFixed(2)),
        count: x.count
      }));
      sendJSON(res, 200, { ok: true, rows });
      return;
    }

    if (pathname === '/api/branch/reports' && req.method === 'GET') {
      const branchId = Number(urlObj.searchParams.get('branchId') || 0);
      const date = urlObj.searchParams.get('date') || '';
      const q = (urlObj.searchParams.get('q') || '').replace(/\D/g, '');
      
      let items;
      if (useMySQL) {
        items = await sqlModels.Payment.findAll({ where: { branchId } });
      } else if (useMongo) {
        const query = { branchId };
        items = await Payment.find(query);
      } else {
        items = readDataSync().payments.filter((p) => p.branchId === branchId);
      }

      if (date) items = items.filter((p) => p.createdAt.slice(0, 10) === date);
      if (q) {
        items = items.filter((p) => {
          const phoneDigits = String(p.client && p.client.phone || '').replace(/\D/g, '');
          const cardLast4 = p.card && p.card.last4 ? String(p.card.last4) : '';
          const cardFirst4 = p.card && p.card.first4 ? String(p.card.first4) : '';
          const matchPhone = phoneDigits.includes(q);
          const qLast4 = q.length >= 4 ? q.slice(-4) : '';
          const qFirst4 = q.length >= 4 ? q.slice(0, 4) : '';
          const matchCardLast4 = cardLast4 && qLast4 && cardLast4 === qLast4;
          const matchCardFirst4 = cardFirst4 && qFirst4 && cardFirst4 === qFirst4;
          return matchPhone || matchCardFirst4 || matchCardLast4;
        });
      }
      sendJSON(res, 200, { ok: true, payments: items });
      return;
    }

    if (pathname === '/api/payment' && req.method === 'GET') {
      const id = Number(urlObj.searchParams.get('id') || 0);
      let p, branch, user;
      
      if (useMySQL) {
        p = await sqlModels.Payment.findOne({ where: { id } });
        if (!p) { sendJSON(res, 404, { ok: false, error: 'Payment not found' }); return; }
        branch = await sqlModels.Branch.findOne({ where: { id: p.branchId } });
        user = p.userId ? await sqlModels.User.findOne({ where: { id: p.userId } }) : null;
      } else if (useMongo) {
        p = await Payment.findOne({ id });
        if (!p) { sendJSON(res, 404, { ok: false, error: 'Payment not found' }); return; }
        branch = await Branch.findOne({ id: p.branchId });
        user = p.userId ? await User.findOne({ id: p.userId }) : null;
      } else {
        const data = readDataSync();
        p = data.payments.find((x) => x.id === id);
        if (!p) { sendJSON(res, 404, { ok: false, error: 'Payment not found' }); return; }
        branch = data.branches.find((b) => b.id === p.branchId);
        user = p.userId ? data.users.find((u) => u.id === p.userId) : null;
      }
      sendJSON(res, 200, { ok: true, payment: p, branch, user });
      return;
    }

    sendJSON(res, 404, { ok: false, error: 'Not Found' });

  } catch (err) {
    console.error('API Error:', err);
    sendJSON(res, 500, { ok: false, error: 'Internal Server Error' });
  }
}

function nextId(list) {
  return list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) { handleApi(req, res); return; }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
