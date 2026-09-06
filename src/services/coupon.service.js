const crypto = require('crypto');

const { query, execute, withTransaction } = require('../db/pool');
const { createHttpError } = require('../errors/http-errors');
const {
  validateObject,
  parsePositiveBigint,
  validateCouponConfig,
  parseCouponPagination,
  normalizeCouponCode,
} = require('../utils/coupon-validation');

function mapConfig(row) {
  return {
    n: row.n,
    x: row.x,
    version: String(row.version),
    confirmedOrders: String(row.confirmed_orders),
    earnedMilestones: String(row.earned_slots),
    updatedAt: row.updated_at,
  };
}

function mapCoupon(row) {
  return {
    id: row.id,
    milestoneId: String(row.milestone_id),
    code: row.code,
    discountPercent: row.discount_percent,
    status: row.redeemed_at ? 'redeemed' : 'issued',
    issuedAt: row.issued_at,
    redeemedAt: row.redeemed_at || null,
  };
}

// Caller must be inside a transaction. Always acquire this before cart,
// product, milestone, or coupon locks (and after the checkout advisory lock).
async function lockCouponState(db) {
  const result = await execute(db, 'SELECT * FROM coupon_config WHERE id = 1 FOR UPDATE');
  if (!result.rows[0]) {
    throw createHttpError(503, 'CouponConfigurationError', 'Coupon schema is not initialized');
  }
  return result.rows[0];
}

// Requires lockCouponState on this transaction. No process-local counters:
// include historical confirmed orders and preserve the cumulative high-water mark.
async function reconcileCouponMilestones(db, state) {
  const result = await execute(db, "SELECT count(*) AS count FROM orders WHERE status = 'confirmed'");
  const confirmedOrders = BigInt(result.rows[0].count);
  const previousEarned = BigInt(state.earned_slots);
  const earnedUnderRule = confirmedOrders / BigInt(state.n);
  const earnedSlots = earnedUnderRule > previousEarned ? earnedUnderRule : previousEarned;

  if (earnedSlots > previousEarned) {
    await execute(
      db,
      `INSERT INTO coupon_milestones (id, n, discount_percent, config_version)
       SELECT slot, $3, $4, $5 FROM generate_series($1::bigint, $2::bigint) AS slot`,
      [(previousEarned + 1n).toString(), earnedSlots.toString(), state.n, state.x, state.version],
    );
  }

  const updated = await execute(
    db,
    `UPDATE coupon_config SET confirmed_orders = $1, earned_slots = $2
     WHERE id = 1 RETURNING *`,
    [confirmedOrders.toString(), earnedSlots.toString()],
  );
  return updated.rows[0];
}

async function getCouponConfig() {
  return withTransaction(async (db) => {
    const state = await lockCouponState(db);
    return mapConfig(await reconcileCouponMilestones(db, state));
  });
}

async function updateCouponConfig(body) {
  const config = validateCouponConfig(body);
  return withTransaction(async (db) => {
    const state = await lockCouponState(db);
    if (String(state.version) !== config.version) {
      throw createHttpError(409, 'CouponConfigVersionConflictError', 'Configuration changed; fetch the latest version and retry');
    }
    if (BigInt(state.version) === 9223372036854775807n) {
      throw createHttpError(409, 'CouponConfigVersionLimitError', 'Configuration version limit reached');
    }

    // First freeze any outstanding rewards at the OLD rate, then immediately
    // earn any additional slots unlocked by the NEW N at the NEW rate.
    await reconcileCouponMilestones(db, state);
    const updated = await execute(
      db,
      `UPDATE coupon_config SET n = $1, x = $2, version = version + 1, updated_at = now()
       WHERE id = 1 RETURNING *`,
      [config.n, config.x],
    );
    return mapConfig(await reconcileCouponMilestones(db, updated.rows[0]));
  });
}

async function listCouponMilestones(options = {}) {
  const pagination = parseCouponPagination(options, { milestones: true });
  return withTransaction(async (db) => {
    await reconcileCouponMilestones(db, await lockCouponState(db));
    const result = await execute(
      db,
      `SELECT m.* FROM coupon_milestones m
       WHERE NOT EXISTS (SELECT 1 FROM coupons c WHERE c.milestone_id = m.id)
       ORDER BY m.id LIMIT $1 OFFSET $2`,
      [pagination.limit, pagination.offset],
    );
    return {
      milestones: result.rows.map((row) => ({
        id: String(row.id),
        n: row.n,
        discountPercent: row.discount_percent,
        configVersion: String(row.config_version),
        earnedAt: row.earned_at,
        status: 'eligible',
      })),
      pagination,
    };
  });
}

async function getIssuedCoupon(db, milestoneId) {
  const result = await execute(
    db,
    `SELECT c.*, m.discount_percent, o.created_at AS redeemed_at
     FROM coupons c JOIN coupon_milestones m ON m.id = c.milestone_id
     LEFT JOIN orders o ON o.coupon_id = c.id WHERE c.milestone_id = $1`,
    [milestoneId],
  );
  return result.rows[0] ? mapCoupon(result.rows[0]) : undefined;
}

async function issueCoupon(body) {
  validateObject(body, ['milestoneId']);
  const milestoneId = parsePositiveBigint(body.milestoneId, 'milestoneId');
  return withTransaction(async (db) => {
    await reconcileCouponMilestones(db, await lockCouponState(db));
    const existing = await getIssuedCoupon(db, milestoneId);
    if (existing) return { coupon: existing, replayed: true };

    const milestone = await execute(db, 'SELECT id FROM coupon_milestones WHERE id = $1', [milestoneId]);
    if (!milestone.rows[0]) {
      throw createHttpError(404, 'NotFoundError', 'Eligible coupon milestone was not found');
    }
    await execute(
      db,
      'INSERT INTO coupons (id, milestone_id, code) VALUES ($1, $2, $3)',
      [crypto.randomUUID(), milestoneId, `CPN-${crypto.randomBytes(16).toString('hex').toUpperCase()}`],
    );
    return { coupon: await getIssuedCoupon(db, milestoneId), replayed: false };
  });
}

async function listAvailableCoupons(options = {}) {
  const pagination = parseCouponPagination(options);
  const result = await execute(
    query,
    `SELECT c.*, m.discount_percent FROM coupons c
     JOIN coupon_milestones m ON m.id = c.milestone_id
     WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.coupon_id = c.id)
     ORDER BY c.issued_at, c.id LIMIT $1 OFFSET $2`,
    [pagination.limit, pagination.offset],
  );
  return { coupons: result.rows.map(mapCoupon), pagination };
}

// Checkout holds the reward-state lock before reaching this function. An order
// referencing coupon_id IS redemption; the unique index is the final single-use
// guard, so there is no second redeemed flag that could drift out of sync.
async function lockCouponForCheckout(db, couponCode) {
  const code = normalizeCouponCode(couponCode);
  if (code === null) return null;
  const result = await execute(
    db,
    `SELECT c.*, m.discount_percent, o.created_at AS redeemed_at
     FROM coupons c JOIN coupon_milestones m ON m.id = c.milestone_id
     LEFT JOIN orders o ON o.coupon_id = c.id
     WHERE c.code = $1 FOR UPDATE OF c`,
    [code],
  );
  const coupon = result.rows[0];
  if (!coupon) {
    throw createHttpError(404, 'CouponNotFoundError', 'Coupon was not found');
  }
  if (coupon.redeemed_at) {
    throw createHttpError(409, 'CouponRedeemedError', 'Coupon has already been redeemed');
  }
  return mapCoupon(coupon);
}

function calculateCouponDiscount(subtotalCents, discountPercent) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0
    || !Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    throw createHttpError(400, 'ValidationError', 'Invalid subtotal or coupon discount percentage');
  }
  return Number(BigInt(subtotalCents) * BigInt(discountPercent) / 100n);
}

module.exports = {
  getCouponConfig,
  updateCouponConfig,
  listCouponMilestones,
  issueCoupon,
  listAvailableCoupons,
  lockCouponState,
  reconcileCouponMilestones,
  lockCouponForCheckout,
  calculateCouponDiscount,
};