const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../src/app');

async function withServer(callback) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
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
}

test('POST /api/users creates a user', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane@example.com',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.name, 'Jane Doe');
    assert.equal(body.email, 'jane@example.com');
    assert.ok(body.id);
    assert.ok(body.createdAt);
  });
});

test('GET /api/users/:id returns a created user', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    });
    const createdUser = await createResponse.json();

    const getResponse = await fetch(`${baseUrl}/api/users/${createdUser.id}`);
    const fetchedUser = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.deepEqual(fetchedUser, createdUser);
  });
});

test('GET /api/users/:id returns 404 for an unknown user', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/unknown-user`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, 'NotFoundError');
  });
});
