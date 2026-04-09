// src/config/db.ts
require('dotenv').config();
import { Pool  } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'rackrush',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.on('connect', () => {
  // Pripojenie prebehlo bez chyby
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

export default pool;
