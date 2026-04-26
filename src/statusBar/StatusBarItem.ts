import * as vscode from 'vscode';

export class StatusBarItem implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private connected = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'metalens.openChat';
    this.item.tooltip = 'MetaLens — Click to open AI Chat';
    this.setConnecting();
    this.item.show();
  }

  setConnecting(): void {
    this.item.text = '$(sync~spin) MetaLens';
    this.item.backgroundColor = undefined;
    this.item.color = new vscode.ThemeColor('statusBar.foreground');
  }

  setConnected(ok: boolean): void {
    this.connected = ok;
    if (ok) {
      this.item.text = '$(database) MetaLens';
      this.item.backgroundColor = undefined;
      this.item.color = new vscode.ThemeColor('statusBar.foreground');
      this.item.tooltip = 'MetaLens — Connected ✓. Click to open AI Chat.';
    } else {
      this.item.text = '$(warning) MetaLens';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.tooltip = 'MetaLens — Not connected. Click to configure.';
      this.item.command = 'metalens.configure';
    }
  }

  setDetecting(tableCount: number): void {
    this.item.text = `$(database) MetaLens (${tableCount} table${tableCount > 1 ? 's' : ''})`;
  }

  isConnected(): boolean {
    return this.connected;
  }

  dispose(): void {
    this.item.dispose();
  }
}
