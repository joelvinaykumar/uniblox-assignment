-- Carts hold product quantities for a customer until checkout.
-- Inventory is not reserved here; checkout decrements stock.

CREATE TABLE IF NOT EXISTS carts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id text NOT NULL REFERENCES auth_users (id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS carts_one_open_per_customer_idx
  ON carts (customer_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS carts_customer_id_idx ON carts (customer_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id bigint NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items (cart_id);
