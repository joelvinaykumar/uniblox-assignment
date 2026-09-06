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
