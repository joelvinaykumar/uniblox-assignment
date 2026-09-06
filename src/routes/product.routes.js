const express = require('express');

const {
  authenticateJwt,
  requirePermission,
  requireAllPermissions,
} = require('../middleware/auth.middleware');
const {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustInventory,
} = require('../repositories/products.repository');
const { parseUuid } = require('../utils/identifiers');
const {
  validateInventoryAdjustment,
  validateNewProduct,
  validateProductPatch,
} = require('../utils/product-validation');

const router = express.Router();

const requireProductRead = requirePermission('product:read');
const requireProductWrite = requirePermission('product:write');
const requireProductWriteAndInventoryAdjust = requireAllPermissions('product:write', 'inventory:adjust');
const requireInventoryAdjust = requirePermission('inventory:adjust');

function requireProductPatchPermissions(req, res, next) {
  if (req.body !== undefined && Object.hasOwn(req.body, 'availableInventory')) {
    return requireProductWriteAndInventoryAdjust(req, res, next);
  }

  return requireProductWrite(req, res, next);
}

// Authenticated (customer or admin): list active products
router.get('/', authenticateJwt, requireProductRead, async (req, res, next) => {
  try {
    const products = await listProducts();
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

// Authenticated (customer or admin): product detail
router.get('/:id', authenticateJwt, requireProductRead, async (req, res, next) => {
  try {
    const productId = parseUuid(req.params.id, 'productId');
    const product = await getProductById(productId);

    if (!product) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${productId} was not found`,
      });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

// Requires product writes and inventory adjustment because creation initializes stock
router.post('/', authenticateJwt, requireProductWriteAndInventoryAdjust, async (req, res, next) => {
  try {
    const product = await createProduct(validateNewProduct(req.body));

    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
});

// Catalog updates require product writes; stock replacement also requires inventory adjustment
router.patch('/:id', authenticateJwt, requireProductPatchPermissions, async (req, res, next) => {
  try {
    const productId = parseUuid(req.params.id, 'productId');
    const product = await updateProduct(productId, validateProductPatch(req.body));

    if (!product) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${productId} was not found`,
      });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

// Requires inventory adjustment; reserved for admin restock, not checkout
router.post('/:id/inventory-adjustments', authenticateJwt, requireInventoryAdjust, async (req, res, next) => {
  try {
    const delta = validateInventoryAdjustment(req.body);
    const productId = parseUuid(req.params.id, 'productId');
    const existing = await getProductById(productId);

    if (!existing) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${productId} was not found`,
      });
    }

    const product = await adjustInventory(productId, delta);

    if (!product) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Adjustment would make available inventory negative',
      });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
