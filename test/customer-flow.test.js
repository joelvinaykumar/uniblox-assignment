const assert = require('node:assert/strict');
const test = require('node:test');
const {
  login,
  loginAsAdmin,
  loginAsCustomer,
  request,
  seedSecondCustomer,
  setupIntegrationTest,
} = require('../test-support/integration-harness');

test('customer API flows', { timeout: 30_000 }, async (t) => {
  const context = await setupIntegrationTest(t, 'customer_flow');
  if (!context) return;

  const { baseUrl, databaseUrl } = context;
  await seedSecondCustomer(databaseUrl);

  let customerToken;
  let secondCustomerToken;
  let adminToken;
  let product;
  let secondaryProduct;
  let limitedProduct;
  let cartId;
  let order;

  await t.test('authenticates and enforces protected routes', async () => {
    const missingCredentials = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'customer@example.com' },
    });
    assert.equal(missingCredentials.response.status, 400);

    const invalidCredentials = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'customer@example.com', password: 'wrong-password' },
    });
    assert.equal(invalidCredentials.response.status, 401);

    assert.equal((await request(baseUrl, '/api/products')).response.status, 401);

    customerToken = await loginAsCustomer(baseUrl);
    secondCustomerToken = await login(baseUrl, 'customer2@example.com', 'customer123');
    adminToken = await loginAsAdmin(baseUrl);

    const profile = await request(baseUrl, '/api/auth/me', { token: customerToken });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.user.sub, 'usr_customer_demo');
    assert.equal(profile.body.user.role, 'customer');
  });

  await t.test('discovers products but cannot perform administrative writes', async () => {
    const products = await request(baseUrl, '/api/products', { token: customerToken });
    assert.equal(products.response.status, 200);
    assert.ok(products.body.products.length >= 5);
    assert.ok(products.body.products.some((item) => item.availableInventory <= 5));

    [product, secondaryProduct] = products.body.products.filter((item) => item.availableInventory >= 10);
    limitedProduct = products.body.products.find((item) => item.availableInventory === 3);
    assert.ok(product);
    assert.ok(secondaryProduct);
    assert.ok(limitedProduct);

    const detail = await request(baseUrl, `/api/products/${product.id}`, { token: customerToken });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.product.id, product.id);

    const forbiddenCreate = await request(baseUrl, '/api/products', {
      token: customerToken,
      method: 'POST',
      body: { name: 'Forbidden Product', unitPriceCents: 100, availableInventory: 1 },
    });
    assert.equal(forbiddenCreate.response.status, 403);

    const forbiddenConfig = await request(baseUrl, '/api/admin/coupon-config', {
      token: customerToken,
    });
    assert.equal(forbiddenConfig.response.status, 403);

    const forbiddenReport = await request(baseUrl, '/api/admin/report', { token: customerToken });
    assert.equal(forbiddenReport.response.status, 403);
  });

  await t.test('creates one open cart and manages validated items', async () => {
    const created = await request(baseUrl, '/api/carts', { token: customerToken, method: 'POST' });
    assert.equal(created.response.status, 201);
    cartId = created.body.cart.id;

    const repeatedCreate = await request(baseUrl, '/api/carts', {
      token: customerToken,
      method: 'POST',
    });
    assert.equal(repeatedCreate.response.status, 200);
    assert.equal(repeatedCreate.body.cart.id, cartId);

    const invalidQuantity = await request(baseUrl, `/api/carts/${cartId}/items`, {
      token: customerToken,
      method: 'POST',
      body: { productId: product.id, quantity: 0 },
    });
    assert.equal(invalidQuantity.response.status, 400);

    const unknownProduct = await request(baseUrl, `/api/carts/${cartId}/items`, {
      token: customerToken,
      method: 'POST',
      body: { productId: '00000000-0000-4000-8000-000000000000', quantity: 1 },
    });
    assert.equal(unknownProduct.response.status, 400);

    const added = await request(baseUrl, `/api/carts/${cartId}/items`, {
      token: customerToken,
      method: 'POST',
      body: { productId: product.id, quantity: 1 },
    });
    assert.equal(added.response.status, 200);

    const updated = await request(baseUrl, `/api/carts/${cartId}/items/${product.id}`, {
      token: customerToken,
      method: 'PATCH',
      body: { quantity: 2 },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.cart.items[0].quantity, 2);

    await request(baseUrl, `/api/carts/${cartId}/items`, {
      token: customerToken,
      method: 'POST',
      body: { productId: secondaryProduct.id, quantity: 1 },
    });
    const removed = await request(baseUrl, `/api/carts/${cartId}/items/${secondaryProduct.id}`, {
      token: customerToken,
      method: 'DELETE',
    });
    assert.equal(removed.response.status, 200);
    assert.deepEqual(removed.body.cart.items.map((item) => item.productId), [product.id]);

    const crossCustomerRead = await request(baseUrl, `/api/carts/${cartId}`, {
      token: secondCustomerToken,
    });
    assert.equal(crossCustomerRead.response.status, 403);
  });

  await t.test('uses live prices and checks out exactly once under retries', async () => {
    const newPrice = product.unitPriceCents + 137;
    const repriced = await request(baseUrl, `/api/products/${product.id}`, {
      token: adminToken,
      method: 'PATCH',
      body: { unitPriceCents: newPrice },
    });
    assert.equal(repriced.response.status, 200);

    const cart = await request(baseUrl, `/api/carts/${cartId}`, { token: customerToken });
    assert.equal(cart.body.cart.items[0].unitPriceCents, newPrice);
    assert.equal(cart.body.cart.subtotalCents, newPrice * 2);

    const inventoryBefore = repriced.body.product.availableInventory;
    const missingKey = await request(baseUrl, `/api/carts/${cartId}/checkout`, {
      token: customerToken,
      method: 'POST',
      body: {},
    });
    assert.equal(missingKey.response.status, 400);

    const checkout = await request(baseUrl, `/api/carts/${cartId}/checkout`, {
      token: customerToken,
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': 'customer-complete-flow' },
    });
    assert.equal(checkout.response.status, 201);
    assert.equal(checkout.body.replayed, false);
    order = checkout.body.order;
    assert.equal(order.items[0].unitPriceCents, newPrice);
    assert.equal(order.totalCents, newPrice * 2);

    const replay = await request(baseUrl, `/api/carts/${cartId}/checkout`, {
      token: customerToken,
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': 'customer-complete-flow' },
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.order.id, order.id);

    const secondCheckout = await request(baseUrl, `/api/carts/${cartId}/checkout`, {
      token: customerToken,
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': 'customer-second-checkout' },
    });
    assert.equal(secondCheckout.response.status, 409);

    const inventoryAfter = await request(baseUrl, `/api/products/${product.id}`, {
      token: customerToken,
    });
    assert.equal(inventoryAfter.body.product.availableInventory, inventoryBefore - 2);

    const mutationAfterCheckout = await request(baseUrl, `/api/carts/${cartId}/items/${product.id}`, {
      token: customerToken,
      method: 'PATCH',
      body: { quantity: 1 },
    });
    assert.equal(mutationAfterCheckout.response.status, 409);
  });

  await t.test('reads only owned orders and discovers available coupons', async () => {
    const orders = await request(baseUrl, '/api/orders', { token: customerToken });
    assert.equal(orders.response.status, 200);
    assert.deepEqual(orders.body.orders.map((item) => item.id), [order.id]);

    const detail = await request(baseUrl, `/api/orders/${order.id}`, { token: customerToken });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.order.customerId, 'usr_customer_demo');

    const otherCustomerOrders = await request(baseUrl, '/api/orders', {
      token: secondCustomerToken,
    });
    assert.deepEqual(otherCustomerOrders.body.orders, []);

    const forbiddenDetail = await request(baseUrl, `/api/orders/${order.id}`, {
      token: secondCustomerToken,
    });
    assert.equal(forbiddenDetail.response.status, 403);

    const coupons = await request(baseUrl, '/api/coupons/available', { token: customerToken });
    assert.equal(coupons.response.status, 200);
    assert.deepEqual(coupons.body.coupons, []);
  });

  await t.test('prevents competing customers from overselling limited inventory', async () => {
    const firstCart = await request(baseUrl, '/api/carts', {
      token: customerToken,
      method: 'POST',
    });
    const secondCart = await request(baseUrl, '/api/carts', {
      token: secondCustomerToken,
      method: 'POST',
    });

    await Promise.all([
      request(baseUrl, `/api/carts/${firstCart.body.cart.id}/items`, {
        token: customerToken,
        method: 'POST',
        body: { productId: limitedProduct.id, quantity: 2 },
      }),
      request(baseUrl, `/api/carts/${secondCart.body.cart.id}/items`, {
        token: secondCustomerToken,
        method: 'POST',
        body: { productId: limitedProduct.id, quantity: 2 },
      }),
    ]);

    const checkouts = await Promise.all([
      request(baseUrl, `/api/carts/${firstCart.body.cart.id}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': 'inventory-race-one' },
      }),
      request(baseUrl, `/api/carts/${secondCart.body.cart.id}/checkout`, {
        token: secondCustomerToken,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': 'inventory-race-two' },
      }),
    ]);

    assert.deepEqual(checkouts.map(({ response }) => response.status).sort(), [201, 409]);
    assert.equal(
      checkouts.find(({ response }) => response.status === 409).body.error,
      'InsufficientInventoryError',
    );

    const remaining = await request(baseUrl, `/api/products/${limitedProduct.id}`, {
      token: customerToken,
    });
    assert.equal(remaining.body.product.availableInventory, 1);
  });
});
