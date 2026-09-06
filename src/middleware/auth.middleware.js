const jwt = require('jsonwebtoken');

function authenticateJwt(req, res, next) {
  const authHeader = req.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Bearer token is required',
    });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Bearer token is invalid or expired',
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        error: 'ForbiddenError',
        message: `${role} role is required`,
      });
    }

    return next();
  };
}

module.exports = {
  authenticateJwt,
  requireRole,
};
