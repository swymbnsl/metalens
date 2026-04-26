import type { ExtractedAsset } from './sql';

/**
 * dbt YAML and Jinja parser — extracts model names, ref() and source() calls.
 */
export function extractAssetsFromDbt(text: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];

  // ref() calls: {{ ref('model_name') }}
  const refRegex = /\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
  let match;
  while ((match = refRegex.exec(text)) !== null) {
    assets.push({ table: match[1], columns: [] });
  }

  // source() calls: {{ source('schema', 'table') }}
  const sourceRegex = /\{\{\s*source\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
  while ((match = sourceRegex.exec(text)) !== null) {
    assets.push({ table: match[2], schema: match[1], columns: [] });
  }

  // YAML model name field
  const yamlNameRegex = /^[\s-]*name:\s*['"]?([a-zA-Z_][\w]*)['"]?/gm;
  while ((match = yamlNameRegex.exec(text)) !== null) {
    // Avoid duplicates from ref()
    if (!assets.find(a => a.table === match[1])) {
      assets.push({ table: match[1], columns: [] });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return assets.filter(a => {
    const key = `${a.schema ?? ''}.${a.table}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
