const fs = require('fs');
const path = require('path');
const { initSequelize } = require('./sequelize-db');
require('dotenv').config();

const DATA_FILE = path.join(__dirname, 'data', 'data.json');

async function migrate() {
    if (!process.env.MYSQL_URI) {
        console.error('MYSQL_URI not found in .env');
        process.exit(1);
    }

    console.log('Connecting to MySQL...');
    const { sequelize, models } = initSequelize(process.env.MYSQL_URI);

    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL.');
        
        // Sync models (create tables)
        await sequelize.sync({ force: true }); // force: true drops existing tables! Be careful in prod.
        console.log('Database synced (tables recreated).');

        // Read local JSON data
        if (!fs.existsSync(DATA_FILE)) {
            console.error('data.json not found!');
            process.exit(1);
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log('Read data.json.');

        // 1. Migrate Admin
        if (data.admin) {
            await models.Admin.create({
                username: data.admin.username,
                password: data.admin.password,
                profile: data.admin.profile,
                profileHistory: data.admin.profileHistory
            });
            console.log('Admin migrated.');
        }

        // 2. Migrate Branches
        if (data.branches && data.branches.length > 0) {
            await models.Branch.bulkCreate(data.branches);
            console.log(`${data.branches.length} branches migrated.`);
        }

        // 3. Migrate Users
        if (data.users && data.users.length > 0) {
            await models.User.bulkCreate(data.users);
            console.log(`${data.users.length} users migrated.`);
        }

        // 4. Migrate Payments
        if (data.payments && data.payments.length > 0) {
            // Ensure createdAt matches string format if defined as string
            const payments = data.payments.map(p => ({
                ...p,
                createdAt: p.createdAt || new Date().toISOString()
            }));
            await models.Payment.bulkCreate(payments);
            console.log(`${data.payments.length} payments migrated.`);
        }

        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
