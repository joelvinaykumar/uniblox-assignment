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

const router = express.Router();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

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
    const product = await getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${req.params.id} was not found`,
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
    const { name, unitPriceCents, availableInventory, metadata, isActive } = req.body;

    if (!isNonEmptyString(name)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'name is required and must be a non-empty string',
      });
    }

    if (!isNonNegativeInteger(unitPriceCents)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'unitPriceCents is required and must be a non-negative integer',
      });
    }

    if (!isNonNegativeInteger(availableInventory)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'availableInventory is required and must be a non-negative integer',
      });
    }

    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'metadata must be an object when provided',
      });
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'isActive must be a boolean when provided',
      });
    }

    const product = await createProduct({
      name: name.trim(),
      unitPriceCents,
      availableInventory,
      metadata,
      isActive,
    });

    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
});

// Catalog updates require product writes; stock replacement also requires inventory adjustment
router.patch('/:id', authenticateJwt, requireProductPatchPermissions, async (req, res, next) => {
  try {
    const { name, unitPriceCents, availableInventory, metadata, isActive } = req.body;
    const fields = {};

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'name must be a non-empty string',
        });
      }
      fields.name = name.trim();
    }

    if (unitPriceCents !== undefined) {
      if (!isNonNegativeInteger(unitPriceCents)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'unitPriceCents must be a non-negative integer',
        });
      }
      fields.unitPriceCents = unitPriceCents;
    }

    if (availableInventory !== undefined) {
      if (!isNonNegativeInteger(availableInventory)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'availableInventory must be a non-negative integer',
        });
      }
      fields.availableInventory = availableInventory;
    }

    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'metadata must be an object',
        });
      }
      fields.metadata = metadata;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'isActive must be a boolean',
        });
      }
      fields.isActive = isActive;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'At least one updatable field is required',
      });
    }

    const product = await updateProduct(req.params.id, fields);

    if (!product) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${req.params.id} was not found`,
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
    const { delta } = req.body;

    if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'delta is required and must be a non-zero integer',
      });
    }

    const existing = await getProductById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: `Product ${req.params.id} was not found`,
      });
    }

    const product = await adjustInventory(req.params.id, delta);

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
