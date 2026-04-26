import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../api/openmetadata';
import type { OMTable } from '../api/types';
import { logError } from '../utils/logger';

export class AssetDetailPanel {
  static panels = new Map<string, AssetDetailPanel>();
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    om: OpenMetadataClient,
    fqn: string
  ): void {
    if (AssetDetailPanel.panels.has(fqn)) {
      AssetDetailPanel.panels.get(fqn)!.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'metalens.assetDetail',
      `MetaLens: ${fqn.split('.').pop() ?? fqn}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );
    AssetDetailPanel.panels.set(fqn, new AssetDetailPanel(panel, extensionUri, om, fqn));
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private om: OpenMetadataClient,
    private fqn: string
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
        AssetDetailPanel.panels.delete(fqn);
        this.disposables.forEach(d => d.dispose());
      },
      null,
      this.disposables
    );

    setTimeout(() => void this.loadAsset(), 300);
  }

  private async loadAsset(): Promise<void> {
    try {
      await this.panel.webview.postMessage({ type: 'loading', fqn: this.fqn });
      const table = await this.om.getTableByFQN(this.fqn);
      await this.panel.webview.postMessage({ type: 'assetData', data: table });

      // Load DQ tests
      try {
        const dq = await this.om.getDataQualityTests(table.id);
        await this.panel.webview.postMessage({ type: 'dqData', data: dq });
      } catch {
        // DQ may not be available
      }
    } catch (err) {
      logError('AssetDetailPanel load error', err);
      await this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to load asset: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private async handleMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          await this.loadAsset();
          break;

        case 'updateDescription': {
          const table = await this.om.getTableByFQN(this.fqn);
          await this.om.updateDescription('tables', table.id, String(msg.description));
          await this.panel.webview.postMessage({
            type: 'notification',
            message: 'Description updated successfully! ✓',
            level: 'success',
          });
          await this.loadAsset();
          break;
        }

        case 'vote': {
          const table = await this.om.getTableByFQN(this.fqn);
          await this.om.vote('tables', table.id, msg.voteType as 'votedUp' | 'votedDown' | 'unVoted');
          await this.panel.webview.postMessage({
            type: 'notification',
            message: 'Vote recorded!',
            level: 'success',
          });
          break;
        }

        case 'showLineage':
          void vscode.commands.executeCommand('metalens.showLineage', this.fqn);
          break;

        case 'openInCollate': {
          const { getSettings } = await import('../config/settings');
          const settings = getSettings();
          void vscode.env.openExternal(
            vscode.Uri.parse(`${settings.host}/table/${encodeURIComponent(this.fqn)}`)
          );
          break;
        }
      }
    } catch (err) {
      logError('AssetDetailPanel message error', err);
      await this.panel.webview.postMessage({
        type: 'error',
        message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private getHtml(extensionUri: vscode.Uri): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'asset-detail.js')
    );
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this.panel.webview.cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetaLens Asset Detail</title>
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
