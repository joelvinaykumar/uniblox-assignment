#!/usr/bin/env node
require('dotenv').config();

const { Client } = require('pg');

// Pre-launch reset: drops schema objects so migrations can re-run from a clean
// slate. This exists because migrations use CREATE TABLE IF NOT EXISTS and
// therefore cannot alter an existing table's column types (e.g. the product id
// change from bigint to uuid). There is no production data to preserve during
// development, so a rebuild is the correct, lowest-risk approach here.
//
// Post-launch, schema evolution must instead follow expand -> migrate ->
// contract with additive, individually-tracked migrations and batched
// backfills; see DECISIONS.md.
const DROP_ORDER = [
  'order_items',
  'orders',
  'coupons',
  'coupon_milestones',
  'coupon_config',
  'cart_items',
  'carts',
  'products',
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Set it in your .env file.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const table of DROP_ORDER) {
      console.log(`Dropping ${table}...`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    console.log('Database reset complete. Run "npm run db:setup" to recreate.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`Database reset failed: ${error.message}`);
  process.exit(1);
});
