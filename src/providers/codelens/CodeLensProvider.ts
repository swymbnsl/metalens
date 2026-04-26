import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import { extractAssetsFromSQL } from '../../parsers/sql';
import { extractAssetsFromPython } from '../../parsers/python';
import { extractAssetsFromDbt } from '../../parsers/dbt';

export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private omClient: OpenMetadataClient) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lang = document.languageId;
    const text = document.getText();

    let assets = extractAssetsFromSQL(text);
    if (lang === 'python') {
      assets = [...assets, ...extractAssetsFromPython(text)];
    } else if (lang === 'yaml' || lang === 'jinja-sql') {
      assets = [...assets, ...extractAssetsFromDbt(text)];
    }

    if (assets.length === 0) return [];

    const lenses: vscode.CodeLens[] = [];

    // Add CodeLens at the start of the file for global actions
    const firstLine = new vscode.Range(0, 0, 0, 0);

    // "Explain this query" — only for SQL
    if (lang === 'sql' || lang === 'jinja-sql') {
      lenses.push(
        new vscode.CodeLens(firstLine, {
          title: '▶ Explain this query',
          command: 'metalens.explainQuery',
          tooltip: 'Ask MetaLens AI to explain this query using metadata context',
          arguments: [document.getText()],
        })
      );
    }

    // Per-table CodeLens actions — find where each table name appears
    for (const asset of assets.slice(0, 10)) {
      const lineIdx = this.findTableLine(document, asset.table);
      const range = new vscode.Range(lineIdx, 0, lineIdx, 0);
      const lineageTarget = this.getLineageTarget(asset);

      lenses.push(
        new vscode.CodeLens(range, {
          title: `🔍 Lineage: ${asset.table}`,
          command: 'metalens.showLineage',
          tooltip: `View upstream/downstream lineage for ${asset.table}`,
          arguments: [lineageTarget],
        })
      );

      lenses.push(
        new vscode.CodeLens(range, {
          title: `⚠️ Data Quality`,
          command: 'metalens.checkDataQuality',
          tooltip: `Check data quality test results for ${asset.table}`,
          arguments: [asset.table, asset.schema],
        })
      );

      lenses.push(
        new vscode.CodeLens(range, {
          title: `📝 Add Description`,
          command: 'metalens.addDescription',
          tooltip: `Edit table or column description in OpenMetadata`,
          arguments: [asset.table, asset.schema],
        })
      );
    }

    return lenses;
  }

  private findTableLine(document: vscode.TextDocument, tableName: string): number {
    const text = document.getText();
    const lines = text.split('\n');
    const lowerTable = tableName.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerTable)) {
        return i;
      }
    }
    return 0;
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  private getLineageTarget(asset: {
    table: string;
    schema?: string;
    database?: string;
    fqn?: string;
  }): string {
    if (asset.fqn) return asset.fqn;
    return [asset.database, asset.schema, asset.table].filter(Boolean).join('.');
  }
}
