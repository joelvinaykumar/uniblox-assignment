const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { URL } = require('node:url');

require('dotenv').config();

const { Client } = require('pg');

function withSearchPath(connectionString, schema) {
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schema}`);
  return url.toString();
}

async function prepareDatabase(baseUrl, schema) {
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const testUrl = withSearchPath(baseUrl, schema);
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  const sqlDir = path.join(__dirname, '..', 'sql');
  for (const file of fs.readdirSync(sqlDir).filter((name) => name.endsWith('.sql')).sort()) {
    await client.query(fs.readFileSync(path.join(sqlDir, file), 'utf8'));
  }
  await client.end();
  return testUrl;
}

async function dropSchema(baseUrl, schema) {
  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}

async function withServer(app, callback) {
  const server = app.listen(0);
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
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

async function createCart(baseUrl, token, productId) {
  const created = await request(baseUrl, '/api/carts', { token, method: 'POST' });
  assert.ok([200, 201].includes(created.response.status));
  const cartId = created.body.cart.id;
  const added = await request(baseUrl, `/api/carts/${cartId}/items`, {
    token,
    method: 'POST',
    body: { productId, quantity: 1 },
  });
  assert.equal(added.response.status, 200);
  return cartId;
}

test('admin report is authorized, repeatable, and reconciles orders and coupons', { timeout: 30_000 }, async (t) => {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    t.skip('DATABASE_URL and JWT_SECRET are required for the report integration flow');
    return;
  }

  const baseDatabaseUrl = process.env.DATABASE_URL;
  const schema = `report_test_${crypto.randomBytes(8).toString('hex')}`;
  process.env.DATABASE_URL = await prepareDatabase(baseDatabaseUrl, schema);

  const app = require('../src/app');
  const { closePool } = require('../src/db/pool');

  try {
    await withServer(app, async (baseUrl) => {
      const adminToken = await login(baseUrl, 'admin@example.com', 'admin123');
      const customerToken = await login(baseUrl, 'customer@example.com', 'customer123');

      assert.equal((await request(baseUrl, '/api/admin/report')).response.status, 401);
      assert.equal((await request(baseUrl, '/api/admin/report', { token: customerToken })).response.status, 403);

      const empty = await request(baseUrl, '/api/admin/report', { token: adminToken });
      assert.equal(empty.response.status, 200);
      assert.deepEqual(empty.body.report, {
        purchasedQuantityByProduct: [],
        grossRevenueCents: '0',
        totalDiscountsCents: '0',
        netRevenueCents: '0',
        couponsGenerated: '0',
        couponsAvailable: '0',
        couponsRedeemed: '0',
        totalOrders: '0',
      });

      const products = await request(baseUrl, '/api/products', { token: customerToken });
      const product = products.body.products.find((item) => item.availableInventory >= 2);
      assert.ok(product);

      const firstCart = await createCart(baseUrl, customerToken, product.id);
      const firstOrder = await request(baseUrl, `/api/carts/${firstCart}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': 'report-order-one' },
      });
      assert.equal(firstOrder.response.status, 201);

      const config = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });
      const updatedConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: { n: 1, x: 10, version: config.body.config.version },
      });
      assert.equal(updatedConfig.response.status, 200);

      const milestones = await request(baseUrl, '/api/admin/coupon-milestones?status=eligible', {
        token: adminToken,
      });
      const issued = await request(baseUrl, '/api/admin/coupons', {
        token: adminToken,
        method: 'POST',
        body: { milestoneId: milestones.body.milestones[0].id },
      });
      assert.equal(issued.response.status, 201);

      const secondCart = await createCart(baseUrl, customerToken, product.id);
      const secondOrder = await request(baseUrl, `/api/carts/${secondCart}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: { couponCode: issued.body.coupon.code },
        headers: { 'Idempotency-Key': 'report-order-two' },
      });
      assert.equal(secondOrder.response.status, 201);

      const orders = await request(baseUrl, '/api/orders?limit=100', { token: adminToken });
      assert.equal(orders.response.status, 200);
      const gross = orders.body.orders.reduce((sum, order) => sum + BigInt(order.subtotalCents), 0n);
      const discounts = orders.body.orders.reduce((sum, order) => sum + BigInt(order.discountCents), 0n);
      const net = orders.body.orders.reduce((sum, order) => sum + BigInt(order.totalCents), 0n);

      const report = await request(baseUrl, '/api/admin/report', { token: adminToken });
      assert.equal(report.response.status, 200);
      assert.deepEqual(report.body.report.purchasedQuantityByProduct, [{
        productId: product.id,
        productName: product.name,
        purchasedQuantity: '2',
      }]);
      assert.equal(report.body.report.grossRevenueCents, gross.toString());
      assert.equal(report.body.report.totalDiscountsCents, discounts.toString());
      assert.equal(report.body.report.netRevenueCents, net.toString());
      assert.equal(report.body.report.totalOrders, '2');
      assert.equal(report.body.report.couponsGenerated, '1');
      assert.equal(report.body.report.couponsAvailable, '0');
      assert.equal(report.body.report.couponsRedeemed, '1');
      assert.equal(gross - discounts, net);

      const replay = await request(baseUrl, `/api/carts/${secondCart}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: { couponCode: issued.body.coupon.code },
        headers: { 'Idempotency-Key': 'report-order-two' },
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.body.replayed, true);

      const repeatedReport = await request(baseUrl, '/api/admin/report', { token: adminToken });
      assert.deepEqual(repeatedReport.body, report.body);
    });
  } finally {
    await closePool();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropSchema(baseDatabaseUrl, schema);
  }
});
