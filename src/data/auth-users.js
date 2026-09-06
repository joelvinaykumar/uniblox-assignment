const authUsers = [
  {
    id: 'usr_customer_demo',
    name: 'Demo Customer',
    email: 'customer@example.com',
    role: 'customer',
    passwordHash: '$2b$10$x3RaQeSpNK7ZHwNf4Oomc.k2q1ngtVnKksiPhq5liSdhSl/a9IBju',
  },
  {
    id: 'usr_admin_demo',
    name: 'Demo Admin',
    email: 'admin@example.com',
    role: 'admin',
    passwordHash: '$2b$10$ulnE0xsf64Pwpv7Mr7m2sOY7w8ha92svKZfnabKcRjYATSzz0Cke2',
  },
];

function findAuthUserByEmail(email) {
  return authUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

module.exports = {
  authUsers,
  findAuthUserByEmail,
  toPublicUser,
};
