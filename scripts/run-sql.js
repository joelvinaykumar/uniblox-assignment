#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Set it in your .env file.');
    process.exit(1);
  }

  const sqlDir = path.join(__dirname, '..', 'sql');
  const files = fs
    .readdirSync(sqlDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL files found to run.');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
      console.log(`Running ${file}...`);
      await client.query(sql);
    }
    console.log('Database setup complete.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`Database setup failed: ${error.message}`);
  process.exit(1);
});
