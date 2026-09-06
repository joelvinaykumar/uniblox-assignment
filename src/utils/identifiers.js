const { createHttpError } = require('../errors/http-errors');

// PostgreSQL bigint upper bound; identifiers above this cannot exist.
const MAX_BIGINT = 9223372036854775807n;
const DIGITS_ONLY = /^\d+$/;

// Validates and normalizes a positive integer resource identifier before it
// reaches the database. Rejecting malformed input here returns a clean 400
// ValidationError instead of leaking a raw PostgreSQL cast error (22P02).
function parseResourceId(value, fieldName = 'id') {
  if (value === undefined || value === null) {
    throw createHttpError(400, 'ValidationError', `${fieldName} is required`);
  }

  const raw = String(value).trim();

  if (!DIGITS_ONLY.test(raw)) {
    throw createHttpError(400, 'ValidationError', `${fieldName} must be a positive integer`);
  }

  if (BigInt(raw) > MAX_BIGINT) {
    throw createHttpError(400, 'ValidationError', `${fieldName} is out of range`);
  }

  return raw;
}

module.exports = { parseResourceId };
