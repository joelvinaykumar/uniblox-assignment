-- Additive and rerunnable after this migration has completed successfully.
-- CREATE TABLE IF NOT EXISTS does not repair an incompatible pre-release draft;
-- use npm run db:reset for that local-development case. The singleton row
-- serializes checkout, reconciliation, configuration changes, and issuance.
-- Never overwrite an existing configuration.
BEGIN;

CREATE TABLE IF NOT EXISTS coupon_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  order_threshold integer NOT NULL DEFAULT 5 CHECK (order_threshold > 0),
  discount_percentage integer NOT NULL DEFAULT 10 CHECK (discount_percentage BETWEEN 1 AND 100),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  confirmed_orders bigint NOT NULL DEFAULT 0 CHECK (confirmed_orders >= 0),
  earned_slots bigint NOT NULL DEFAULT 0 CHECK (earned_slots >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO coupon_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Acquire state before DDL locks on orders too, so reruns follow checkout order.
SELECT id FROM coupon_config WHERE id = 1 FOR UPDATE;

CREATE TABLE IF NOT EXISTS coupon_milestones (
  -- The ID is the cumulative reward slot, not a config-specific threshold.
  id bigint PRIMARY KEY CHECK (id > 0),
  order_threshold integer NOT NULL CHECK (order_threshold > 0),
  discount_percentage integer NOT NULL CHECK (discount_percentage BETWEEN 1 AND 100),
  config_version bigint NOT NULL CHECK (config_version > 0),
  earned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY,
  milestone_id bigint NOT NULL UNIQUE REFERENCES coupon_milestones (id),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{0,127}$'),
  issued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons (id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount_percentage integer;

CREATE UNIQUE INDEX IF NOT EXISTS orders_coupon_id_unique ON orders (coupon_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'orders'::regclass AND conname = 'orders_coupon_snapshot_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_coupon_snapshot_check CHECK (
      (coupon_id IS NULL AND coupon_code IS NULL AND coupon_discount_percentage IS NULL)
      OR (coupon_id IS NOT NULL AND coupon_code IS NOT NULL
          AND coupon_discount_percentage IS NOT NULL
          AND coupon_discount_percentage BETWEEN 1 AND 100)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coupons_available_order_idx ON coupons (issued_at, id);

-- Existing orders earn rewards immediately, under the same lock as the service.
-- Subsequent script runs preserve configuration, earned slots, and frozen rates.
WITH reward_totals AS (
  SELECT c.*, (SELECT count(*) FROM orders WHERE status = 'confirmed') AS order_count
  FROM coupon_config c WHERE c.id = 1
)
INSERT INTO coupon_milestones (id, order_threshold, discount_percentage, config_version)
SELECT slot.id, r.order_threshold, r.discount_percentage, r.version
FROM reward_totals r
CROSS JOIN LATERAL generate_series(
  r.earned_slots + 1,
  r.order_count / r.order_threshold
) AS slot(id);

UPDATE coupon_config
SET confirmed_orders = totals.order_count,
    earned_slots = GREATEST(earned_slots, totals.order_count / order_threshold)
FROM (SELECT count(*) AS order_count FROM orders WHERE status = 'confirmed') totals
WHERE id = 1;

COMMIT;