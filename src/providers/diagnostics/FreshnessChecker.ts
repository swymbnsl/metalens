import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import type { ExtractedAsset } from '../../parsers/sql';
import { logError } from '../../utils/logger';

const STALE_THRESHOLD_DAYS = 7;

export class FreshnessChecker {
  constructor(private omClient: OpenMetadataClient) {}

  async check(
    doc: vscode.TextDocument,
    assets: ExtractedAsset[],
    collection: vscode.DiagnosticCollection
  ): Promise<void> {
    const diagnostics: vscode.Diagnostic[] = [];
    const existing = collection.get(doc.uri) ?? [];

    for (const asset of assets) {
      try {
        const table = await this.omClient.findTable(asset.table, asset.schema);
        if (!table?.updatedAt) continue;

        const updatedAt = new Date(table.updatedAt);
        const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince > STALE_THRESHOLD_DAYS) {
          const lineIdx = asset.line ?? 0;
          const range = new vscode.Range(lineIdx, 0, lineIdx, Number.MAX_SAFE_INTEGER);
          const diag = new vscode.Diagnostic(
            range,
            `ℹ️ Table '${asset.table}' was last updated ${Math.floor(daysSince)} days ago in OpenMetadata. ` +
              `Verify data freshness before use.`,
            vscode.DiagnosticSeverity.Information
          );
          diag.code = 'metalens.freshness';
          diag.source = 'MetaLens';
          diagnostics.push(diag);
        }
      } catch (err) {
        logError(`FreshnessChecker error for ${asset.table}`, err);
      }
    }

    // Merge with existing PII diagnostics (don't overwrite)
    const piiDiags = [...existing].filter(d =>
      d instanceof vscode.Diagnostic && d.code === 'metalens.pii'
    );
    collection.set(doc.uri, [...piiDiags, ...diagnostics]);
  }
}
