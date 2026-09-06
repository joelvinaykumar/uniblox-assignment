const express = require('express');

const { authenticateJwt, requireAnyPermission } = require('../middleware/auth.middleware');
const { requireOwnership } = require('../middleware/ownership.middleware');
const { roleHasPermission } = require('../middleware/permissions');
const { getOrderById, listOrders } = require('../repositories/orders.repository');
const { parseResourceId } = require('../utils/identifiers');

const router = express.Router();
const requireOrderRead = requireAnyPermission('order:read:own', 'order:read:any');
const requireOrderOwnership = requireOwnership({
  loadResource: (req) => getOrderById(parseResourceId(req.params.id, 'orderId')),
  getOwnerId: (order) => order.customerId,
  ownPermission: 'order:read:own',
  anyPermission: 'order:read:any',
});

function parsePagination(query) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'limit must be an integer between 1 and 100' };
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return { error: 'offset must be a non-negative integer' };
  }

  return { limit, offset };
}

router.get('/', authenticateJwt, requireOrderRead, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);

    if (pagination.error) {
      return res.status(400).json({
        error: 'ValidationError',
        message: pagination.error,
      });
    }

    const canReadAny = roleHasPermission(req.user.role, 'order:read:any');
    const orders = await listOrders({
      customerId: canReadAny ? undefined : req.user.sub,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return res.json({
      orders,
      pagination,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authenticateJwt, requireOrderOwnership, (req, res) => {
  res.json({ order: req.resource });
});

module.exports = router;
