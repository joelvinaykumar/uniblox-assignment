const express = require('express');

const { authenticateJwt, requirePermission } = require('../middleware/auth.middleware');
const { checkoutCart } = require('../services/checkout.service');
const {
  findOpenCartByCustomerId,
  getCartById,
  createCart,
} = require('../repositories/carts.repository');
const {
  addItemToCart,
  setCartItemQuantity,
  removeItemFromCart,
  getOwnedCart,
} = require('../services/cart.service');
const { parseResourceId, parseUuid } = require('../utils/identifiers');

const router = express.Router();
const requireCartManage = requirePermission('cart:manage');
const requireOrderCreate = requirePermission('order:create');

router.post('/', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const existing = await findOpenCartByCustomerId(req.user.sub);

    if (existing) {
      const cart = await getCartById(existing.id);
      return res.json({ cart });
    }

    try {
      const cart = await createCart(req.user.sub);
      return res.status(201).json({ cart });
    } catch (error) {
      if (error.code === '23505') {
        const raced = await findOpenCartByCustomerId(req.user.sub);
        if (raced) {
          const cart = await getCartById(raced.id);
          return res.json({ cart });
        }
      }

      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const cartId = parseResourceId(req.params.id, 'cartId');
    const cart = await getOwnedCart(cartId, req.user.sub);
    return res.json({ cart });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/checkout', authenticateJwt, requireOrderCreate, async (req, res, next) => {
  try {
    const { order, replayed } = await checkoutCart({
      customerId: req.user.sub,
      cartId: parseResourceId(req.params.id, 'cartId'),
      idempotencyKey: req.get('Idempotency-Key'),
      body: req.body,
    });

    return res.status(replayed ? 200 : 201).json({ order, replayed });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/items', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const updated = await addItemToCart({
      cartId: parseResourceId(req.params.id, 'cartId'),
      customerId: req.user.sub,
      productId: parseUuid(productId, 'productId'),
      quantity,
    });

    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/items/:productId', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const updated = await setCartItemQuantity({
      cartId: parseResourceId(req.params.id, 'cartId'),
      customerId: req.user.sub,
      productId: parseUuid(req.params.productId, 'productId'),
      quantity,
    });

    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/items/:productId', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const updated = await removeItemFromCart({
      cartId: parseResourceId(req.params.id, 'cartId'),
      customerId: req.user.sub,
      productId: parseUuid(req.params.productId, 'productId'),
    });

    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
