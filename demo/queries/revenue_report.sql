-- MetaLens Demo Query — revenue_report.sql
-- Save this file to trigger MetaLens on-save suggestions
-- Hover over table names to see metadata cards
-- Click CodeLens buttons above this query for AI explanations and lineage

WITH monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', o.created_at) AS month,
    o.customer_id,
    c.email,
    c.segment,
    SUM(oi.quantity * oi.unit_price) AS revenue,
    COUNT(DISTINCT o.id) AS order_count
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN customers c ON o.customer_id = c.id
  WHERE o.status = 'completed'
    AND o.created_at >= '2024-01-01'
  GROUP BY 1, 2, 3, 4
),

product_performance AS (
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    SUM(oi.quantity) AS units_sold,
    SUM(oi.quantity * oi.unit_price) AS total_revenue
  FROM products p
  JOIN order_items oi ON p.id = oi.product_id
  GROUP BY 1, 2, 3
)

SELECT
  mr.month,
  mr.segment,
  SUM(mr.revenue) AS segment_revenue,
  COUNT(DISTINCT mr.customer_id) AS active_customers,
  ROUND(SUM(mr.revenue) / NULLIF(COUNT(DISTINCT mr.customer_id), 0), 2) AS avg_revenue_per_customer,
  pp.product_name AS top_product,
  pp.total_revenue AS top_product_revenue
FROM monthly_revenue mr
LEFT JOIN product_performance pp ON pp.units_sold = (
  SELECT MAX(units_sold) FROM product_performance
)
GROUP BY 1, 2, 7, 8
ORDER BY 1 DESC, 3 DESC;
