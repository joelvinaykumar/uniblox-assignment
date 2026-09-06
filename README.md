# Uniblox Assignment Backend

Starter Node.js + Express.js backend.

## Scripts

- `npm run dev` - start the server with auto-reload
- `npm start` - start the server normally
- `npm run lint` - run ESLint
- `npm test` - run Node's built-in test runner

## API

- `GET /` - welcome response
- `GET /docs` - Swagger API documentation
- `GET /api/health` - health check
- `POST /api/users` - create a user
- `GET /api/users/:id` - get a user by ID

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

```env
PORT=3000
NODE_ENV=development
```
