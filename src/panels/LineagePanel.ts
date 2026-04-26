import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../api/openmetadata';
import { logError } from '../utils/logger';

export class LineagePanel {
  static currentPanel: LineagePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    om: OpenMetadataClient,
    fqn?: string
  ): void {
    if (LineagePanel.currentPanel) {
      LineagePanel.currentPanel.panel.reveal();
      if (fqn) {
        void LineagePanel.currentPanel.loadLineage(fqn);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'metalens.lineage',
      'MetaLens Lineage',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );
    LineagePanel.currentPanel = new LineagePanel(panel, extensionUri, om, fqn);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private om: OpenMetadataClient,
    initialFqn?: string
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
        LineagePanel.currentPanel = undefined;
        this.disposables.forEach(d => d.dispose());
      },
      null,
      this.disposables
    );

    if (initialFqn) {
      // Small delay to allow webview to initialize
      setTimeout(() => void this.loadLineage(initialFqn), 500);
    }
  }

  private async loadLineage(
    fqn: string,
    upstreamDepth = 2,
    downstreamDepth = 2
  ): Promise<void> {
    try {
      await this.panel.webview.postMessage({ type: 'loading', fqn });
      const lineage = await this.om.getLineage(fqn, 'table', upstreamDepth, downstreamDepth);
      await this.panel.webview.postMessage({ type: 'lineageData', data: lineage, fqn });
    } catch (err) {
      logError('LineagePanel fetch error', err);
      await this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to load lineage for ${fqn}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private async handleMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    switch (msg.type) {
      case 'ready':
        break;

      case 'loadLineage':
        await this.loadLineage(
          String(msg.fqn),
          Number(msg.upstreamDepth ?? 2),
          Number(msg.downstreamDepth ?? 2)
        );
        break;

      case 'nodeClicked':
        void vscode.commands.executeCommand('metalens.showAssetDetail', String(msg.fqn));
        break;

      case 'requestSearch': {
        const results = await this.om.searchAssets(String(msg.query), 10);
        await this.panel.webview.postMessage({ type: 'searchResults', results });
        break;
      }
    }
  }

  private getHtml(extensionUri: vscode.Uri): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'lineage.js')
    );
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; img-src ${this.panel.webview.cspSource} data: blob:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetaLens Lineage</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += chars[Math.floor(Math.random() * chars.length)];
    return text;
  }
}
