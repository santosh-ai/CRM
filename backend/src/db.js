const { Pool } = require('pg');
require('dotenv').config();

const isProduction =
  process.env.NODE_ENV === 'production' &&
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('@postgres');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production enforce TLS certificate verification.
  // Set DB_SSL_CA to the PEM-encoded CA certificate if your provider
  // uses a custom CA (e.g. AWS RDS, Supabase, Render).
  ssl: isProduction
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
      }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
