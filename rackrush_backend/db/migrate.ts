// db/migrate.ts - Spustenie SQL schemy
require('dotenv').config();
import fs from 'fs';
import path from 'path';
import { Pool  } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    // Bezpecny pristup:
    // destruktivny reset pustame iba ked je explicitne povoleny
    // priklad: RESET_DB=true npm run migrate
    const shouldReset = process.env.RESET_DB === 'true';
    if (shouldReset) {
      sql = `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; ${sql}`;
      console.log('RESET_DB=true -> schema bude resetnuta');
    }

    console.log('Running migrations...');
    await client.query(sql);
    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
