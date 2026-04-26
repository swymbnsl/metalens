import { describe, it, expect } from 'vitest';
import { extractAssetsFromSQL, extractDbtRefs } from '../../../src/parsers/sql';

describe('SQL Parser', () => {
  it('extracts table from simple SELECT', () => {
    const assets = extractAssetsFromSQL('SELECT * FROM orders');
    expect(assets.some(a => a.table === 'orders')).toBe(true);
  });

  it('extracts table with schema prefix', () => {
    const assets = extractAssetsFromSQL('SELECT id FROM ecommerce.orders');
    expect(assets.some(a => a.table === 'orders')).toBe(true);
  });

  it('extracts multiple tables from JOINs', () => {
    const sql = 'SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id';
    const assets = extractAssetsFromSQL(sql);
    const names = assets.map(a => a.table);
    expect(names).toContain('orders');
    expect(names).toContain('customers');
  });

  it('extracts tables from CTEs', () => {
    const sql = `
      WITH revenue AS (SELECT * FROM orders)
      SELECT * FROM revenue JOIN products ON revenue.product_id = products.id
    `;
    const assets = extractAssetsFromSQL(sql);
    const names = assets.map(a => a.table);
    expect(names.includes('orders') || names.includes('products')).toBe(true);
  });

  it('handles subqueries', () => {
    const sql = 'SELECT * FROM (SELECT id FROM users WHERE active = 1) sub';
    const assets = extractAssetsFromSQL(sql);
    expect(assets.some(a => a.table === 'users')).toBe(true);
  });

  it('handles backtick-quoted table names', () => {
    const sql = 'SELECT * FROM `my_schema`.`my_table`';
    const assets = extractAssetsFromSQL(sql);
    expect(assets.some(a => a.table === 'my_table' || a.table === 'my_schema')).toBe(true);
  });

  it('deduplicates repeated table references', () => {
    const sql = 'SELECT * FROM orders o1 JOIN orders o2 ON o1.id = o2.parent_id';
    const assets = extractAssetsFromSQL(sql);
    const orderAssets = assets.filter(a => a.table === 'orders');
    expect(orderAssets.length).toBe(1);
  });

  it('returns empty array for non-SQL content', () => {
    const assets = extractAssetsFromSQL('This is not SQL at all');
    expect(assets).toEqual([]);
  });

  it('extracts from UPDATE statement', () => {
    const sql = 'UPDATE users SET status = "active" WHERE id = 1';
    const assets = extractAssetsFromSQL(sql);
    expect(assets.some(a => a.table === 'users')).toBe(true);
  });

  it('extracts from INSERT statement', () => {
    const sql = 'INSERT INTO orders (id, status) VALUES (1, "pending")';
    const assets = extractAssetsFromSQL(sql);
    expect(assets.some(a => a.table === 'orders')).toBe(true);
  });

  it('extracts dbt ref() calls', () => {
    const text = "SELECT * FROM {{ ref('stg_orders') }} JOIN {{ ref('dim_products') }} ON 1=1";
    const refs = extractDbtRefs(text);
    expect(refs).toContain('stg_orders');
    expect(refs).toContain('dim_products');
  });

  it('extracts dbt source() calls', () => {
    const text = "SELECT * FROM {{ source('raw_db', 'events') }}";
    const refs = extractDbtRefs(text);
    expect(refs).toContain('events');
  });

  it('handles empty SQL string', () => {
    expect(extractAssetsFromSQL('')).toEqual([]);
  });

  it('handles SQL with only comments', () => {
    const sql = '-- SELECT * FROM orders\n/* SELECT id FROM users */';
    // Should not crash
    const assets = extractAssetsFromSQL(sql);
    expect(Array.isArray(assets)).toBe(true);
  });
});
