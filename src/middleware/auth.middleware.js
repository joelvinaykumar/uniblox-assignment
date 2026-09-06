const jwt = require('jsonwebtoken');
const { roleHasPermission, validatePermissions } = require('./permissions');

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

function permissionGuard(permissions, mode) {
  validatePermissions(permissions);

  return (req, res, next) => {
    if (!req.user || typeof req.user.sub !== 'string' || !req.user.sub.trim()) {
      return res.status(401).json({
        error: 'UnauthorizedError',
        message: 'Authentication is required',
      });
    }

    const hasPermission = (permission) => roleHasPermission(req.user.role, permission);
    const allowed = mode === 'any'
      ? permissions.some(hasPermission)
      : permissions.every(hasPermission);

    if (!allowed) {
      return res.status(403).json({
        error: 'ForbiddenError',
        message: `Required permissions (${mode}): ${permissions.join(', ')}`,
      });
    }

    return next();
  };
}

function requirePermission(permission) {
  return permissionGuard([permission], 'all');
}

function requireAnyPermission(...permissions) {
  return permissionGuard(permissions, 'any');
}

function requireAllPermissions(...permissions) {
  return permissionGuard(permissions, 'all');
}

module.exports = {
  authenticateJwt,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
};
