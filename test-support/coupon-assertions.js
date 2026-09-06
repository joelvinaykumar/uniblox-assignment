const assert = require('node:assert/strict');

const { request, withClient } = require('./integration-harness');

async function withRejectedOrderInsert(databaseUrl, operation) {
  await withClient(databaseUrl, (client) => client.query(
    `CREATE FUNCTION reject_test_order() RETURNS trigger
     LANGUAGE plpgsql AS $$
     BEGIN
       RAISE EXCEPTION 'forced sensitive rollback failure';
     END;
     $$;
     CREATE TRIGGER reject_test_order
     BEFORE INSERT ON orders
     FOR EACH ROW EXECUTE FUNCTION reject_test_order()`,
  ));

  try {
    return await operation();
  } finally {
    await withClient(databaseUrl, (client) => client.query(
      'DROP TRIGGER reject_test_order ON orders; DROP FUNCTION reject_test_order()',
    ));
  }
}

async function assertFailedCheckoutRollsBack({
  baseUrl,
  databaseUrl,
  adminToken,
  customerAttempt,
  productId,
  coupon,
}) {
  const inventoryBefore = await request(baseUrl, `/api/products/${productId}`, {
    token: customerAttempt.token,
  });
  const ordersBefore = await request(baseUrl, '/api/orders?limit=100', { token: adminToken });
  const configBefore = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });

  const failedCheckout = await withRejectedOrderInsert(databaseUrl, () => request(
    baseUrl,
    `/api/carts/${customerAttempt.cartId}/checkout`,
    {
      token: customerAttempt.token,
      method: 'POST',
      body: { couponCode: coupon.code },
      headers: { 'Idempotency-Key': 'coupon-forced-rollback' },
    },
  ));

  assert.equal(failedCheckout.response.status, 500);
  assert.deepEqual(failedCheckout.body, {
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
  });

  const inventoryAfter = await request(baseUrl, `/api/products/${productId}`, {
    token: customerAttempt.token,
  });
  assert.equal(
    inventoryAfter.body.product.availableInventory,
    inventoryBefore.body.product.availableInventory,
  );

  const cartAfter = await request(baseUrl, `/api/carts/${customerAttempt.cartId}`, {
    token: customerAttempt.token,
  });
  assert.equal(cartAfter.body.cart.status, 'open');

  const couponsAfter = await request(baseUrl, '/api/coupons/available', {
    token: customerAttempt.token,
  });
  assert.deepEqual(couponsAfter.body.coupons.map((item) => item.id), [coupon.id]);

  const ordersAfter = await request(baseUrl, '/api/orders?limit=100', { token: adminToken });
  assert.equal(ordersAfter.body.orders.length, ordersBefore.body.orders.length);

  const configAfter = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });
  assert.equal(configAfter.body.config.confirmedOrders, configBefore.body.config.confirmedOrders);
  assert.equal(configAfter.body.config.earnedMilestones, configBefore.body.config.earnedMilestones);
}

async function assertCouponStartupValidation(databaseUrl) {
  const { validateCouponSchema } = require('../src/db/startup-validation');
  await validateCouponSchema();

  await withClient(databaseUrl, (client) => (
    client.query('DELETE FROM coupon_config WHERE id = 1')
  ));
  await assert.rejects(validateCouponSchema(), /missing coupon_config singleton row/);
}

module.exports = {
  assertCouponStartupValidation,
  assertFailedCheckoutRollsBack,
};
