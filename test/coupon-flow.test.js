const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createCartWithProduct,
  login,
  loginAsAdmin,
  loginAsCustomer,
  request,
  seedSecondCustomer,
  setupIntegrationTest,
} = require('../test-support/integration-harness');
const {
  assertCouponStartupValidation,
  assertFailedCheckoutRollsBack,
} = require('../test-support/coupon-assertions');

test('coupon flow reconciles history and protects generation and redemption retries', { timeout: 30_000 }, async (t) => {
  const context = await setupIntegrationTest(t, 'coupon_test');
  if (!context) return;

  const { baseUrl, databaseUrl } = context;
  await seedSecondCustomer(databaseUrl);

  const adminToken = await loginAsAdmin(baseUrl);
  const customerToken = await loginAsCustomer(baseUrl);
  const secondCustomerToken = await login(baseUrl, 'customer2@example.com', 'customer123');

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

      // First create a historical successful order while the default threshold is 5.
      const historicalCart = await createCartWithProduct(baseUrl, customerToken, product.id);
      const historicalCheckout = await request(baseUrl, `/api/carts/${historicalCart}/checkout`, {
        token: customerToken,
        method: 'POST',
        body: {},
        headers: { 'Idempotency-Key': 'coupon-history-1' },
      });
      assert.equal(historicalCheckout.response.status, 201);

      const initialConfig = await request(baseUrl, '/api/admin/coupon-config', { token: adminToken });
      assert.equal(initialConfig.body.config.orderThreshold, 5);
      assert.equal(initialConfig.body.config.discountPercentage, 10);
      assert.equal(initialConfig.body.config.confirmedOrders, '1');
      assert.equal(initialConfig.body.config.earnedMilestones, '0');

      // A threshold of 1 takes effect immediately and reconciles the existing order.
      const configured = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: {
          orderThreshold: 1,
          discountPercentage: 10,
          version: initialConfig.body.config.version,
        },
      });
      assert.equal(configured.response.status, 200);
      assert.equal(configured.body.config.earnedMilestones, '1');

      const staleConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: {
          orderThreshold: 2,
          discountPercentage: 20,
          version: initialConfig.body.config.version,
        },
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
      assert.equal(winner.couponDiscountPercentage, 10);
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

      // Raising the threshold never revokes earned slots; percentage changes do not rewrite them.
      const afterCheckoutConfig = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
      });
      assert.equal(afterCheckoutConfig.body.config.confirmedOrders, '2');
      assert.equal(afterCheckoutConfig.body.config.earnedMilestones, '2');
      const raisedInterval = await request(baseUrl, '/api/admin/coupon-config', {
        token: adminToken,
        method: 'PUT',
        body: {
          orderThreshold: 100,
          discountPercentage: 25,
          version: afterCheckoutConfig.body.config.version,
        },
      });
      assert.equal(raisedInterval.response.status, 200);
      assert.equal(raisedInterval.body.config.earnedMilestones, '2');

      const preservedMilestones = await request(baseUrl, '/api/admin/coupon-milestones?status=eligible', {
        token: adminToken,
      });
      assert.equal(preservedMilestones.body.milestones.length, 1);
      assert.equal(preservedMilestones.body.milestones[0].id, '2');
      assert.equal(preservedMilestones.body.milestones[0].discountPercentage, 10);

      const rollbackCouponResult = await request(baseUrl, '/api/admin/coupons', {
        token: adminToken,
        method: 'POST',
        body: { milestoneId: preservedMilestones.body.milestones[0].id },
      });
      assert.equal(rollbackCouponResult.response.status, 201);
      const rollbackCoupon = rollbackCouponResult.body.coupon;

      // Force a failure after checkout has locked the coupon and decremented
      // inventory. PostgreSQL must roll back every effect in the transaction.
      await assertFailedCheckoutRollsBack({
        baseUrl,
        databaseUrl,
        adminToken,
        customerAttempt: attempts[loserIndex],
        productId: product.id,
        coupon: rollbackCoupon,
      });

      await assertCouponStartupValidation(databaseUrl);
});
