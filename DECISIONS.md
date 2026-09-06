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
response.

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

**Consequences:** Replaying the same key, cart, and coupon returns the existing
order. Reusing the same key with a different cart or coupon returns
`IdempotencyConflictError`. A different key for an already-checked-out cart returns
`CartNotOpenError`.

## Decision: Global, admin-issued, explicitly redeemed coupons

**Context:** The requirements define Nth-order rewards, admin generation, optional
checkout redemption, and single use, but leave historical counting, ownership,
expiration, configuration changes, and distribution unspecified.

**Options considered:** Assign rewards to the customer who placed each Nth order;
automatically apply a discount; expose a shared pool of admin-generated coupons; or
add claim, notification, and expiration workflows.

**Choice:** Count all confirmed orders globally, including historical orders. The
number of earned reward slots is the high-water mark of `floor(orderCount / N)`.
Lowering N can make additional slots eligible immediately; raising or toggling N
never revokes or duplicates earned slots. Each milestone snapshots the configured X
when earned. An admin explicitly generates one coupon for a selected eligible
milestone. Authenticated customers can list issued, unredeemed coupons and explicitly
submit one at checkout. Coupons are shared, single-use, and do not expire.

**Why:** This is the smallest coherent policy that satisfies historical eligibility,
admin-controlled generation, customer discovery, and optional redemption without
inventing customer assignment or notification requirements. Durable milestones make
configuration updates repeat-safe and preserve promises already earned.

**Consequences:** Listing does not reserve a coupon, so two customers may see the same
code and only one can redeem it. The loser receives `CouponRedeemedError`; checkout
does not silently continue at full price. Configuration updates use a version token
to prevent lost admin updates. Changing X affects only newly earned milestones.

## Decision: Serialize reward accounting in the checkout transaction

**Context:** A failed checkout must not consume a coupon, concurrent checkout must not
redeem one coupon twice, and threshold-crossing orders must not create duplicate
milestones.

**Options considered:** In-memory counters and locks, separate coupon-consumption
requests, asynchronous reward processing, or one PostgreSQL transaction with durable
locks and constraints.

**Choice:** Lock the singleton coupon configuration row before cart, product, and
coupon rows. Within the same transaction, reconcile historical order counts, validate
and lock the selected coupon, snapshot its terms on the order, decrement inventory,
close the cart, and reconcile the newly committed order's milestone. A unique
`orders.coupon_id` index is the final single-redemption safeguard.

**Why:** Rollback restores coupon availability, inventory, cart state, and reward
progress together. Database locks and uniqueness work across multiple application
instances, unlike process-local state. Discount calculation uses
`floor(subtotalCents * X / 100)` with integer arithmetic, so totals remain
deterministic and nonnegative.

**Consequences:** Reward accounting serializes a short portion of all checkouts on one
row. That is proportionate to this assignment but would become a throughput hotspot at
large scale; a production evolution could use an ordered event ledger or partitioned
counter while retaining unique milestone and redemption constraints.

## System invariants

- A cart produces at most one order and becomes immutable after checkout.
- Inventory never becomes negative; checkout locks products in deterministic order.
- An idempotency key and request fingerprint produce at most one customer order.
- Order item, price, coupon, and total snapshots remain explainable after catalog or
	coupon configuration changes.
- Each reward milestone produces at most one coupon, and each coupon appears on at
	most one confirmed order.
- Failed checkout changes no inventory, cart, coupon, order, or reward state.
- Money uses integer cents; percentage discounts round down and never exceed subtotal.

## Decision: Explicit API error contracts

**Context:** Clients need to distinguish validation, authorization, inventory,
idempotency, cart-state, and coupon failures without parsing database errors.

**Options considered:** Return one generic client error, expose PostgreSQL errors, or
map domain failures to named HTTP errors.

**Choice:** Validate public identifiers and bodies before querying, and return named
errors with appropriate 4xx status codes. Unexpected failures use the central 500
handler. Explicit coupon input is never silently ignored or converted to full price.

**Why:** Stable names such as `CouponRedeemedError`, `IdempotencyConflictError`, and
`InsufficientInventoryError` let clients make safe retry and correction decisions.

**Consequences:** New domain failures require deliberate status/name choices and API
documentation. Internal database details remain hidden.

## Implemented and deferred

Implemented: JWT/RBAC, UUID products, live-price carts, transactional checkout,
immutable orders, customer-scoped idempotency, configurable historical coupon rewards,
admin issuance, customer discovery, and concurrency-safe redemption.

Deferred: real payments, email/notifications, coupon ownership/expiry, frontend,
automatic deadlock retries, migration-history tooling, Docker, and production-scale
reward/report aggregation.

## Decision: One-snapshot, receipt-based administration report

**Context:** The administrative summary must reconcile product quantities, revenue,
discounts, coupons, and confirmed orders, remain read-only, and behave coherently while
checkout or coupon issuance commits concurrently.

**Options considered:** Run separate repository queries in a transaction; maintain
mutable reporting counters; use a materialized view; or aggregate all fields in one
PostgreSQL statement.

**Choice:** `GET /api/admin/report` runs one CTE-based read-only SQL statement. Confirmed
order totals and order-item snapshots are authoritative. Coupon rows are generated;
those referenced by confirmed orders are redeemed, and the remainder are available.
Product quantities group by stable UUID and use the latest successful receipt snapshot
for the display name. Aggregates are returned as decimal strings.

**Why:** One statement receives one MVCC snapshot under PostgreSQL `READ COMMITTED`, so
the report sees a concurrent commit wholly before or after it rather than mixing states.
Receipt totals reconcile directly with the order API, and string serialization avoids
JavaScript safe-integer loss for unbounded sums and counts.

**Consequences:** The endpoint is all-time and unfiltered; date-window coupon semantics
are intentionally avoided. It scans historical receipts and adds no indexes because
that is proportionate to the assignment dataset. At production scale, move the same
invariants to an asynchronously maintained reporting projection or replica after
measuring query cost.

## AI-assisted development

AI tools were used to inspect code, challenge transaction ordering, draft narrow
changes, and identify high-risk flow tests. Generated suggestions were reviewed rather
than accepted blindly. One material correction was rejecting an earlier proposal to
start a new N-order interval after configuration changes: historical orders now count
immediately, while a durable high-water mark prevents configuration toggles from
revoking or duplicating earned rewards. Another correction was keeping idempotency keys
client-generated instead of adding a server endpoint that would add latency and weaken
retry identity.

## If given another two hours

First, add fault injection around the post-coupon-lock portion of checkout to prove
rollback at each database write. Next, exercise checkout/config races repeatedly and
measure contention on the singleton reward-state row. Finally, replace the plain SQL
runner with tracked forward-only migrations and add production-style deadlock retry
telemetry.

Approximate time spent: within the assignment's requested 4–6 hour implementation
timebox, excluding exploratory discussion and review.
