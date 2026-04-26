import * as vscode from 'vscode';
import type { AISdkClient } from '../api/ai-sdk';
import type { OpenMetadataClient } from '../api/openmetadata';
import { extractAssetsFromSQL } from '../parsers/sql';
import { extractAssetsFromPython } from '../parsers/python';
import { getSettings } from '../config/settings';
import { logError } from '../utils/logger';
import * as path from 'path';

export class ChatPanel {
  static currentPanel: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    ai: AISdkClient,
    om: OpenMetadataClient
  ): void {
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'metalens.chat',
      'MetaLens Chat',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );
    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, ai, om);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private ai: AISdkClient,
    private om: OpenMetadataClient
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(extensionUri);

    this.panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        ChatPanel.currentPanel = undefined;
        this.disposables.forEach(d => d.dispose());
      },
      null,
      this.disposables
    );

    // Pre-seed context from active editor
    this.seedContextFromEditor();
  }

  private seedContextFromEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const lang = editor.document.languageId;
    const text = editor.document.getText();

    let tables: string[] = [];
    if (lang === 'sql' || lang === 'jinja-sql') {
      tables = extractAssetsFromSQL(text).map(a => a.table);
    } else if (lang === 'python') {
      tables = extractAssetsFromPython(text).map(a => a.table);
    }

    if (tables.length > 0) {
      void this.panel.webview.postMessage({
        type: 'seedContext',
        tables: [...new Set(tables)],
        fileName: path.basename(editor.document.fileName),
        language: lang,
      });
    }
  }

  private async handleMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    try {
      switch (msg.type) {
        case 'sendMessage': {
          const { text, agentName, context } = msg as {
            text: string;
            agentName: string;
            context: string[];
          };

          const contextStr = context?.length
            ? `Context: User is working with tables: ${context.join(', ')}.\n\n`
            : '';
          const prompt = `${contextStr}${text}`;

          await this.panel.webview.postMessage({ type: 'startStream' });

          try {
            for await (const chunk of this.ai.streamResponse(
              agentName ?? getSettings().defaultAgent,
              prompt
            )) {
              await this.panel.webview.postMessage({ type: 'chunk', content: chunk });
            }
          } catch (e: unknown) {
            const msg2 = e instanceof Error ? e.message : String(e);
            await this.panel.webview.postMessage({ type: 'error', message: msg2 });
          }

          await this.panel.webview.postMessage({ type: 'endStream' });
          break;
        }

        case 'searchAssets': {
          const results = await this.om.searchAssets(String(msg.query));
          await this.panel.webview.postMessage({ type: 'searchResults', results });
          break;
        }

        case 'showLineage': {
          void vscode.commands.executeCommand('metalens.showLineage', String(msg.fqn));
          break;
        }

        case 'showAssetDetail': {
          void vscode.commands.executeCommand('metalens.showAssetDetail', String(msg.fqn));
          break;
        }

        case 'getAgents': {
          const agents = await this.om.getAIAgents();
          await this.panel.webview.postMessage({ type: 'agentList', agents });
          break;
        }

        case 'ready': {
          this.seedContextFromEditor();
          const agents = await this.om.getAIAgents();
          await this.panel.webview.postMessage({ type: 'agentList', agents });
          await this.panel.webview.postMessage({
            type: 'config',
            defaultAgent: getSettings().defaultAgent,
          });
          break;
        }
      }
    } catch (err) {
      logError('ChatPanel message handler error', err);
    }
  }

  private getHtml(extensionUri: vscode.Uri): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'chat.js')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; font-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} data: https:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetaLens Chat</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
