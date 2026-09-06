// Policy is loaded in memory; changes require a restart/deployment.
const ROLE_PERMISSIONS = Object.freeze({
  customer: Object.freeze([
    'product:read',
    'cart:manage',
    'order:create',
    'order:read:own',
    'coupon:read:available',
  ]),
  admin: Object.freeze([
    'product:read',
    'product:write',
    'inventory:adjust',
    'order:read:any',
    'coupon:generate',
    'coupon:config:read',
    'coupon:config:write',
    'report:read',
  ]),
});

const knownPermissions = new Set(Object.values(ROLE_PERMISSIONS).flat());

function validatePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0
    || permissions.some((permission) => typeof permission !== 'string'
      || !knownPermissions.has(permission))) {
    throw new TypeError('At least one known permission is required; every permission must be valid');
  }
}

function roleHasPermission(role, permission) {
  return typeof role === 'string'
    && Object.hasOwn(ROLE_PERMISSIONS, role)
    && ROLE_PERMISSIONS[role].includes(permission);
}

module.exports = { ROLE_PERMISSIONS, roleHasPermission, validatePermissions };