import { describe, it, expect } from 'vitest';
import { extractAssetsFromPython } from '../../../src/parsers/python';

describe('Python Parser', () => {
  it('extracts table from pandas read_sql', () => {
    const code = `df = pd.read_sql("SELECT * FROM orders", conn)`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'orders')).toBe(true);
  });

  it('extracts table name from read_sql_table', () => {
    const code = `df = pd.read_sql_table('customers', engine)`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'customers')).toBe(true);
  });

  it('extracts SQLAlchemy Table()', () => {
    const code = `users = Table('users', metadata, autoload=True)`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'users')).toBe(true);
  });

  it('extracts SQLAlchemy ORM __tablename__', () => {
    const code = `class Order(Base):\n    __tablename__ = 'order_items'`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'order_items')).toBe(true);
  });

  it('extracts from .execute() call', () => {
    const code = `conn.execute("SELECT id FROM products WHERE active = 1")`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'products')).toBe(true);
  });

  it('extracts dbt ref() in Python models', () => {
    const code = `data = ref('stg_events')`;
    const assets = extractAssetsFromPython(code);
    expect(assets.some(a => a.table === 'stg_events')).toBe(true);
  });

  it('deduplicates results', () => {
    const code = `
      df1 = pd.read_sql("SELECT * FROM orders", conn)
      df2 = pd.read_sql("SELECT id FROM orders", conn)
    `;
    const assets = extractAssetsFromPython(code);
    expect(assets.filter(a => a.table === 'orders').length).toBe(1);
  });

  it('returns empty for non-Python code', () => {
    const assets = extractAssetsFromPython('print("hello world")');
    expect(assets).toEqual([]);
  });
});
