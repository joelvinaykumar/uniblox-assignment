const express = require('express');

const { authenticateJwt, requirePermission } = require('../middleware/auth.middleware');
const {
  getCouponConfig,
  updateCouponConfig,
  listCouponMilestones,
  issueCoupon,
  listAvailableCoupons,
} = require('../services/coupon.service');

const adminRouter = express.Router();
const customerRouter = express.Router();

adminRouter.use(authenticateJwt);
customerRouter.use(authenticateJwt);

adminRouter.get('/coupon-config', requirePermission('coupon:config:read'), async (_req, res) => {
  res.json({ config: await getCouponConfig() });
});

adminRouter.put('/coupon-config', requirePermission('coupon:config:write'), async (req, res) => {
  res.json({ config: await updateCouponConfig(req.body) });
});

adminRouter.get('/coupon-milestones', requirePermission('coupon:generate'), async (req, res) => {
  res.json(await listCouponMilestones(req.query));
});

adminRouter.post('/coupons', requirePermission('coupon:generate'), async (req, res) => {
  const result = await issueCoupon(req.body);
  res.status(result.replayed ? 200 : 201).json(result);
});

customerRouter.get('/available', requirePermission('coupon:read:available'), async (req, res) => {
  res.json(await listAvailableCoupons(req.query));
});

module.exports = { adminRouter, customerRouter };