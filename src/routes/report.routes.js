const express = require('express');

const { authenticateJwt, requirePermission } = require('../middleware/auth.middleware');
const { getAdminReport } = require('../repositories/reports.repository');

const router = express.Router();
const requireReportRead = requirePermission('report:read');

router.get('/', authenticateJwt, requireReportRead, async (_req, res) => {
  res.json({ report: await getAdminReport() });
});

module.exports = router;
