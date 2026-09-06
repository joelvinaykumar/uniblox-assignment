const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createCartWithProduct,
  loginAsAdmin,
  loginAsCustomer,
  request,
  setupIntegrationTest,
} = require('../test-support/integration-harness');

test('administrator API flows', { timeout: 30_000 }, async (t) => {
  const context = await setupIntegrationTest(t, 'admin_flow');
  if (!context) return;

  const { baseUrl } = context;
  const adminToken = await loginAsAdmin(baseUrl);
  const customerToken = await loginAsCustomer(baseUrl);

  let product;
  let order;
  let coupon;

  await t.test('enforces administrator and customer permission boundaries', async () => {
    assert.equal((await request(baseUrl, '/api/admin/report')).response.status, 401);
    assert.equal((await request(baseUrl, '/api/admin/report', { token: customerToken })).response.status, 403);
    assert.equal((await request(baseUrl, '/api/admin/coupon-config', { token: customerToken })).response.status, 403);

    const customerInventoryWrite = await request(
      baseUrl,
      '/api/products/00000000-0000-4000-8000-000000000000/inventory-adjustments',
      { token: customerToken, method: 'POST', body: { delta: 1 } },
    );
    assert.equal(customerInventoryWrite.response.status, 403);

    assert.equal((await request(baseUrl, '/api/carts', {
      token: adminToken,
      method: 'POST',
    })).response.status, 403);
    assert.equal((await request(baseUrl, '/api/coupons/available', {
      token: adminToken,
    })).response.status, 403);
  });

  await t.test('creates and maintains catalog inventory with validation', async () => {
    const invalidProduct = await request(baseUrl, '/api/products', {
      token: adminToken,
      method: 'POST',
      body: { name: '', unitPriceCents: -1, availableInventory: -1 },
    });
    assert.equal(invalidProduct.response.status, 400);

    const created = await request(baseUrl, '/api/products', {
      token: adminToken,
      method: 'POST',
      body: {
        name: 'Admin Flow Product',
        unitPriceCents: 1250,
        availableInventory: 2,
        metadata: { suite: 'admin' },
      },
    });
    assert.equal(created.response.status, 201);
    product = created.body.product;

    const emptyPatch = await request(baseUrl, `/api/products/${product.id}`, {
      token: adminToken,
      method: 'PATCH',
      body: {},
    });
    assert.equal(emptyPatch.response.status, 400);

    const patched = await request(baseUrl, `/api/products/${product.id}`, {
      token: adminToken,
      method: 'PATCH',
      body: { name: 'Maintained Product', unitPriceCents: 1500 },
    });
    assert.equal(patched.response.status, 200);
    assert.equal(patched.body.product.name, 'Maintained Product');
    assert.equal(patched.body.product.unitPriceCents, 1500);

    const restocked = await request(baseUrl, `/api/products/${product.id}/inventory-adjustments`, {
      token: adminToken,
      method: 'POST',
      body: { delta: 3 },
    });
    assert.equal(restocked.response.status, 200);
    assert.equal(restocked.body.product.availableInventory, 5);

    const zeroAdjustment = await request(baseUrl, `/api/products/${product.id}/inventory-adjustments`, {
      token: adminToken,
      method: 'POST',
      body: { delta: 0 },
    });
    assert.equal(zeroAdjustment.response.status, 400);

    const reduced = await request(baseUrl, `/api/products/${product.id}/inventory-adjustments`, {
      token: adminToken,
      method: 'POST',
      body: { delta: -2 },
    });
    assert.equal(reduced.response.status, 200);
    assert.equal(reduced.body.product.availableInventory, 3);

    const belowZero = await request(baseUrl, `/api/products/${product.id}/inventory-adjustments`, {
      token: adminToken,
      method: 'POST',
      body: { delta: -4 },
    });
    assert.equal(belowZero.response.status, 400);

    const detail = await request(baseUrl, `/api/products/${product.id}`, { token: adminToken });
    assert.equal(detail.body.product.availableInventory, 3);
  });

  await t.test('observes all orders and generates one coupon per eligible milestone', async () => {
    const cartId = await createCartWithProduct(baseUrl, customerToken, product.id, 2);
    const checkout = await request(baseUrl, `/api/carts/${cartId}/checkout`, {
      token: customerToken,
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': 'admin-flow-order' },
    });
    assert.equal(checkout.response.status, 201);
    order = checkout.body.order;

    const listedOrders = await request(baseUrl, '/api/orders?limit=100', { token: adminToken });
    assert.equal(listedOrders.response.status, 200);
    assert.ok(listedOrders.body.orders.some((item) => item.id === order.id));

    const orderDetail = await request(baseUrl, `/api/orders/${order.id}`, { token: adminToken });
    assert.equal(orderDetail.response.status, 200);
    assert.equal(orderDetail.body.order.customerId, 'usr_customer_demo');

    const initialConfig = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });
    const configured = await request(baseUrl, '/api/admin/coupon-config', {
      token: adminToken,
      method: 'PUT',
      body: {
        orderThreshold: 1,
        discountPercentage: 15,
        version: initialConfig.body.config.version,
      },
    });
    assert.equal(configured.response.status, 200);
    assert.equal(configured.body.config.confirmedOrders, '1');
    assert.equal(configured.body.config.earnedMilestones, '1');

    const milestones = await request(baseUrl, '/api/admin/coupon-milestones?status=eligible', {
      token: adminToken,
    });
    assert.equal(milestones.response.status, 200);
    assert.equal(milestones.body.milestones.length, 1);

    const issued = await request(baseUrl, '/api/admin/coupons', {
      token: adminToken,
      method: 'POST',
      body: { milestoneId: milestones.body.milestones[0].id },
    });
    assert.equal(issued.response.status, 201);
    coupon = issued.body.coupon;
    assert.equal(coupon.discountPercentage, 15);

    const repeatedIssue = await request(baseUrl, '/api/admin/coupons', {
      token: adminToken,
      method: 'POST',
      body: { milestoneId: milestones.body.milestones[0].id },
    });
    assert.equal(repeatedIssue.response.status, 200);
    assert.equal(repeatedIssue.body.replayed, true);
    assert.equal(repeatedIssue.body.coupon.id, coupon.id);

    const available = await request(baseUrl, '/api/coupons/available', { token: customerToken });
    assert.deepEqual(available.body.coupons.map((item) => item.id), [coupon.id]);
  });

  await t.test('returns a repeatable report reconciled with orders and coupons', async () => {
    const firstReport = await request(baseUrl, '/api/admin/report', { token: adminToken });
    assert.equal(firstReport.response.status, 200);

    const report = firstReport.body.report;
    assert.equal(report.totalOrders, '1');
    assert.equal(report.grossRevenueCents, String(order.subtotalCents));
    assert.equal(report.totalDiscountsCents, '0');
    assert.equal(report.netRevenueCents, String(order.totalCents));
    assert.equal(report.couponsGenerated, '1');
    assert.equal(report.couponsAvailable, '1');
    assert.equal(report.couponsRedeemed, '0');
    assert.deepEqual(report.purchasedQuantityByProduct, [{
      productId: product.id,
      productName: 'Maintained Product',
      purchasedQuantity: '2',
    }]);

    const repeatedReport = await request(baseUrl, '/api/admin/report', { token: adminToken });
    assert.deepEqual(repeatedReport.body, firstReport.body);
  });
});
