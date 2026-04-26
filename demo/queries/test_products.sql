-- MetaLens Test Query
SELECT 
    product_id,
    product_name,
    brand,
    category,
    price,
    cost,
    is_active
FROM acme_nexus_raw_data.acme_raw.catalog.products
WHERE is_active = true
ORDER BY price DESC
LIMIT 10;