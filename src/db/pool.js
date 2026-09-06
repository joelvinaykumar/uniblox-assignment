const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

// Runs a query against either the shared pool (via the `query` function)
// or an active transaction client, so repositories can be transaction-aware.
function execute(db, text, params) {
  return typeof db === 'function' ? db(text, params) : db.query(text, params);
}

async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  getPool,
  query,
  execute,
  withTransaction,
  closePool,
};
