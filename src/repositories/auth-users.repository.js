const { query } = require('../db/pool');

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function findAuthUserByEmail(email) {
  const result = await query(
    `SELECT id, name, email, role, password_hash
     FROM auth_users
     WHERE email = LOWER($1)
     LIMIT 1`,
    [email],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
  };
}

module.exports = {
  findAuthUserByEmail,
  toPublicUser,
};
