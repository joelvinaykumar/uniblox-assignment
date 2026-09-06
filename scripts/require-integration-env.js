#!/usr/bin/env node
require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `Integration tests require: ${missing.join(', ')}. Configure them in .env before running npm run test:integration.`,
  );
  process.exit(1);
}

console.log('Integration test environment is configured.');