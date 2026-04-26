import * as vscode from 'vscode';

export function notify(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  actions?: string[]
): Thenable<string | undefined> {
  switch (level) {
    case 'warning':
      return vscode.window.showWarningMessage(message, ...(actions ?? []));
    case 'error':
      return vscode.window.showErrorMessage(message, ...(actions ?? []));
    default:
      return vscode.window.showInformationMessage(message, ...(actions ?? []));
  }
}

export function statusMessage(message: string, durationMs = 4000): void {
  vscode.window.setStatusBarMessage(`$(database) ${message}`, durationMs);
}
