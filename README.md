# Uniblox Assignment Backend

Starter Node.js + Express.js backend.

## Scripts

- `npm run dev` - start the server with auto-reload
- `npm start` - start the server normally
- `npm run db:setup` - create and seed the PostgreSQL `auth_users` table
- `npm run lint` - run ESLint
- `npm test` - run Node's built-in test runner

## Database

The service requires a PostgreSQL database for authentication users. A local
PostgreSQL instance is expected (Docker setup is intentionally deferred).

Setup:

1. Create a database, e.g. `uniblox_assignment`.
2. Set `DATABASE_URL` in `.env`.
3. Run `npm run db:setup` to create and seed the `auth_users` table.

The server validates `DATABASE_URL`, `JWT_SECRET`, database connectivity, and
the presence of seeded users at startup, and fails fast if any check fails.

## API

- `GET /` - welcome response
- `GET /docs` - Swagger API documentation
- `POST /api/auth/login` - authenticate and receive a JWT
- `GET /api/auth/me` - inspect the authenticated JWT subject
- `GET /api/health` - health check
- `POST /api/users` - create a user
- `GET /api/users/:id` - get a user by ID

## Authentication

The service uses JWT bearer authentication for API clients. Successful login returns a signed JWT that can be sent in the `Authorization` header as `Bearer <token>`.

Demo credentials:

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@example.com` | `customer123` |
| Admin | `admin@example.com` | `admin123` |

Login request:

```json
{
	"email": "customer@example.com",
	"password": "customer123"
}
```

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
DATABASE_URL=postgres://postgres:postgres@localhost:5432/uniblox_assignment
```
