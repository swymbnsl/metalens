import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('MetaLens');
  }
  return outputChannel;
}

export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const ts = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  getOutputChannel().appendLine(`[${ts}] ${prefix} ${message}`);
}

export function logError(message: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : String(err ?? '');
  log(`${message}${detail ? ': ' + detail : ''}`, 'error');
  if (err instanceof Error && err.stack) {
    getOutputChannel().appendLine(err.stack);
  }
}
