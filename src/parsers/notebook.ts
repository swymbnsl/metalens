import type { ExtractedAsset } from './sql';

/**
 * Jupyter notebook (.ipynb) parser — extracts SQL from magic cells and pandas calls.
 * Notebooks are JSON files; we parse the cell sources for SQL content.
 */
export function extractAssetsFromNotebook(notebookJson: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  try {
    const nb = JSON.parse(notebookJson) as {
      cells: Array<{ cell_type: string; source: string | string[] }>;
    };
    for (const cell of nb.cells ?? []) {
      const source = Array.isArray(cell.source)
        ? cell.source.join('')
        : cell.source;

      // %%sql magic cells
      if (source.trimStart().startsWith('%%sql') || source.trimStart().startsWith('%sql')) {
        const sql = source.replace(/^%{1,2}sql[^\n]*\n/, '');
        const fromRegex = /(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi;
        let match;
        while ((match = fromRegex.exec(sql)) !== null) {
          const parts = match[1].split('.');
          assets.push({
            table: parts[parts.length - 1],
            schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
            columns: [],
          });
        }
      }

      // pandas read_sql in code cells
      if (cell.cell_type === 'code') {
        const pandasRegex = /read_sql\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = pandasRegex.exec(source)) !== null) {
          const fromRegex2 = /(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi;
          let m2;
          while ((m2 = fromRegex2.exec(match[1])) !== null) {
            const parts = m2[1].split('.');
            assets.push({
              table: parts[parts.length - 1],
              columns: [],
            });
          }
        }
      }
    }
  } catch {
    // Not a valid notebook JSON
  }

  const seen = new Set<string>();
  return assets.filter(a => {
    if (seen.has(a.table.toLowerCase())) return false;
    seen.add(a.table.toLowerCase());
    return true;
  });
}
