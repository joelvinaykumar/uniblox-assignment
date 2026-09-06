const { query, execute } = require('../db/pool');

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

async function getCartRowById(id, db = query) {
  const result = await execute(
    db,
    'SELECT id, customer_id, status, created_at, updated_at FROM carts WHERE id = $1',
    [id],
  );

  return result.rows[0];
}

async function lockCartRowById(id, db) {
  const result = await execute(
    db,
    `SELECT id, customer_id, status, created_at, updated_at
     FROM carts
     WHERE id = $1
     FOR UPDATE`,
    [id],
  );

  return result.rows[0];
}

async function findOpenCartByCustomerId(customerId, db = query) {
  const result = await execute(
    db,
    `SELECT id, customer_id, status, created_at, updated_at
     FROM carts
     WHERE customer_id = $1 AND status = 'open'`,
    [customerId],
  );

  return result.rows[0];
}

async function listCartItems(cartId, db = query) {
  const result = await execute(
    db,
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

async function listRawCartItems(cartId, db) {
  const result = await execute(
    db,
    `SELECT product_id, quantity
     FROM cart_items
     WHERE cart_id = $1
     ORDER BY product_id`,
    [cartId],
  );

  return result.rows;
}

async function getCartById(id, db = query) {
  const row = await getCartRowById(id, db);

  if (!row) {
    return undefined;
  }

  return withTotals(mapCart(row, await listCartItems(row.id, db)));
}

async function getCartFromRow(row, db = query) {
  return withTotals(mapCart(row, await listCartItems(row.id, db)));
}

async function createCart(customerId, db = query) {
  const result = await execute(
    db,
    `INSERT INTO carts (customer_id)
     VALUES ($1)
     RETURNING id, customer_id, status, created_at, updated_at`,
    [customerId],
  );

  return withTotals(mapCart(result.rows[0], []));
}

async function addOrIncrementItem(cartId, productId, quantity, db = query) {
  await execute(
    db,
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET
       quantity = cart_items.quantity + EXCLUDED.quantity,
       updated_at = now()`,
    [cartId, productId, quantity],
  );

  await execute(db, 'UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId, db);
}

async function setItemQuantity(cartId, productId, quantity, db = query) {
  const result = await execute(
    db,
    `UPDATE cart_items
     SET quantity = $3, updated_at = now()
     WHERE cart_id = $1 AND product_id = $2
     RETURNING product_id`,
    [cartId, productId, quantity],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  await execute(db, 'UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId, db);
}

async function removeItem(cartId, productId, db = query) {
  const result = await execute(
    db,
    `DELETE FROM cart_items
     WHERE cart_id = $1 AND product_id = $2
     RETURNING product_id`,
    [cartId, productId],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  await execute(db, 'UPDATE carts SET updated_at = now() WHERE id = $1', [cartId]);

  return getCartById(cartId, db);
}

module.exports = {
  findOpenCartByCustomerId,
  getCartById,
  getCartFromRow,
  lockCartRowById,
  listRawCartItems,
  createCart,
  addOrIncrementItem,
  setItemQuantity,
  removeItem,
};
