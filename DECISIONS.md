# Decisions

This document records material design decisions for the service.

## Decision: Plain SQL runner instead of a migration framework

**Context:** PostgreSQL setup needs to be repeatable within a limited timebox, and
the current scope is small (auth users only).

**Options considered:** A full migration tool (e.g. `node-pg-migrate`, Knex), ORM
migrations, or a plain SQL runner.

**Choice:** A plain SQL runner (`scripts/run-sql.js`) that executes idempotent
`.sql` files in order.

**Why:** It is fast, transparent, and easy to review. Idempotent SQL with
`ON CONFLICT` keeps setup safe to re-run without a migration framework's
overhead.

**Consequences:** No migration history or rollback tooling yet. This is
acceptable for the current auth-only scope and can be upgraded to a migration
framework when the schema grows.

## Decision: Fail fast on invalid startup configuration

**Context:** Login depends on seeded database users and JWT configuration. Serving
traffic in a broken auth state would produce confusing failures.

**Options considered:** Lazy failure on first login, a health-only warning, or
explicit startup validation.

**Choice:** Validate `DATABASE_URL`, `JWT_SECRET`, database connectivity, and the
presence of required seeded users before the server starts listening.

**Why:** Failing fast surfaces misconfiguration immediately and prevents the
service from accepting requests it cannot correctly handle.

**Consequences:** Local development requires the database to be set up and seeded
before `npm start`. Startup validation lives in `index.js` (not `src/app.js`) so
the app remains importable for tests without a live database.

## Decision: Remove the in-memory auth seed after DB lookup is stable

**Context:** Demo auth users were previously defined in-memory in
`src/data/auth-users.js`, which is now superseded by the database.

**Options considered:** Immediate deletion, a dual-read fallback, or staged
replacement.

**Choice:** Staged replacement — the database-backed repository became the single
source of truth, and the in-memory seed file was removed once it was no longer
referenced.

**Why:** Keeping two sources of truth risks drift and confusion. Removing the
in-memory seed keeps authentication unambiguous.

**Consequences:** A running, seeded PostgreSQL database is now required for login;
there is no in-memory fallback.

## Decision: Defer Docker setup

**Context:** Reproducible local setup could be provided via Docker Compose, but
that adds scope.

**Options considered:** Add Docker Compose now, or rely on a locally installed
PostgreSQL instance.

**Choice:** Defer Docker; require a locally available PostgreSQL instance and
document `DATABASE_URL` and `npm run db:setup`.

**Why:** It keeps the current scope focused and avoids setup work outside the
immediate goal.

**Consequences:** Local setup depends on the developer's PostgreSQL environment.
Docker Compose can be added later for repeatable evaluator setup.

## Decision: Static permission-based RBAC

**Context:** Customers and admins have different responsibilities. Customers can
shop and eventually check out, while admins manage catalog data, inventory,
coupons, and reporting. Hardcoding role checks in route files would couple route
authorization to the current two-role model.

**Options considered:** Continue simple role checks in routes, store dynamic
permissions in PostgreSQL, or use a static in-memory role-to-permission policy.

**Choice:** Use a static in-memory permission policy with explicit role grants,
and have routes require permissions such as `product:write` or
`inventory:adjust`. Permissions are derived from the JWT role on each request;
permissions are not embedded in the token.

**Why:** Static permission lookup is cheap and simple, avoids a database query on
every authorization check, and keeps routes permission-driven instead of
role-name-driven. This is enough for the assignment's two-role ecommerce scope
without overbuilding a configurable admin-permissions system.

**Consequences:** Policy changes require an application restart or deployment.
User role changes still rely on JWT expiry/reissue. Ownership checks are handled
by shared middleware using trusted persisted ownership data, and cross-owner
access requires an explicit `:any` permission.

## Decision: Stay on CommonJS JavaScript

**Context:** The service already has working auth, products, and permission-based
RBAC in CommonJS JavaScript. TypeScript was considered because checkout will
add more request/response shapes and because the domain is money-critical.

**Options considered:** Migrate the existing codebase to TypeScript now, adopt
TypeScript only for new modules, or stay on JavaScript for the assignment.

**Choice:** Stay on CommonJS JavaScript. Do not add a compile step.

**Why:** The graded risks are concurrency, idempotency, and integer-cent
correctness. Those are enforced by PostgreSQL constraints, transactions, and
tests, not by a type checker. A TypeScript rewrite would spend the timebox on
auth/products/RBAC that already work. Traffic scalability is also independent
of JS vs TS.

**Consequences:** Request and row shapes remain implicit. Boundaries must keep
mapping DB snake_case to API camelCase in repositories, and permission names
stay in the static catalog. TypeScript can be revisited after checkout and a
concurrency test exist, if this service outlives the assignment.

## Decision: Carts re-price live and do not reserve inventory

**Context:** A cart can sit between add-item and checkout while product price or
availability changes. Inventory must never be sold twice, and money must stay
in integer cents.

**Options considered:** Snapshot price and reserve stock at add-to-cart, or keep
the cart as a list of product IDs and quantities and resolve price/availability
later.

**Choice:** A customer may have one open cart. Viewing a cart uses live product
prices. Adding or updating items rejects inactive products and quantities above
current inventory, but does not decrement stock. Stock decrements only at
checkout. Checked-out carts cannot be mutated.

**Why:** Reservation at add-time creates abandoned-cart lockups and extra
concurrency rules before checkout exists. Live pricing plus checkout-time
inventory checks keep the cart API simple and push the hard invariants to the
transaction that actually creates an order.

**Consequences:** A cart total can change between view and checkout. An item
valid at add-time can fail later if stock drops. Checkout must re-validate
every line against live inventory and snapshot prices onto the order.

## Decision: Transactional checkout with customer-scoped idempotency

**Context:** Checkout must not oversell inventory, must not create more than one
order for a cart, and must be safe when a client retries after a timeout or lost
response. Coupon redemption is not implemented in this slice.

**Options considered:** Rely on application checks only, lock the cart and product
rows in one PostgreSQL transaction, or introduce an external workflow/payment
system.

**Choice:** Checkout runs in a single PostgreSQL transaction. It locks the
customer/idempotency-key pair with an advisory transaction lock, locks the cart,
locks product rows in deterministic product-ID order, validates inventory using
live prices, decrements stock, inserts immutable order line snapshots, and marks
the cart checked out. The `Idempotency-Key` is scoped to the authenticated
customer and checkout fingerprint. Successful commit is treated as payment
success.

**Why:** PostgreSQL row locks and uniqueness constraints are the simplest durable
way to protect inventory and retry behavior in the current stack. External
payments, email, outbox, and frontend notification workflows are outside scope.

**Consequences:** Replaying the same key and cart returns the existing order.
Reusing the same key for a different checkout returns `IdempotencyConflictError`.
A different key for an already checked-out cart returns `CartNotOpenError`.
Supplying a coupon code currently returns `CouponNotSupportedError`; coupon
generation/redemption will be implemented after orders.
