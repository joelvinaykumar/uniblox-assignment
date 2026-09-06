const { withTransaction, execute } = require('../db/pool');
const { createHttpError } = require('../errors/http-errors');
const {
  getCartById,
  lockCartRowById,
  addOrIncrementItem,
  setItemQuantity,
  removeItem,
} = require('../repositories/carts.repository');

const MAX_POSTGRES_INTEGER = 2_147_483_647;

function ensurePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_POSTGRES_INTEGER) {
    throw createHttpError(400, 'ValidationError', `${fieldName} must be a positive integer`);
  }
}

function ensureProductId(productId) {
  if (productId === undefined || productId === null || String(productId).trim() === '') {
    throw createHttpError(400, 'ValidationError', 'productId is required');
  }
}

async function lockOwnedOpenCart(db, cartId, customerId) {
  const cart = await lockCartRowById(cartId, db);

  if (!cart) {
    throw createHttpError(404, 'NotFoundError', `Cart ${cartId} was not found`);
  }

  if (cart.customer_id !== customerId) {
    throw createHttpError(403, 'ForbiddenError', 'Resource ownership or cross-owner permission is required');
  }

  if (cart.status !== 'open') {
    throw createHttpError(409, 'CartNotOpenError', 'Checked-out carts cannot be modified');
  }

  return cart;
}

async function lockProductForCartMutation(db, productId) {
  const result = await execute(
    db,
    `SELECT id, name, unit_price_cents, available_inventory, is_active
     FROM products
     WHERE id = $1
     FOR SHARE`,
    [productId],
  );

  const product = result.rows[0];

  if (!product || !product.is_active) {
    throw createHttpError(400, 'ValidationError', 'Product is not available');
  }

  return product;
}

async function getExistingQuantity(db, cartId, productId) {
  const result = await execute(
    db,
    `SELECT quantity
     FROM cart_items
     WHERE cart_id = $1 AND product_id = $2`,
    [cartId, productId],
  );

  return result.rows[0] ? result.rows[0].quantity : 0;
}

function ensureQuantityWithinInventory(quantity, availableInventory) {
  if (quantity > availableInventory) {
    throw createHttpError(400, 'ValidationError', 'quantity exceeds available inventory');
  }
}

async function addItemToCart({ cartId, customerId, productId, quantity }) {
  ensureProductId(productId);
  ensurePositiveInteger(quantity, 'quantity');

  return withTransaction(async (db) => {
    const cart = await lockOwnedOpenCart(db, cartId, customerId);
    const product = await lockProductForCartMutation(db, productId);
    const existingQuantity = await getExistingQuantity(db, cart.id, product.id);
    const nextQuantity = existingQuantity + quantity;

    ensurePositiveInteger(nextQuantity, 'quantity');
    ensureQuantityWithinInventory(nextQuantity, product.available_inventory);

    return addOrIncrementItem(cart.id, product.id, quantity, db);
  });
}

async function setCartItemQuantity({ cartId, customerId, productId, quantity }) {
  ensureProductId(productId);
  ensurePositiveInteger(quantity, 'quantity');

  return withTransaction(async (db) => {
    const cart = await lockOwnedOpenCart(db, cartId, customerId);
    const product = await lockProductForCartMutation(db, productId);

    ensureQuantityWithinInventory(quantity, product.available_inventory);

    const updated = await setItemQuantity(cart.id, product.id, quantity, db);

    if (!updated) {
      throw createHttpError(404, 'NotFoundError', `Product ${productId} is not in cart ${cart.id}`);
    }

    return updated;
  });
}

async function removeItemFromCart({ cartId, customerId, productId }) {
  ensureProductId(productId);

  return withTransaction(async (db) => {
    const cart = await lockOwnedOpenCart(db, cartId, customerId);
    const updated = await removeItem(cart.id, productId, db);

    if (!updated) {
      throw createHttpError(404, 'NotFoundError', `Product ${productId} is not in cart ${cart.id}`);
    }

    return updated;
  });
}

async function getOwnedCart(cartId, customerId) {
  const cart = await getCartById(cartId);

  if (!cart) {
    throw createHttpError(404, 'NotFoundError', `Cart ${cartId} was not found`);
  }

  if (cart.customerId !== customerId) {
    throw createHttpError(403, 'ForbiddenError', 'Resource ownership or cross-owner permission is required');
  }

  return cart;
}

module.exports = {
  addItemToCart,
  setCartItemQuantity,
  removeItemFromCart,
  getOwnedCart,
};
