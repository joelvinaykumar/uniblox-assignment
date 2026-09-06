const { createHttpError } = require('../errors/http-errors');

function validationError(message) {
  return createHttpError(400, 'ValidationError', message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateNewProduct(body = {}) {
  const { name, unitPriceCents, availableInventory, metadata, isActive } = body;

  if (!isNonEmptyString(name)) {
    throw validationError('name is required and must be a non-empty string');
  }

  if (!isNonNegativeInteger(unitPriceCents)) {
    throw validationError('unitPriceCents is required and must be a non-negative integer');
  }

  if (!isNonNegativeInteger(availableInventory)) {
    throw validationError('availableInventory is required and must be a non-negative integer');
  }

  if (metadata !== undefined && !isObject(metadata)) {
    throw validationError('metadata must be an object when provided');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw validationError('isActive must be a boolean when provided');
  }

  return {
    name: name.trim(),
    unitPriceCents,
    availableInventory,
    metadata,
    isActive,
  };
}

function validateProductPatch(body = {}) {
  const { name, unitPriceCents, availableInventory, metadata, isActive } = body;
  const fields = {};

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      throw validationError('name must be a non-empty string');
    }
    fields.name = name.trim();
  }

  if (unitPriceCents !== undefined) {
    if (!isNonNegativeInteger(unitPriceCents)) {
      throw validationError('unitPriceCents must be a non-negative integer');
    }
    fields.unitPriceCents = unitPriceCents;
  }

  if (availableInventory !== undefined) {
    if (!isNonNegativeInteger(availableInventory)) {
      throw validationError('availableInventory must be a non-negative integer');
    }
    fields.availableInventory = availableInventory;
  }

  if (metadata !== undefined) {
    if (!isObject(metadata)) {
      throw validationError('metadata must be an object');
    }
    fields.metadata = metadata;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') {
      throw validationError('isActive must be a boolean');
    }
    fields.isActive = isActive;
  }

  if (Object.keys(fields).length === 0) {
    throw validationError('At least one updatable field is required');
  }

  return fields;
}

function validateInventoryAdjustment(body = {}) {
  const { delta } = body;

  if (!Number.isInteger(delta) || delta === 0) {
    throw validationError('delta is required and must be a non-zero integer');
  }

  return delta;
}

module.exports = {
  validateInventoryAdjustment,
  validateNewProduct,
  validateProductPatch,
};
