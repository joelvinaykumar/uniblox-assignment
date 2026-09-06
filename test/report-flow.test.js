const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createCartWithProduct,
  loginAsAdmin,
  loginAsCustomer,
  request,
  setupIntegrationTest,
} = require('../test-support/integration-harness');

test('admin report is authorized, repeatable, and reconciles orders and coupons', { timeout: 30_000 }, async (t) => {
  const context = await setupIntegrationTest(t, 'report_test');
  if (!context) return;

  const { baseUrl } = context;
  const adminToken = await loginAsAdmin(baseUrl);
  const customerToken = await loginAsCustomer(baseUrl);

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

      const firstCart = await createCartWithProduct(baseUrl, customerToken, product.id);
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
        body: {
          orderThreshold: 1,
          discountPercentage: 10,
          version: config.body.config.version,
        },
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

      const secondCart = await createCartWithProduct(baseUrl, customerToken, product.id);
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
