-- Idempotent schema and seed for authentication users.

CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('customer', 'admin')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_key
  ON auth_users (LOWER(email));

-- Seed demo users. Passwords (for local evaluation only):
--   customer@example.com / customer123
--   admin@example.com    / admin123
INSERT INTO auth_users (id, name, email, role, password_hash)
VALUES
  (
    'usr_customer_demo',
    'Demo Customer',
    'customer@example.com',
    'customer',
    '$2b$10$x3RaQeSpNK7ZHwNf4Oomc.k2q1ngtVnKksiPhq5liSdhSl/a9IBju'
  ),
  (
    'usr_admin_demo',
    'Demo Admin',
    'admin@example.com',
    'admin',
    '$2b$10$ulnE0xsf64Pwpv7Mr7m2sOY7w8ha92svKZfnabKcRjYATSzz0Cke2'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash,
  updated_at = now();
