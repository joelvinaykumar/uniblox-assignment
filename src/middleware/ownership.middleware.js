const { requireAnyPermission } = require('./auth.middleware');
const { roleHasPermission } = require('./permissions');

// loadResource must fetch trusted persisted data, never ownership from req.body.
// The authorized resource is attached to req.resource for reuse by the handler.
function requireOwnership({ loadResource, getOwnerId, ownPermission, anyPermission } = {}) {
  if (typeof loadResource !== 'function' || typeof getOwnerId !== 'function') {
    throw new TypeError('Ownership checks require resource and owner resolvers');
  }

  const permissions = anyPermission === undefined
    ? [ownPermission]
    : [ownPermission, anyPermission];
  const checkPermission = requireAnyPermission(...permissions);

  if (!ownPermission.endsWith(':own') || (anyPermission !== undefined
    && anyPermission !== `${ownPermission.slice(0, -4)}:any`)) {
    throw new TypeError('Ownership permissions must use matching :own and :any scopes');
  }

  return (req, res, next) => checkPermission(req, res, async () => {
    try {
      const resource = await loadResource(req);
      if (resource === undefined || resource === null) {
        return res.status(404).json({
          error: 'NotFoundError',
          message: 'Resource was not found',
        });
      }

      const ownerId = await getOwnerId(resource);
      const validOwner = typeof ownerId === 'string' && ownerId.trim().length > 0;
      const canReadAny = anyPermission !== undefined
        && roleHasPermission(req.user.role, anyPermission);
      const ownsResource = roleHasPermission(req.user.role, ownPermission)
        && ownerId === req.user.sub;

      if (!validOwner || (!canReadAny && !ownsResource)) {
        return res.status(403).json({
          error: 'ForbiddenError',
          message: 'Resource ownership or cross-owner permission is required',
        });
      }

      req.resource = resource;
    } catch (error) {
      return next(error);
    }

    return next();
  });
}

module.exports = { requireOwnership };