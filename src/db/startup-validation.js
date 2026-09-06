const { query } = require('./pool');

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];
const REQUIRED_SEED_EMAILS = ['customer@example.com', 'admin@example.com'];
const REQUIRED_COUPON_TABLES = ['coupon_config', 'coupon_milestones', 'coupons'];
const REQUIRED_ORDER_COUPON_COLUMNS = [
  'coupon_id',
  'coupon_code',
  'coupon_discount_percent',
];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

async function validateDatabaseConnectivity() {
  try {
    await query('SELECT 1');
  } catch (error) {
    throw new Error(
      `Unable to connect to PostgreSQL using DATABASE_URL: ${error.message}`,
      { cause: error },
    );
  }
}

async function validateSeededAuthUsers() {
  let result;

  try {
    result = await query(
      'SELECT email FROM auth_users WHERE email = ANY($1)',
      [REQUIRED_SEED_EMAILS],
    );
  } catch (error) {
    throw new Error(
      `Unable to read auth_users table. Did you run "npm run db:setup"? ${error.message}`,
      { cause: error },
    );
  }

  const foundEmails = new Set(result.rows.map((row) => row.email));
  const missingEmails = REQUIRED_SEED_EMAILS.filter(
    (email) => !foundEmails.has(email),
  );

  if (missingEmails.length > 0) {
    throw new Error(
      `Missing seeded auth users: ${missingEmails.join(', ')}. Run "npm run db:setup".`,
    );
  }
}

async function validateCouponSchema() {
  let result;

  try {
    result = await query(
      `SELECT
         ARRAY(
           SELECT required_table
           FROM unnest($1::text[]) AS required_table
           WHERE to_regclass(required_table) IS NULL
           ORDER BY required_table
         ) AS missing_tables,
         ARRAY(
           SELECT required_column
           FROM unnest($2::text[]) AS required_column
           WHERE NOT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'orders'
               AND column_name = required_column
           )
           ORDER BY required_column
         ) AS missing_order_columns,
         EXISTS (SELECT 1 FROM coupon_config WHERE id = 1) AS has_config`,
      [REQUIRED_COUPON_TABLES, REQUIRED_ORDER_COUPON_COLUMNS],
    );
  } catch (error) {
    throw new Error(
      `Unable to validate coupon schema. Did you run "npm run db:setup"? ${error.message}`,
      { cause: error },
    );
  }

  const row = result.rows[0];
  const problems = [];

  if (row.missing_tables.length > 0) {
    problems.push(`missing tables: ${row.missing_tables.join(', ')}`);
  }
  if (row.missing_order_columns.length > 0) {
    problems.push(`missing orders columns: ${row.missing_order_columns.join(', ')}`);
  }
  if (!row.has_config) {
    problems.push('missing coupon_config singleton row');
  }

  if (problems.length > 0) {
    throw new Error(`Coupon schema is incomplete (${problems.join('; ')}). Run "npm run db:setup".`);
  }
}

async function validateStartup() {
  validateEnv();
  await validateDatabaseConnectivity();
  await validateSeededAuthUsers();
  await validateCouponSchema();
}

module.exports = {
  validateStartup,
  validateEnv,
  validateDatabaseConnectivity,
  validateSeededAuthUsers,
  validateCouponSchema,
};
