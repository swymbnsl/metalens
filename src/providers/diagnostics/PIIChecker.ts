import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import type { ExtractedAsset } from '../../parsers/sql';
import { getSettings } from '../../config/settings';
import { logError } from '../../utils/logger';

export class PIIChecker {
  constructor(private omClient: OpenMetadataClient) {}

  async check(
    doc: vscode.TextDocument,
    assets: ExtractedAsset[],
    collection: vscode.DiagnosticCollection
  ): Promise<void> {
    if (!getSettings().piiDiagnostics) return;

    const diagnostics: vscode.Diagnostic[] = [];
    const text = doc.getText();
    const lines = text.split('\n');

    for (const asset of assets) {
      try {
        const table = await this.omClient.findTable(asset.table, asset.schema);
        if (!table) continue;

        const piiCols = (table.columns ?? []).filter(col =>
          col.tags?.some(t => t.tagFQN.toLowerCase().includes('pii'))
        );

        for (const piiCol of piiCols) {
          // Check if the column name appears in the query text
          if (!asset.columns.includes(piiCol.name) && !text.includes('*')) {
            continue; // not referenced, skip
          }

          // Find line where column appears
          const lineIdx = lines.findIndex(l =>
            l.toLowerCase().includes(piiCol.name.toLowerCase())
          );
          const targetLine = lineIdx >= 0 ? lineIdx : (asset.line ?? 0);
          const lineText = lines[targetLine] ?? '';
          const colStart = lineText.toLowerCase().indexOf(piiCol.name.toLowerCase());
          const start = new vscode.Position(targetLine, Math.max(0, colStart));
          const end = new vscode.Position(targetLine, Math.max(0, colStart + piiCol.name.length));

          const tagName = piiCol.tags?.find(t => t.tagFQN.toLowerCase().includes('pii'))?.tagFQN ?? 'PII';
          const diag = new vscode.Diagnostic(
            new vscode.Range(start, end),
            `⚠️ Column '${piiCol.name}' is tagged ${tagName} in OpenMetadata.\n` +
              `Ensure access is authorized and data is handled per policy.`,
            vscode.DiagnosticSeverity.Warning
          );
          diag.code = 'metalens.pii';
          diag.source = 'MetaLens';
          diagnostics.push(diag);
        }
      } catch (err) {
        logError(`PIIChecker error for table ${asset.table}`, err);
      }
    }

    collection.set(doc.uri, diagnostics);
  }
}
