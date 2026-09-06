const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { URL } = require('node:url');

require('dotenv').config();

const jwt = require('jsonwebtoken');
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

  await client.query(
    `INSERT INTO auth_users (id, name, email, role, password_hash)
     SELECT 'usr_customer_two', 'Second Customer', 'customer2@example.com', 'customer', password_hash
     FROM auth_users WHERE id = 'usr_customer_demo'`,
  );
  await client.end();
  return testUrl;
}

async function dropDatabaseSchema(baseUrl, schema) {
  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}

async function withServer(app, callback) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
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

async function createCartWithProduct(baseUrl, token, productId) {
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

test('coupon flow reconciles history and protects generation and redemption retries', { timeout: 30_000 }, async (t) => {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    t.skip('DATABASE_URL and JWT_SECRET are required for the coupon integration flow');
    return;
  }

  const baseDatabaseUrl = process.env.DATABASE_URL;
  const schema = `coupon_test_${crypto.randomBytes(8).toString('hex')}`;
  process.env.DATABASE_URL = await prepareDatabase(baseDatabaseUrl, schema);

  const app = require('../src/app');
  const { closePool } = require('../src/db/pool');

  try {
    await withServer(app, async (baseUrl) => {
      const adminToken = await login(baseUrl, 'admin@example.com', 'admin123');
      const customerToken = await login(baseUrl, 'customer@example.com', 'customer123');
      const secondCustomerToken = jwt.sign(
        { sub: 'usr_customer_two', email: 'customer2@example.com', role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' },
      );

      const products = await request(baseUrl, '/api/products', { token: customerToken });
      assert.equal(products.response.status, 200);
      const product = products.body.products.find((item) => item.availableInventory >= 3);
      assert.ok(product);

      const unauthenticatedCoupons = await request(baseUrl, '/api/coupons/available');
      assert.equal(unauthenticatedCoupons.response.status, 401);
      const customerConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: customerToken,
      });
      assert.equal(customerConfig.response.status, 403);

      // First create a historical successful order while the default N is 5.
      const historicalCart = await createCartWithProduct(baseUrl, customerToken, product.id);
      const historicalCheckout = await request(baseUrl, `/api/carts/${historicalCart}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': 'coupon-history-1' },
      });
      assert.equal(historicalCheckout.response.status, 201);

      const initialConfig = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });
      assert.equal(initialConfig.body.config.confirmedOrders, '1');
      assert.equal(initialConfig.body.config.earnedMilestones, '0');

      // N=1 takes effect immediately and reconciles the existing order.
      const configured = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: { n: 1, x: 10, version: initialConfig.body.config.version },
      });
      assert.equal(configured.response.status, 200);
      assert.equal(configured.body.config.earnedMilestones, '1');

      const staleConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: { n: 2, x: 20, version: initialConfig.body.config.version },
      });
      assert.equal(staleConfig.response.status, 409);
      assert.equal(staleConfig.body.error, 'CouponConfigVersionConflictError');

      const eligible = await request(baseUrl, '/api/admin/coupon-milestones?status=eligible', {
        token: adminToken,
      });
      assert.equal(eligible.response.status, 200);
      assert.equal(eligible.body.milestones.length, 1);
      const milestoneId = eligible.body.milestones[0].id;

      const unknownMilestone = await request(baseUrl, '/api/admin/coupons', {
        token: adminToken,
        method: 'POST',
        body: { milestoneId: '999' },
      });
      assert.equal(unknownMilestone.response.status, 404);

      // Concurrent generation is repeat-safe: one coupon, one 201, one replay.
      const generationRequests = [1, 2].map(() => request(baseUrl, '/api/admin/coupons', {
        token: adminToken,
        method: 'POST',
        body: { milestoneId },
      }));
      const generated = await Promise.all(generationRequests);
      assert.deepEqual(generated.map(({ response }) => response.status).sort(), [200, 201]);
      assert.equal(generated[0].body.coupon.id, generated[1].body.coupon.id);
      const coupon = generated[0].body.coupon;

      const available = await request(baseUrl, '/api/coupons/available', { token: customerToken });
      assert.equal(available.response.status, 200);
      assert.deepEqual(available.body.coupons.map((item) => item.id), [coupon.id]);

      const firstCart = await createCartWithProduct(baseUrl, customerToken, product.id);
      const secondCart = await createCartWithProduct(baseUrl, secondCustomerToken, product.id);
      const attempts = [
        { token: customerToken, cartId: firstCart, key: 'coupon-race-one' },
        { token: secondCustomerToken, cartId: secondCart, key: 'coupon-race-two' },
      ];
      const redemptions = await Promise.all(attempts.map((attempt) => request(
        baseUrl,
        `/api/carts/${attempt.cartId}/checkout`,
        {
          token: attempt.token,
          method: 'POST',
          body: { couponCode: coupon.code },
          headers: { 'Idempotency-Key': attempt.key },
        },
      )));

      assert.deepEqual(redemptions.map(({ response }) => response.status).sort(), [201, 409]);
      const winnerIndex = redemptions.findIndex(({ response }) => response.status === 201);
      const loserIndex = 1 - winnerIndex;
      const winner = redemptions[winnerIndex].body.order;
      assert.equal(winner.couponId, coupon.id);
      assert.equal(winner.discountCents, Math.floor(winner.subtotalCents * 10 / 100));
      assert.equal(winner.totalCents, winner.subtotalCents - winner.discountCents);
      assert.equal(redemptions[loserIndex].body.error, 'CouponRedeemedError');

      // Retry returns the same receipt and does not consume inventory or rewards twice.
      const replayAttempt = attempts[winnerIndex];
      const replay = await request(baseUrl, `/api/carts/${replayAttempt.cartId}/checkout`, {
        token: replayAttempt.token,
        method: 'POST',
        body: { couponCode: coupon.code },
        headers: { 'Idempotency-Key': replayAttempt.key },
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.order.id, winner.id);

      const changedCouponReplay = await request(baseUrl, `/api/carts/${replayAttempt.cartId}/checkout`, {
        token: replayAttempt.token,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': replayAttempt.key },
      });
      assert.equal(changedCouponReplay.response.status, 409);
      assert.equal(changedCouponReplay.body.error, 'IdempotencyConflictError');

      const loserCart = await request(baseUrl, `/api/carts/${attempts[loserIndex].cartId}`, {
        token: attempts[loserIndex].token,
      });
      assert.equal(loserCart.response.status, 200);
      assert.equal(loserCart.body.cart.status, 'open');

      const unavailable = await request(baseUrl, '/api/coupons/available', { token: customerToken });
      assert.deepEqual(unavailable.body.coupons, []);

      // Raising N never revokes earned slots; X changes do not rewrite them.
      const afterCheckoutConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
      });
      assert.equal(afterCheckoutConfig.body.config.confirmedOrders, '2');
      assert.equal(afterCheckoutConfig.body.config.earnedMilestones, '2');
      const raisedInterval = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: { n: 100, x: 25, version: afterCheckoutConfig.body.config.version },
      });
      assert.equal(raisedInterval.response.status, 200);
      assert.equal(raisedInterval.body.config.earnedMilestones, '2');

      const preservedMilestones = await request(baseUrl, '/api/admin/coupon-milestones?status=eligible', {
        token: adminToken,
      });
      assert.equal(preservedMilestones.body.milestones.length, 1);
      assert.equal(preservedMilestones.body.milestones[0].id, '2');
      assert.equal(preservedMilestones.body.milestones[0].discountPercent, 10);

      const { validateCouponSchema } = require('../src/db/startup-validation');
      await validateCouponSchema();

      const schemaClient = new Client({ connectionString: process.env.DATABASE_URL });
      await schemaClient.connect();
      await schemaClient.query('DELETE FROM coupon_config WHERE id = 1');
      await schemaClient.end();
      await assert.rejects(validateCouponSchema(), /missing coupon_config singleton row/);
    });
  } finally {
    await closePool();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabaseSchema(baseDatabaseUrl, schema);
  }
});
