import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import type { ExtractedAsset } from '../../parsers/sql';
import { PIIChecker } from './PIIChecker';
import { FreshnessChecker } from './FreshnessChecker';

export class DiagnosticsProvider {
  private piiChecker: PIIChecker;
  private freshnessChecker: FreshnessChecker;

  constructor(
    private omClient: OpenMetadataClient,
    private collection: vscode.DiagnosticCollection
  ) {
    this.piiChecker = new PIIChecker(omClient);
    this.freshnessChecker = new FreshnessChecker(omClient);
  }

  async run(doc: vscode.TextDocument, assets: ExtractedAsset[]): Promise<void> {
    // Clear existing diagnostics for this file
    this.collection.delete(doc.uri);

    // Run both checkers in parallel
    await Promise.all([
      this.piiChecker.check(doc, assets, this.collection),
      this.freshnessChecker.check(doc, assets, this.collection),
    ]);
  }

  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  clearAll(): void {
    this.collection.clear();
  }
}
