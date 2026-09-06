const express = require('express');

const { authenticateJwt, requirePermission } = require('../middleware/auth.middleware');
const { getProductById } = require('../repositories/products.repository');
const {
  findOpenCartByCustomerId,
  getCartById,
  createCart,
  addOrIncrementItem,
  setItemQuantity,
  removeItem,
} = require('../repositories/carts.repository');

const router = express.Router();
const requireCartManage = requirePermission('cart:manage');

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

async function loadOwnedOpenCart(req, res) {
  const cart = await getCartById(req.params.id);

  if (!cart) {
    res.status(404).json({
      error: 'NotFoundError',
      message: `Cart ${req.params.id} was not found`,
    });
    return undefined;
  }

  if (cart.customerId !== req.user.sub) {
    res.status(403).json({
      error: 'ForbiddenError',
      message: 'Resource ownership or cross-owner permission is required',
    });
    return undefined;
  }

  if (cart.status !== 'open') {
    res.status(409).json({
      error: 'CartNotOpenError',
      message: 'Checked-out carts cannot be modified',
    });
    return undefined;
  }

  return cart;
}

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
    const cart = await getCartById(req.params.id);

    if (!cart) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Cart ${req.params.id} was not found`,
      });
    }

    if (cart.customerId !== req.user.sub) {
      return res.status(403).json({
        error: 'ForbiddenError',
        message: 'Resource ownership or cross-owner permission is required',
      });
    }

    return res.json({ cart });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/items', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const cart = await loadOwnedOpenCart(req, res);

    if (!cart) {
      return undefined;
    }

    const { productId, quantity } = req.body;

    if (productId === undefined || productId === null || String(productId).trim() === '') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'productId is required',
      });
    }

    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'quantity is required and must be a positive integer',
      });
    }

    const product = await getProductById(productId);

    if (!product || !product.isActive) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Product is not available',
      });
    }

    const existing = cart.items.find((item) => item.productId === String(product.id));
    const nextQuantity = (existing ? existing.quantity : 0) + quantity;

    if (nextQuantity > product.availableInventory) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'quantity exceeds available inventory',
      });
    }

    const updated = await addOrIncrementItem(cart.id, product.id, quantity);
    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/items/:productId', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const cart = await loadOwnedOpenCart(req, res);

    if (!cart) {
      return undefined;
    }

    const { quantity } = req.body;

    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'quantity is required and must be a positive integer',
      });
    }

    const product = await getProductById(req.params.productId);

    if (!product || !product.isActive) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Product is not available',
      });
    }

    if (quantity > product.availableInventory) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'quantity exceeds available inventory',
      });
    }

    const updated = await setItemQuantity(cart.id, product.id, quantity);

    if (!updated) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${req.params.productId} is not in cart ${cart.id}`,
      });
    }

    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/items/:productId', authenticateJwt, requireCartManage, async (req, res, next) => {
  try {
    const cart = await loadOwnedOpenCart(req, res);

    if (!cart) {
      return undefined;
    }

    const updated = await removeItem(cart.id, req.params.productId);

    if (!updated) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${req.params.productId} is not in cart ${cart.id}`,
      });
    }

    return res.json({ cart: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
