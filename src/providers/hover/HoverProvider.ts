import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import { extractAssetsFromSQL } from '../../parsers/sql';
import { extractAssetsFromPython } from '../../parsers/python';
import { extractAssetsFromDbt } from '../../parsers/dbt';
import { buildHoverCard } from './HoverCard';
import { logError } from '../../utils/logger';

export class HoverProvider implements vscode.HoverProvider {
  constructor(private omClient: OpenMetadataClient) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][\w.]*/);
    if (!wordRange) return;

    const word = document.getText(wordRange);
    if (!word || word.length < 2) return;

    // Extract assets from current file to see if this word is a known table
    const text = document.getText();
    const lang = document.languageId;
    let assets = extractAssetsFromSQL(text);

    if (lang === 'python') {
      assets = [...assets, ...extractAssetsFromPython(text)];
    } else if (lang === 'yaml' || lang === 'jinja-sql') {
      assets = [...assets, ...extractAssetsFromDbt(text)];
    }

    // Check if hovered word matches a detected table name
    const matchedAsset = assets.find(
      a => a.table.toLowerCase() === word.toLowerCase() ||
           (a.alias && a.alias.toLowerCase() === word.toLowerCase())
    );

    if (!matchedAsset && !this.looksLikeTableRef(word, document, position)) {
      return;
    }

    const tableName = matchedAsset?.table ?? word;
    const schema = matchedAsset?.schema;

    try {
      const table = await this.omClient.findTable(tableName, schema);
      if (!table) return;

      const hoverCard = buildHoverCard(table);
      return new vscode.Hover(hoverCard, wordRange);
    } catch (err) {
      logError('Hover provider error', err);
      return;
    }
  }

  /** Heuristic: does the word appear after FROM/JOIN/INTO? */
  private looksLikeTableRef(
    word: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    if (word.length < 3) return false;
    const lineText = document.lineAt(position.line).text;
    const charBefore = lineText.substring(0, position.character);
    return /(?:FROM|JOIN|INTO|UPDATE)\s+[\w.]*$/i.test(charBefore);
  }
}
