-- Products schema and seed data.
-- Money is stored in integer cents to avoid floating-point rounding errors.
-- Flexible, non-invariant attributes live in `metadata` (jsonb) so they can
-- evolve without schema migrations. Core invariants (price, inventory) are
-- typed columns with constraints.

CREATE TABLE IF NOT EXISTS products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  available_inventory integer NOT NULL CHECK (available_inventory >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_is_active_idx ON products (is_active);
CREATE INDEX IF NOT EXISTS products_metadata_gin_idx ON products USING GIN (metadata);

-- Seed at least five products, including one with limited inventory.
-- Seeding is idempotent by name so re-running does not create duplicates.
INSERT INTO products (name, unit_price_cents, available_inventory, metadata)
SELECT * FROM (
  VALUES
    ('Classic Ceramic Mug', 1299, 500, '{"category":"drinkware","color":"white","tags":["mug","ceramic"]}'::jsonb),
    ('Stainless Steel Water Bottle', 2499, 250, '{"category":"drinkware","capacityMl":750,"color":"silver"}'::jsonb),
    ('Cotton Graphic T-Shirt', 1999, 120, '{"category":"apparel","sizes":["S","M","L","XL"],"material":"cotton"}'::jsonb),
    ('Wireless Mouse', 3599, 60, '{"category":"electronics","brand":"Acme","connectivity":"bluetooth"}'::jsonb),
    ('Limited Edition Enamel Pin', 899, 3, '{"category":"collectible","limited":true,"tags":["pin","enamel"]}'::jsonb)
) AS seed(name, unit_price_cents, available_inventory, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.name = seed.name
);
