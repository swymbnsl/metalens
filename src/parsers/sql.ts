/**
 * SQL parser — extracts table and column references from SQL text.
 * Uses node-sql-parser when available; falls back to regex.
 */

export interface ExtractedAsset {
  table: string;
  schema?: string;
  database?: string;
  columns: string[];
  alias?: string;
  /** Zero-based line number of first occurrence in text */
  line?: number;
}

let Parser: new () => { astify(sql: string): unknown } | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('node-sql-parser');
  Parser = mod.Parser;
} catch {
  // node-sql-parser not available — will use regex fallback
}

/**
 * Extract all table references from a SQL string.
 */
export function extractAssetsFromSQL(sql: string): ExtractedAsset[] {
  if (Parser) {
    try {
      const parser = new Parser!();
      const ast = parser.astify(sql);
      const assets: ExtractedAsset[] = [];
      traverseAST(ast, assets);
      if (assets.length > 0) {
        return deduplicateAssets(attachLineNumbers(assets, sql));
      }
    } catch {
      // AST parse failed — fall through to regex
    }
  }
  return deduplicateAssets(extractByRegex(sql));
}

function traverseAST(node: unknown, assets: ExtractedAsset[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;

  if ((n['type'] === 'select' || n['type'] === 'insert' || n['type'] === 'update') && n['from']) {
    const froms = Array.isArray(n['from']) ? n['from'] : [n['from']];
    for (const ref of froms as Record<string, unknown>[]) {
      if (ref['table']) {
        assets.push({
          table: String(ref['table']),
          schema: typeof ref['db'] === 'string' ? ref['db'] : undefined,
          alias: typeof ref['as'] === 'string' ? ref['as'] : undefined,
          columns: extractColumns(n['columns']),
        });
      }
      // Handle joins
      if (ref['join'] && typeof ref['join'] === 'string') {
        // Handled via recursive traversal
      }
    }
  }

  // Recurse into child nodes
  for (const value of Object.values(n)) {
    if (Array.isArray(value)) {
      value.forEach(child => traverseAST(child, assets));
    } else if (value && typeof value === 'object') {
      traverseAST(value, assets);
    }
  }
}

function extractColumns(cols: unknown): string[] {
  if (!Array.isArray(cols)) return [];
  return cols
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .filter(c => {
      const expr = c['expr'] as Record<string, unknown> | undefined;
      return expr?.['type'] === 'column_ref';
    })
    .map(c => {
      const expr = c['expr'] as Record<string, unknown>;
      return String(expr['column'] ?? '');
    })
    .filter(Boolean);
}

function extractByRegex(sql: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  // Match FROM, JOIN, INTO, UPDATE table references (including schema.table)
  const tableRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([`"[]?[a-zA-Z_][\w.`"[\]]*)/gi;
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const raw = match[1].replace(/[`"[\]]/g, '');
    const parts = raw.split('.');
    assets.push({
      table: parts[parts.length - 1],
      schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
      database: parts.length >= 3 ? parts[parts.length - 3] : undefined,
      columns: [],
    });
  }
  return assets;
}

function deduplicateAssets(assets: ExtractedAsset[]): ExtractedAsset[] {
  const seen = new Set<string>();
  return assets.filter(a => {
    const key = `${a.database ?? ''}.${a.schema ?? ''}.${a.table}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function attachLineNumbers(assets: ExtractedAsset[], sql: string): ExtractedAsset[] {
  const lines = sql.split('\n');
  return assets.map(asset => {
    const lineIdx = lines.findIndex(l =>
      l.toLowerCase().includes(asset.table.toLowerCase())
    );
    return { ...asset, line: lineIdx >= 0 ? lineIdx : 0 };
  });
}

/**
 * Extract table names referenced in dbt ref() and source() calls.
 */
export function extractDbtRefs(text: string): string[] {
  const refs: string[] = [];
  const refRegex = /\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
  const sourceRegex = /\{\{\s*source\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
  let match;
  while ((match = refRegex.exec(text)) !== null) refs.push(match[1]);
  while ((match = sourceRegex.exec(text)) !== null) refs.push(match[1]);
  return [...new Set(refs)];
}
