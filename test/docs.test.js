const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../src/app');

test('GET /docs serves Swagger documentation', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/docs/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Swagger UI/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
