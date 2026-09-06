const { query, execute } = require('../db/pool');

function toSafeInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new RangeError(`${fieldName} exceeds JSON safe integer range`);
  }

  return number;
}

function mapOrderRow(row, items = []) {
  return {
    id: String(row.id),
    customerId: row.customer_id,
    cartId: String(row.cart_id),
    status: row.status,
    subtotalCents: toSafeInteger(row.subtotal_cents, 'subtotalCents'),
    discountCents: toSafeInteger(row.discount_cents, 'discountCents'),
    totalCents: toSafeInteger(row.total_cents, 'totalCents'),
    couponId: row.coupon_id ?? null,
    couponCode: row.coupon_code ?? null,
    couponDiscountPercentage: row.coupon_discount_percentage ?? null,
    items,
    createdAt: row.created_at,
  };
}

function mapOrderItem(row) {
  return {
    productId: String(row.product_id),
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    lineTotalCents: toSafeInteger(row.line_total_cents, 'lineTotalCents'),
  };
}

async function listOrderItems(orderIds, db = query) {
  if (orderIds.length === 0) {
    return new Map();
  }

  const result = await execute(
    db,
    `SELECT order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents
     FROM order_items
     WHERE order_id = ANY($1::bigint[])
     ORDER BY order_id, product_id`,
    [orderIds],
  );

  const itemsByOrderId = new Map(orderIds.map((id) => [String(id), []]));

  for (const row of result.rows) {
    itemsByOrderId.get(String(row.order_id)).push(mapOrderItem(row));
  }

  return itemsByOrderId;
}

async function hydrateOrders(rows, db = query) {
  const itemsByOrderId = await listOrderItems(rows.map((row) => row.id), db);
  return rows.map((row) => mapOrderRow(row, itemsByOrderId.get(String(row.id)) || []));
}

async function getOrderById(id, db = query) {
  const result = await execute(
    db,
    `SELECT id, customer_id, cart_id, idempotency_key, status,
          subtotal_cents, discount_cents, total_cents, created_at,
          coupon_id, coupon_code, coupon_discount_percentage
     FROM orders
     WHERE id = $1`,
    [id],
  );

  const orders = await hydrateOrders(result.rows, db);
  return orders[0];
}

async function getOrderByCartId(cartId, db = query) {
  const result = await execute(
    db,
    `SELECT id, customer_id, cart_id, idempotency_key, status,
          subtotal_cents, discount_cents, total_cents, created_at,
          coupon_id, coupon_code, coupon_discount_percentage
     FROM orders
     WHERE cart_id = $1`,
    [cartId],
  );

  const orders = await hydrateOrders(result.rows, db);
  return orders[0];
}

async function getOrderByIdempotencyKey(customerId, idempotencyKey, db = query, { lock = false } = {}) {
  const result = await execute(
    db,
    `SELECT id, customer_id, cart_id, idempotency_key, request_fingerprint, status,
          subtotal_cents, discount_cents, total_cents, created_at,
          coupon_id, coupon_code, coupon_discount_percentage
     FROM orders
     WHERE customer_id = $1 AND idempotency_key = $2
     ${lock ? 'FOR UPDATE' : ''}`,
    [customerId, idempotencyKey],
  );

  return result.rows[0];
}

async function createOrderWithItems({
  customerId,
  cartId,
  idempotencyKey,
  requestFingerprint,
  subtotalCents,
  discountCents,
  totalCents,
  couponId = null,
  couponCode = null,
  couponDiscountPercentage = null,
  items,
}, db) {
  const orderResult = await execute(
    db,
    `INSERT INTO orders (
       customer_id,
       cart_id,
       idempotency_key,
       request_fingerprint,
       subtotal_cents,
       discount_cents,
       total_cents,
       coupon_id,
       coupon_code,
      coupon_discount_percentage
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, customer_id, cart_id, idempotency_key, status,
               subtotal_cents, discount_cents, total_cents, created_at`,
    [customerId, cartId, idempotencyKey, requestFingerprint, subtotalCents, discountCents, totalCents,
      couponId, couponCode, couponDiscountPercentage],
  );

  const orderId = orderResult.rows[0].id;

  for (const item of items) {
    await execute(
      db,
      `INSERT INTO order_items (
         order_id,
         product_id,
         product_name,
         quantity,
         unit_price_cents,
         line_total_cents
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPriceCents,
        item.lineTotalCents,
      ],
    );
  }

  return getOrderById(orderId, db);
}

async function listOrders({ customerId, limit = 20, offset = 0 } = {}, db = query) {
  const values = [];
  let whereClause = '';

  if (customerId) {
    values.push(customerId);
    whereClause = `WHERE customer_id = $${values.length}`;
  }

  values.push(limit, offset);

  const result = await execute(
    db,
    `SELECT id, customer_id, cart_id, idempotency_key, status,
          subtotal_cents, discount_cents, total_cents, created_at,
          coupon_id, coupon_code, coupon_discount_percentage
     FROM orders
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return hydrateOrders(result.rows, db);
}

module.exports = {
  getOrderById,
  getOrderByCartId,
  getOrderByIdempotencyKey,
  createOrderWithItems,
  listOrders,
};
