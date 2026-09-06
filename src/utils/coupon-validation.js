const { createHttpError } = require('../errors/http-errors');

const MAX_BIGINT = 9223372036854775807n;

function validationError(message) {
  return createHttpError(400, 'ValidationError', message);
}

function validateObject(value, allowedFields, name = 'body') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw validationError(`${name} must be an object`);
  }

  const unknown = Object.keys(value).filter((key) => !allowedFields.includes(key));
  if (unknown.length > 0) {
    throw validationError(`Unknown ${name} fields: ${unknown.join(', ')}`);
  }
}

function parsePositiveBigint(value, fieldName) {
  if ((typeof value !== 'string' && typeof value !== 'number')
    || (typeof value === 'number' && !Number.isSafeInteger(value))) {
    throw validationError(`${fieldName} must be a positive integer or decimal string`);
  }

  const raw = String(value);
  if (!/^\d{1,19}$/.test(raw) || BigInt(raw) < 1n || BigInt(raw) > MAX_BIGINT) {
    throw validationError(`${fieldName} must be a positive PostgreSQL bigint`);
  }

  return BigInt(raw).toString();
}

function validateCouponConfig(body) {
  validateObject(body, ['orderThreshold', 'discountPercentage', 'version']);
  if (!Number.isInteger(body.orderThreshold)
    || body.orderThreshold < 1 || body.orderThreshold > 2_147_483_647) {
    throw validationError('orderThreshold must be an integer between 1 and 2147483647');
  }
  if (!Number.isInteger(body.discountPercentage)
    || body.discountPercentage < 1 || body.discountPercentage > 100) {
    throw validationError('discountPercentage must be an integer between 1 and 100');
  }
  return {
    orderThreshold: body.orderThreshold,
    discountPercentage: body.discountPercentage,
    version: parsePositiveBigint(body.version, 'version'),
  };
}

function parseCouponPagination(query = {}, { milestones = false } = {}) {
  validateObject(query, milestones ? ['limit', 'offset', 'status'] : ['limit', 'offset'], 'query');
  if (milestones && query.status !== undefined && query.status !== 'eligible') {
    throw validationError('status must be eligible');
  }

  const pagination = {};
  for (const [key, fallback, minimum, maximum] of [
    ['limit', 20, 1, 100],
    ['offset', 0, 0, Number.MAX_SAFE_INTEGER],
  ]) {
    const raw = query[key] === undefined ? fallback : query[key];
    if ((typeof raw !== 'string' && typeof raw !== 'number')
      || !/^\d+$/.test(String(raw))) {
      throw validationError(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw validationError(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
    pagination[key] = value;
  }
  return pagination;
}

function normalizeCouponCode(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 128) {
    throw validationError('couponCode must be null or a string of 1-128 characters');
  }
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,127}$/.test(code)) {
    throw validationError('couponCode must contain letters, digits, underscores or hyphens');
  }
  return code;
}

module.exports = {
  validateObject,
  parsePositiveBigint,
  validateCouponConfig,
  parseCouponPagination,
  normalizeCouponCode,
};