require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI;
const DATA_PATH = path.join(__dirname, 'data', 'data.json');

if (!MONGO_URI) {
  console.error('Please set MONGO_URI in .env file');
  process.exit(1);
}

// Schemas (Must match server.js)
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

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    if (!fs.existsSync(DATA_PATH)) {
      console.log('No local data file found at', DATA_PATH);
      process.exit(0);
    }

    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);

    console.log('Migrating Admin...');
    if (data.admin) {
      await Admin.deleteMany({}); // Clear existing
      await new Admin(data.admin).save();
    }

    console.log('Migrating Branches...');
    if (data.branches && data.branches.length) {
      await Branch.deleteMany({});
      await Branch.insertMany(data.branches);
    }

    console.log('Migrating Users...');
    if (data.users && data.users.length) {
      await User.deleteMany({});
      await User.insertMany(data.users);
    }

    console.log('Migrating Payments...');
    if (data.payments && data.payments.length) {
      await Payment.deleteMany({});
      await Payment.insertMany(data.payments);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
