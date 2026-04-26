import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../api/openmetadata';
import type { DiagnosticsProvider } from '../providers/diagnostics/DiagnosticsProvider';
import { extractAssetsFromSQL } from '../parsers/sql';
import { extractAssetsFromPython } from '../parsers/python';
import { extractAssetsFromDbt } from '../parsers/dbt';
import { getSettings } from '../config/settings';
import { logError } from '../utils/logger';

const SUPPORTED = new Set(['sql', 'python', 'yaml', 'jinja-sql']);

export class OnSaveHandler {
  constructor(
    private omClient: OpenMetadataClient,
    private diagnostics: DiagnosticsProvider
  ) {}

  async handle(doc: vscode.TextDocument): Promise<void> {
    const lang = doc.languageId;
    if (!SUPPORTED.has(lang)) return;

    const settings = getSettings();
    if (!settings.onSaveSuggestions) return;

    // Don't run if not connected
    if (!settings.host || !settings.token) return;

    try {
      const text = doc.getText();
      let assets = extractAssetsFromSQL(text);

      if (lang === 'python') {
        assets = [...assets, ...extractAssetsFromPython(text)];
      } else if (lang === 'yaml' || lang === 'jinja-sql') {
        assets = [...assets, ...extractAssetsFromDbt(text)];
      }

      if (assets.length === 0) {
        this.diagnostics.clear(doc.uri);
        return;
      }

      // Run diagnostics (PII, freshness) in background
      void this.diagnostics.run(doc, assets).catch(err =>
        logError('Diagnostics error on save', err)
      );

      // Show a subtle status bar message
      const uniqueTables = [...new Set(assets.map(a => a.table))];
      if (uniqueTables.length > 0) {
        const msg = `MetaLens: ${uniqueTables.length} table${uniqueTables.length > 1 ? 's' : ''} detected. Hover for metadata.`;
        vscode.window.setStatusBarMessage(`$(database) ${msg}`, 5000);
      }
    } catch (err) {
      logError('OnSaveHandler error', err);
    }
  }
}
