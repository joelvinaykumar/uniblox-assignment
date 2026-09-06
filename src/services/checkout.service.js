const crypto = require('crypto');

const { withTransaction, execute } = require('../db/pool');
const { createHttpError } = require('../errors/http-errors');
const { validateObject, normalizeCouponCode, parsePositiveBigint } = require('../utils/coupon-validation');
const {
  lockCouponState,
  reconcileCouponMilestones,
  lockCouponForCheckout,
  calculateCouponDiscount,
} = require('./coupon.service');
const {
  lockCartRowById,
  listRawCartItems,
} = require('../repositories/carts.repository');
const {
  createOrderWithItems,
  getOrderByCartId,
  getOrderById,
  getOrderByIdempotencyKey,
} = require('../repositories/orders.repository');

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function normalizeIdempotencyKey(value) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw createHttpError(400, 'ValidationError', 'Idempotency-Key header is required and must be 1-128 characters');
  }

  return value.trim();
}

function buildFingerprint({ cartId, couponCode }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ cartId: String(cartId), couponCode: normalizeCouponCode(couponCode) }))
    .digest('hex');
}

function validateCheckoutBody(body = {}) {
  validateObject(body, ['couponCode'], 'checkout');
  return { couponCode: normalizeCouponCode(body.couponCode) };
}

function toSafeNumber(value, fieldName) {
  if (value > MAX_SAFE_CENTS) {
    throw createHttpError(400, 'MoneyLimitExceededError', `${fieldName} exceeds supported integer-cent range`);
  }

  return Number(value);
}

async function lockIdempotencyKey(db, customerId, idempotencyKey) {
  await execute(db, 'SELECT pg_advisory_xact_lock(hashtext($1))', [`checkout:${customerId}:${idempotencyKey}`]);
}

async function lockProductsForCheckout(db, cartItems) {
  const productIds = cartItems.map((item) => item.product_id);
  const result = await execute(
    db,
    `SELECT id, name, unit_price_cents, available_inventory, is_active
     FROM products
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [productIds],
  );

  return new Map(result.rows.map((product) => [String(product.id), product]));
}

function buildOrderItems(cartItems, productsById) {
  let subtotal = 0n;
  const orderItems = [];

  for (const item of cartItems) {
    const product = productsById.get(String(item.product_id));

    if (!product || !product.is_active) {
      throw createHttpError(409, 'ProductUnavailableError', `Product ${item.product_id} is no longer available`);
    }

    if (item.quantity > product.available_inventory) {
      throw createHttpError(409, 'InsufficientInventoryError', `Product ${item.product_id} does not have enough inventory`);
    }

    const lineTotal = BigInt(item.quantity) * BigInt(product.unit_price_cents);
    subtotal += lineTotal;

    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceCents: product.unit_price_cents,
      lineTotalCents: toSafeNumber(lineTotal, 'lineTotalCents'),
    });
  }

  return {
    orderItems,
    subtotalCents: toSafeNumber(subtotal, 'subtotalCents'),
  };
}

async function decrementInventory(db, orderItems) {
  for (const item of orderItems) {
    const result = await execute(
      db,
      `UPDATE products
       SET available_inventory = available_inventory - $1,
           updated_at = now()
       WHERE id = $2
         AND available_inventory >= $1
       RETURNING id`,
      [item.quantity, item.productId],
    );

    if (result.rows.length === 0) {
      throw createHttpError(409, 'InsufficientInventoryError', `Product ${item.productId} does not have enough inventory`);
    }
  }
}

async function checkoutCart({ customerId, cartId, idempotencyKey, body }) {
  const { couponCode } = validateCheckoutBody(body);
  parsePositiveBigint(cartId, 'cartId');
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const requestFingerprint = buildFingerprint({ cartId, couponCode });

  return withTransaction(async (db) => {
    await lockIdempotencyKey(db, customerId, normalizedKey);

    const existingByKey = await getOrderByIdempotencyKey(customerId, normalizedKey, db, { lock: true });

    if (existingByKey) {
      if (existingByKey.request_fingerprint !== requestFingerprint) {
        throw createHttpError(409, 'IdempotencyConflictError', 'Idempotency-Key was already used for a different checkout request');
      }

      return {
        order: await getOrderById(existingByKey.id, db),
        replayed: true,
      };
    }

    // Replays return before coupon validation. All new checkouts serialize on
    // reward state before acquiring cart/product/coupon locks.
    let rewardState = await lockCouponState(db);
    rewardState = await reconcileCouponMilestones(db, rewardState);

    const cart = await lockCartRowById(cartId, db);

    if (!cart) {
      throw createHttpError(404, 'NotFoundError', `Cart ${cartId} was not found`);
    }

    if (cart.customer_id !== customerId) {
      throw createHttpError(403, 'ForbiddenError', 'Resource ownership or cross-owner permission is required');
    }

    if (cart.status !== 'open') {
      const existingByCart = await getOrderByCartId(cart.id, db);

      if (existingByCart) {
        throw createHttpError(409, 'CartNotOpenError', `Cart ${cartId} has already been checked out`);
      }

      throw createHttpError(409, 'CartNotOpenError', 'Cart is not open for checkout');
    }

    const cartItems = await listRawCartItems(cart.id, db);

    if (cartItems.length === 0) {
      throw createHttpError(400, 'EmptyCartError', 'Cannot checkout an empty cart');
    }

    const productsById = await lockProductsForCheckout(db, cartItems);
    const { orderItems, subtotalCents } = buildOrderItems(cartItems, productsById);
    const coupon = await lockCouponForCheckout(db, couponCode);
    const discountCents = coupon
      ? calculateCouponDiscount(subtotalCents, coupon.discountPercentage)
      : 0;
    const totalCents = subtotalCents - discountCents;

    await decrementInventory(db, orderItems);

    const order = await createOrderWithItems({
      customerId,
      cartId: cart.id,
      idempotencyKey: normalizedKey,
      requestFingerprint,
      subtotalCents,
      discountCents,
      totalCents,
      couponId: coupon?.id ?? null,
      couponCode: coupon?.code ?? null,
      couponDiscountPercentage: coupon?.discountPercentage ?? null,
      items: orderItems,
    }, db);

    await execute(
      db,
      `UPDATE carts
       SET status = 'checked_out', updated_at = now()
       WHERE id = $1`,
      [cart.id],
    );

    // Includes this order and earns the threshold-crossing reward atomically
    // with redemption (orders.coupon_id), stock, receipt, and cart closure.
    await reconcileCouponMilestones(db, rewardState);

    return { order, replayed: false };
  });
}

module.exports = { checkoutCart, buildFingerprint, validateCheckoutBody };
