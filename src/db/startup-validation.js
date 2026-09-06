const { query } = require('./pool');

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];
const REQUIRED_SEED_EMAILS = ['customer@example.com', 'admin@example.com'];

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

async function validateStartup() {
  validateEnv();
  await validateDatabaseConnectivity();
  await validateSeededAuthUsers();
}

module.exports = {
  validateStartup,
  validateEnv,
  validateDatabaseConnectivity,
  validateSeededAuthUsers,
};
