const { Sequelize, DataTypes } = require('sequelize');

let sequelize;
let models = {};

function initSequelize(uri) {
  sequelize = new Sequelize(uri, {
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
  });

  // Admin Model
  const Admin = sequelize.define('Admin', {
    username: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    // Storing profile as JSON for simplicity and compatibility
    profile: { type: DataTypes.JSON },
    profileHistory: { type: DataTypes.JSON }
  }, { timestamps: true });

  // Branch Model
  const Branch = sequelize.define('Branch', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false }, // Manual ID management as per current app logic
    name: DataTypes.STRING,
    login: DataTypes.STRING,
    password: DataTypes.STRING,
    commissionRateCash: DataTypes.FLOAT,
    commissionRateBill: DataTypes.FLOAT,
    ownerName: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.JSON
  }, { timestamps: true });

  // User Model
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
    branchId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    username: DataTypes.STRING,
    password: DataTypes.STRING,
    active: DataTypes.BOOLEAN
  }, { timestamps: true });

  // Payment Model
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
    amount: DataTypes.FLOAT,
    type: DataTypes.STRING,
    commissionType: DataTypes.STRING,
    userId: DataTypes.INTEGER,
    branchId: DataTypes.INTEGER,
    client: DataTypes.JSON,
    card: DataTypes.JSON,
    cardDetails: DataTypes.JSON,
    status: DataTypes.STRING,
    // We keep createdAt as string to match existing logic or let Sequelize handle it?
    // Existing logic uses ISO string. Sequelize uses Date.
    // We'll let Sequelize manage `createdAt` but we might need to override it if the app manually sets it.
    // The app manually sets `createdAt`.
    createdAt: { type: DataTypes.STRING } 
  }, { timestamps: true });

  models = { Admin, Branch, User, Payment };
  return { sequelize, models };
}

module.exports = { initSequelize, getModels: () => models, getSequelize: () => sequelize };
