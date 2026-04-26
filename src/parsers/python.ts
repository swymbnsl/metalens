import type { ExtractedAsset } from './sql';

/**
 * Python file parser — extracts table references from common patterns:
 * - pandas: read_sql('SELECT ... FROM table', ...)
 * - SQLAlchemy: Table('tablename', ...)
 * - dbt ref() calls in Python models
 * - raw string SQL literals
 */
export function extractAssetsFromPython(source: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];

  // pandas read_sql / read_sql_query / read_sql_table
  const pandasRegex = /(?:read_sql|read_sql_query|read_sql_table)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = pandasRegex.exec(source)) !== null) {
    const sql = match[1];
    // If it looks like a table name (no spaces/SQL keywords), treat as direct table
    if (/^[a-zA-Z_][\w.]*$/.test(sql.trim())) {
      const parts = sql.trim().split('.');
      assets.push({
        table: parts[parts.length - 1],
        schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
        database: parts.length >= 3 ? parts[parts.length - 3] : undefined,
        fqn: sql.trim(),
        columns: [],
      });
    } else {
      // Treat as SQL string — extract from/join
      const fromRegex = /(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi;
      let m2;
      while ((m2 = fromRegex.exec(sql)) !== null) {
        const parts = m2[1].split('.');
        assets.push({
          table: parts[parts.length - 1],
          schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
          database: parts.length >= 3 ? parts[parts.length - 3] : undefined,
          fqn: m2[1],
          columns: [],
        });
      }
    }
  }

  // SQLAlchemy Table('name', ...)
  const saTableRegex = /Table\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = saTableRegex.exec(source)) !== null) {
    assets.push({ table: match[1], columns: [] });
  }

  // SQLAlchemy ORM class __tablename__ = '...'
  const tableNameRegex = /__tablename__\s*=\s*['"]([^'"]+)['"]/g;
  while ((match = tableNameRegex.exec(source)) !== null) {
    assets.push({ table: match[1], columns: [] });
  }

  // execute("SELECT ... FROM table ...")
  const executeRegex = /\.execute\s*\(\s*(?:text\s*\()?\s*['"`]([^'"`]+)['"`]/g;
  while ((match = executeRegex.exec(source)) !== null) {
    const fromRegex = /(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi;
    let m2;
    while ((m2 = fromRegex.exec(match[1])) !== null) {
      const parts = m2[1].split('.');
      assets.push({
        table: parts[parts.length - 1],
        schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
        database: parts.length >= 3 ? parts[parts.length - 3] : undefined,
        fqn: m2[1],
        columns: [],
      });
    }
  }

  // dbt ref()
  const dbtRefRegex = /ref\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dbtRefRegex.exec(source)) !== null) {
    assets.push({ table: match[1], columns: [] });
  }

  // Deduplicate
  const seen = new Set<string>();
  return assets.filter(a => {
    const key = a.table.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
