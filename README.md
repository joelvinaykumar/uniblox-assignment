# Uniblox Assignment Backend

Starter Node.js + Express.js backend.

## Scripts

- `npm run dev` - start the server with auto-reload
- `npm start` - start the server normally
- `npm run db:setup` - create and seed PostgreSQL tables (auth users, products, carts, orders, coupons)
- `npm run db:reset` - destructively rebuild the local development schema
- `npm run lint` - run ESLint
- `npm test` - run Node's built-in test runner
- `npm run test:integration` - require database configuration and run all role and business flows

The customer, administrator, coupon, and reporting flows each create and drop an
isolated PostgreSQL schema. The default test command skips them when `DATABASE_URL`
or `JWT_SECRET` is absent. `npm run test:integration` instead fails fast so CI and
submission checks cannot silently omit the core business flows.

The integration suites are organized by behavior:

- customer flow: authentication, product discovery, cart item lifecycle, live
  pricing, ownership, retry-safe checkout, order access, and competing inventory;
- administrator flow: authorization boundaries, catalog and inventory management,
  cross-customer order access, coupon generation, and reconciled reporting;
- coupon flow: historical milestones, concurrent issuance/redemption, idempotency,
  and failed-checkout rollback; and
- reporting flow: authorization, accounting reconciliation, and repeatable reads.

## Database

The service requires a PostgreSQL database. A local PostgreSQL instance is
expected (Docker setup is intentionally deferred).

Setup:

1. Create a database, e.g. `uniblox_assignment`.
2. Set `DATABASE_URL` in `.env`.
3. Run `npm run db:setup` to create and seed auth users, products, carts, orders, and coupon configuration.

The server validates `DATABASE_URL`, `JWT_SECRET`, database connectivity, seeded
users, and the required coupon schema/configuration at startup, and fails fast if
any check fails.

## API

- `GET /` - welcome response
- `GET /docs` - Swagger API documentation
- `POST /api/auth/login` - authenticate and receive a JWT
- `GET /api/auth/me` - inspect the authenticated JWT subject
- `GET /api/health` - health check
- `POST /api/users` - create a user
- `GET /api/users/:id` - get a user by ID
- `GET /api/products` - list active products (customer or admin)
- `GET /api/products/:id` - get a product by ID (customer or admin)
- `POST /api/products` - create a product (`product:write` + `inventory:adjust`)
- `PATCH /api/products/:id` - update a product (`product:write`; stock replacement also requires `inventory:adjust`)
- `POST /api/products/:id/inventory-adjustments` - add/remove stock (`inventory:adjust`)
- `POST /api/carts` - create or return the customer's open cart (`cart:manage`)
- `GET /api/carts/:id` - view a cart with live prices (`cart:manage`, owner only)
- `POST /api/carts/:id/items` - add a product quantity (`cart:manage`, owner only)
- `PATCH /api/carts/:id/items/:productId` - set a line quantity (`cart:manage`, owner only)
- `DELETE /api/carts/:id/items/:productId` - remove a line (`cart:manage`, owner only)
- `POST /api/carts/:id/checkout` - checkout a cart (`order:create`, owner only, requires `Idempotency-Key`)
- `GET /api/orders` - list orders (customers see their own; admins see all)
- `GET /api/orders/:id` - get an immutable order receipt (`order:read:own` or `order:read:any`)
- `GET /api/admin/coupon-config` - read N/X and reconciled reward totals (admin)
- `PUT /api/admin/coupon-config` - update N/X with optimistic version checking (admin)
- `GET /api/admin/coupon-milestones?status=eligible` - list earned, unissued rewards (admin)
- `POST /api/admin/coupons` - generate a coupon for `milestoneId` (admin)
- `GET /api/coupons/available` - list issued, unredeemed shared coupons (customer)
- `GET /api/admin/report` - all-time order, product, revenue, and coupon summary (`report:read`)

Checkout treats a committed database transaction as payment success. Orders snapshot
product names, quantities, unit prices, and totals so receipts remain explainable
after catalog changes. Checkout accepts an optional `couponCode` JSON field. A supplied
coupon is explicitly applied, never silently ignored, and is consumed only when the
order transaction commits. Percentage discounts use integer-cent arithmetic and round
down to the nearest cent.

Coupon rewards count confirmed orders globally, including historical orders. With
N = 5 and 12 confirmed orders, two milestones are immediately eligible. The admin
generates one coupon per milestone; customers discover generated coupons through
`GET /api/coupons/available` and explicitly choose one at checkout. Coupons are shared,
single-use, do not expire, and listing one does not reserve it. A competing checkout
may therefore receive `CouponRedeemedError` after another customer commits first.
Configuration changes are serialized with checkout. A milestone uses whichever
configuration owns the database lock when it is earned; changing X never rewrites
an already-earned milestone. Setup SQL can be rerun after a successful migration,
but an incompatible pre-release draft schema requires `npm run db:reset` locally.

The admin report is read-only and unfiltered. It aggregates immutable confirmed-order
receipts and generated coupons in one PostgreSQL statement, so each response observes
one consistent database snapshot. Aggregate counts, quantities, and cent values are
decimal strings to preserve PostgreSQL bigint precision in JSON. Repeated requests do
not reconcile rewards or otherwise mutate state.

## Authentication

The service uses JWT bearer authentication for API clients. Successful login returns a signed JWT that can be sent in the `Authorization` header as `Bearer <token>`.

Authorization is permission driven. JWTs carry a role, and the service derives permissions from a static in-memory policy on each request. Current role grants are:

| Role | Permissions |
| --- | --- |
| Customer | `product:read`, `cart:manage`, `order:create`, `order:read:own`, `coupon:read:available` |
| Admin | `product:read`, `product:write`, `inventory:adjust`, `order:read:any`, `coupon:generate`, `coupon:config:read`, `coupon:config:write`, `report:read` |

Owned-resource checks are centralized in middleware and must use trusted persisted ownership data, not request-body ownership claims.

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

## Submission notes

Approximate implementation time: **6 hours**. Real payment processing, frontend,
notifications, coupon expiry/ownership, Docker, tracked migration tooling, and
production-scale reporting projections are intentionally deferred.
