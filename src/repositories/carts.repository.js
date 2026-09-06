const { query } = require('../db/pool');

function mapCart(row, items = []) {
  return {
    id: String(row.id),
    customerId: row.customer_id,
    status: row.status,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  const unitPriceCents = row.unit_price_cents;
  const lineTotalCents = unitPriceCents * row.quantity;

  return {
    productId: String(row.product_id),
    name: row.name,
    quantity: row.quantity,
    unitPriceCents,
    lineTotalCents,
    availableInventory: row.available_inventory,
    isActive: row.is_active,
  };
}

function withTotals(cart) {
  const subtotalCents = cart.items.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return {
    ...cart,
    subtotalCents,
  };
}

async function getCartRowById(id) {
  const result = await query(
    'SELECT id, customer_id, status, created_at, updated_at FROM carts WHERE id = $1',
    [id],
  );

  return result.rows[0];
}

async function findOpenCartByCustomerId(customerId) {
  const result = await query(
    `SELECT id, customer_id, status, created_at, updated_at
     FROM carts
     WHERE customer_id = $1 AND status = 'open'`,
    [customerId],
  );

  return result.rows[0];
}

async function listCartItems(cartId) {
  const result = await query(
    `SELECT
       i.product_id,
       i.quantity,
       p.name,
       p.unit_price_cents,
       p.available_inventory,
       p.is_active
     FROM cart_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.cart_id = $1
     ORDER BY i.product_id`,
    [cartId],
  );

  return result.rows.map(mapItem);
}

async function getCartById(id) {
  const row = await getCartRowById(id);

  if (!row) {
    return undefined;
  }

  return withTotals(mapCart(row, await listCartItems(row.id)));
}

async function createCart(customerId) {
  const result = await query(
    `INSERT INTO carts (customer_id)
     VALUES ($1)
     RETURNING id, customer_id, status, created_at, updated_at`,
    [customerId],
  );

  return withTotals(mapCart(result.rows[0], []));
}

async function addOrIncrementItem(cartId, productId, quantity) {
  await query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET
       quantity = cart_items.quantity + EXCLUDED.quantity,
       updated_at = now()`,
    [cartId, productId, quantity],
  );

  await query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId);
}

async function setItemQuantity(cartId, productId, quantity) {
  const result = await query(
    `UPDATE cart_items
     SET quantity = $3, updated_at = now()
     WHERE cart_id = $1 AND product_id = $2
     RETURNING product_id`,
    [cartId, productId, quantity],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  await query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId);
}

async function removeItem(cartId, productId) {
  const result = await query(
    `DELETE FROM cart_items
     WHERE cart_id = $1 AND product_id = $2
     RETURNING product_id`,
    [cartId, productId],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  await query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId);
}

module.exports = {
  findOpenCartByCustomerId,
  getCartById,
  createCart,
  addOrIncrementItem,
  setItemQuantity,
  removeItem,
};
