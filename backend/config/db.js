const { Pool } = require('pg');
require('dotenv').config();

const isUri = process.env.DB_HOST && (process.env.DB_HOST.startsWith('postgresql://') || process.env.DB_HOST.startsWith('postgres://'));

const pool = new Pool(
  process.env.DATABASE_URL || isUri
    ? {
        connectionString: process.env.DATABASE_URL || process.env.DB_HOST,
        ssl: { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
