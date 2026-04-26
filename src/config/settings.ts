import * as vscode from 'vscode';

export interface MetaLensSettings {
  host: string;
  token: string;
  defaultAgent: string;
  onSaveSuggestions: boolean;
  piiDiagnostics: boolean;
  cacheSeconds: number;
  geminiKey: string;
}

export function getSettings(): MetaLensSettings {
  const config = vscode.workspace.getConfiguration('metalens');
  return {
    host: (config.get<string>('host') ?? '').replace(/\/$/, ''),
    token: config.get<string>('token') ?? '',
    defaultAgent: config.get<string>('defaultAgent') ?? 'AskCollateAgent',
    onSaveSuggestions: config.get<boolean>('onSaveSuggestions') ?? true,
    piiDiagnostics: config.get<boolean>('piiDiagnostics') ?? true,
    cacheSeconds: config.get<number>('cacheSeconds') ?? 300,
    geminiKey: config.get<string>('geminiKey') ?? '',
  };
}

export async function saveTokenSecurely(
  context: vscode.ExtensionContext,
  token: string
): Promise<void> {
  await context.secrets.store('metalens.token', token);
}

export async function getTokenSecurely(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.secrets.get('metalens.token');
}
