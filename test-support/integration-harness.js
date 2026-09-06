const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

require('dotenv').config();

const { Client } = require('pg');

const SQL_DIRECTORY = path.join(__dirname, '..', 'sql');

function hasIntegrationEnvironment() {
  return Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET);
}

function withSearchPath(connectionString, schema) {
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schema}`);
  return url.toString();
}

async function withClient(connectionString, callback) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function prepareDatabase(baseUrl, schema) {
  await withClient(baseUrl, (client) => client.query(`CREATE SCHEMA ${schema}`));

  const testUrl = withSearchPath(baseUrl, schema);
  await withClient(testUrl, async (client) => {
    const files = fs.readdirSync(SQL_DIRECTORY)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const file of files) {
      await client.query(fs.readFileSync(path.join(SQL_DIRECTORY, file), 'utf8'));
    }
  });

  return testUrl;
}

async function dropDatabaseSchema(baseUrl, schema) {
  await withClient(baseUrl, (client) => client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function setupIntegrationTest(t, prefix) {
  if (!hasIntegrationEnvironment()) {
    t.skip('DATABASE_URL and JWT_SECRET are required for database integration tests');
    return undefined;
  }

  const baseDatabaseUrl = process.env.DATABASE_URL;
  const schema = `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  process.env.DATABASE_URL = await prepareDatabase(baseDatabaseUrl, schema);

  const app = require('../src/app');
  const { closePool } = require('../src/db/pool');
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    try {
      await closeServer(server);
    } finally {
      try {
        await closePool();
      } finally {
        process.env.DATABASE_URL = baseDatabaseUrl;
        await dropDatabaseSchema(baseDatabaseUrl, schema);
      }
    }
  });

  return {
    baseUrl,
    databaseUrl: process.env.DATABASE_URL,
  };
}

async function request(baseUrl, pathname, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, body: await response.json() };
}

async function login(baseUrl, email, password) {
  const result = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert.equal(result.response.status, 200);
  return result.body.token;
}

async function loginAsCustomer(baseUrl) {
  return login(baseUrl, 'customer@example.com', 'customer123');
}

async function loginAsAdmin(baseUrl) {
  return login(baseUrl, 'admin@example.com', 'admin123');
}

async function seedSecondCustomer(databaseUrl) {
  await withClient(databaseUrl, (client) => client.query(
    `INSERT INTO auth_users (id, name, email, role, password_hash)
     SELECT 'usr_customer_two', 'Second Customer', 'customer2@example.com', 'customer', password_hash
     FROM auth_users WHERE id = 'usr_customer_demo'`,
  ));
}

async function createCartWithProduct(baseUrl, token, productId, quantity = 1) {
  const created = await request(baseUrl, '/api/carts', { token, method: 'POST' });
  assert.ok([200, 201].includes(created.response.status));

  const cartId = created.body.cart.id;
  const added = await request(baseUrl, `/api/carts/${cartId}/items`, {
    token,
    method: 'POST',
    body: { productId, quantity },
  });
  assert.equal(added.response.status, 200);

  return cartId;
}

module.exports = {
  createCartWithProduct,
  login,
  loginAsAdmin,
  loginAsCustomer,
  request,
  seedSecondCustomer,
  setupIntegrationTest,
  withClient,
};
