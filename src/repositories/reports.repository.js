const { query } = require('../db/pool');

// One statement means every aggregate observes the same PostgreSQL MVCC
// snapshot, even when checkout or coupon issuance commits concurrently.
async function getAdminReport() {
  const result = await query(
    `WITH successful_orders AS (
       SELECT id, coupon_id, subtotal_cents, discount_cents, total_cents, created_at
       FROM orders
       WHERE status = 'confirmed'
     ),
     product_quantities AS (
       SELECT oi.product_id, SUM(oi.quantity)::text AS purchased_quantity
       FROM order_items oi
       JOIN successful_orders so ON so.id = oi.order_id
       GROUP BY oi.product_id
     ),
     latest_product_names AS (
       SELECT DISTINCT ON (oi.product_id)
         oi.product_id,
         oi.product_name
       FROM order_items oi
       JOIN successful_orders so ON so.id = oi.order_id
       ORDER BY oi.product_id, so.created_at DESC, so.id DESC, oi.id DESC
     ),
     product_totals AS (
       SELECT COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'productId', pq.product_id::text,
             'productName', lpn.product_name,
             'purchasedQuantity', pq.purchased_quantity
           )
           ORDER BY pq.product_id
         ),
         '[]'::jsonb
       ) AS products
       FROM product_quantities pq
       JOIN latest_product_names lpn ON lpn.product_id = pq.product_id
     ),
     order_totals AS (
       SELECT
         COUNT(*)::text AS total_orders,
         COALESCE(SUM(subtotal_cents), 0)::text AS gross_revenue_cents,
         COALESCE(SUM(discount_cents), 0)::text AS total_discounts_cents,
         COALESCE(SUM(total_cents), 0)::text AS net_revenue_cents
       FROM successful_orders
     ),
     coupon_totals AS (
       SELECT
         COUNT(c.id)::text AS generated,
         COUNT(c.id) FILTER (WHERE so.id IS NULL)::text AS available,
         COUNT(c.id) FILTER (WHERE so.id IS NOT NULL)::text AS redeemed
       FROM coupons c
       LEFT JOIN successful_orders so ON so.coupon_id = c.id
     )
     SELECT
       pt.products,
       ot.gross_revenue_cents,
       ot.total_discounts_cents,
       ot.net_revenue_cents,
       ct.generated AS coupons_generated,
       ct.available AS coupons_available,
       ct.redeemed AS coupons_redeemed,
       ot.total_orders
     FROM product_totals pt
     CROSS JOIN order_totals ot
     CROSS JOIN coupon_totals ct`,
  );

  const row = result.rows[0];
  return {
    purchasedQuantityByProduct: row.products,
    grossRevenueCents: row.gross_revenue_cents,
    totalDiscountsCents: row.total_discounts_cents,
    netRevenueCents: row.net_revenue_cents,
    couponsGenerated: row.coupons_generated,
    couponsAvailable: row.coupons_available,
    couponsRedeemed: row.coupons_redeemed,
    totalOrders: row.total_orders,
  };
}

module.exports = { getAdminReport };
