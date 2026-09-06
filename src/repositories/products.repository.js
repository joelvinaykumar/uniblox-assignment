const { query } = require('../db/pool');

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    unitPriceCents: row.unit_price_cents,
    availableInventory: row.available_inventory,
    metadata: row.metadata,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listProducts({ includeInactive = false } = {}) {
  const result = includeInactive
    ? await query('SELECT * FROM products ORDER BY id')
    : await query('SELECT * FROM products WHERE is_active = true ORDER BY id');

  return result.rows.map(mapProduct);
}

async function getProductById(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return undefined;
  }

  return mapProduct(result.rows[0]);
}

async function createProduct({
  name,
  unitPriceCents,
  availableInventory,
  metadata = {},
  isActive = true,
}) {
  const result = await query(
    `INSERT INTO products (name, unit_price_cents, available_inventory, metadata, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, unitPriceCents, availableInventory, metadata, isActive],
  );

  return mapProduct(result.rows[0]);
}

async function updateProduct(id, fields) {
  const columnMap = {
    name: 'name',
    unitPriceCents: 'unit_price_cents',
    availableInventory: 'available_inventory',
    metadata: 'metadata',
    isActive: 'is_active',
  };

  const setClauses = [];
  const values = [];
  let index = 1;

  for (const [key, column] of Object.entries(columnMap)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${column} = $${index}`);
      values.push(fields[key]);
      index += 1;
    }
  }

  if (setClauses.length === 0) {
    return getProductById(id);
  }

  setClauses.push('updated_at = now()');
  values.push(id);

  const result = await query(
    `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${index} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  return mapProduct(result.rows[0]);
}

async function adjustInventory(id, delta) {
  const result = await query(
    `UPDATE products
     SET available_inventory = available_inventory + $1,
         updated_at = now()
     WHERE id = $2
       AND available_inventory + $1 >= 0
     RETURNING *`,
    [delta, id],
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  return mapProduct(result.rows[0]);
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustInventory,
};
