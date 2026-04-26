import * as vscode from 'vscode';
import { OpenMetadataClient } from './api/openmetadata';
import { AISdkClient } from './api/ai-sdk';
import { HoverProvider } from './providers/hover/HoverProvider';
import { CodeLensProvider } from './providers/codelens/CodeLensProvider';
import { DiagnosticsProvider } from './providers/diagnostics/DiagnosticsProvider';
import { QuickPickSearch } from './providers/search/QuickPick';
import { ChatPanel } from './panels/ChatPanel';
import { LineagePanel } from './panels/LineagePanel';
import { AssetDetailPanel } from './panels/AssetDetailPanel';
import { OnSaveHandler } from './onSave/OnSaveHandler';
import { StatusBarItem } from './statusBar/StatusBarItem';
import { MetadataCache } from './cache/MetadataCache';
import { getSettings, getTokenSecurely, saveTokenSecurely } from './config/settings';
import { log, logError } from './utils/logger';

const SUPPORTED_LANGS = ['sql', 'python', 'yaml', 'jinja-sql'];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log('MetaLens activating...');

  const settings = getSettings();

  // Try to get token from secure storage first
  const secureToken = await getTokenSecurely(context);
  if (secureToken) {
    settings.token = secureToken;
  }

  // Core dependencies
  const cache = new MetadataCache(settings.cacheSeconds);
  const omClient = new OpenMetadataClient(settings.host, settings.token, cache);
  const aiClient = new AISdkClient(settings.host, settings.token, omClient);

  // Status bar
  const statusBar = new StatusBarItem();
  context.subscriptions.push(statusBar);

  // Test connection
  if (settings.host && settings.token) {
    omClient.ping().then(ok => {
      statusBar.setConnected(ok);
      if (ok) {
        log('Connected to OpenMetadata successfully.');
      } else {
        log('Failed to connect to OpenMetadata.', 'warn');
      }
    }).catch(err => {
      statusBar.setConnected(false);
      logError('Connection test failed', err);
    });
  } else {
    statusBar.setConnected(false);
    // Show first-run message if no host configured
    if (!settings.host) {
      vscode.window.showWarningMessage(
        'MetaLens: No connection configured. Run "MetaLens: Configure Connection" to get started.',
        'Configure Now'
      ).then(action => {
        if (action === 'Configure Now') {
          void vscode.commands.executeCommand('metalens.configure');
        }
      });
    }
  }

  // Register hover providers
  const hoverProvider = new HoverProvider(omClient);
  for (const lang of SUPPORTED_LANGS) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider({ language: lang }, hoverProvider)
    );
  }

  // Register CodeLens providers
  const codeLensProvider = new CodeLensProvider(omClient);
  for (const lang of SUPPORTED_LANGS) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ language: lang }, codeLensProvider)
    );
  }

  // Diagnostics
  const diagCollection = vscode.languages.createDiagnosticCollection('metalens');
  context.subscriptions.push(diagCollection);
  const diagnosticsProvider = new DiagnosticsProvider(omClient, diagCollection);

  // On-save handler
  const onSaveHandler = new OnSaveHandler(omClient, diagnosticsProvider);
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      void onSaveHandler.handle(doc);
    })
  );

  // Refresh CodeLens on active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => codeLensProvider.refresh())
  );

  // ─── Commands ─────────────────────────────────────────────────────────────

  context.subscriptions.push(
    // Open Chat
    vscode.commands.registerCommand('metalens.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri, aiClient, omClient);
    }),

    // Search Assets
    vscode.commands.registerCommand('metalens.searchAssets', () => {
      void QuickPickSearch.show(omClient);
    }),

    // Show Lineage
    vscode.commands.registerCommand('metalens.showLineage', (fqn?: string) => {
      if (!fqn) {
        // Ask user for table FQN
        void vscode.window.showInputBox({
          prompt: 'Enter table FQN (e.g. service.database.schema.table)',
          placeHolder: 'ecommerce.warehouse.public.orders',
        }).then(input => {
          if (input) LineagePanel.createOrShow(context.extensionUri, omClient, input);
        });
        return;
      }
      LineagePanel.createOrShow(context.extensionUri, omClient, fqn);
    }),

    // Explain Query
    vscode.commands.registerCommand('metalens.explainQuery', (queryText?: string) => {
      const editor = vscode.window.activeTextEditor;
      const text = queryText
        ?? (editor ? editor.document.getText(editor.selection) || editor.document.getText() : '');

      if (!text) {
        void vscode.window.showWarningMessage('MetaLens: No query text to explain.');
        return;
      }

      ChatPanel.createOrShow(context.extensionUri, aiClient, omClient);
      // Small delay for panel to initialize, then send the message
      setTimeout(() => {
        void ChatPanel.currentPanel?.['panel']?.webview?.postMessage({
          type: 'autoQuery',
          text: `Please explain this SQL query and identify any potential issues:\n\n\`\`\`sql\n${text}\n\`\`\``,
        });
      }, 600);
    }),

    // Show Asset Detail
    vscode.commands.registerCommand('metalens.showAssetDetail', (fqn?: string) => {
      if (!fqn) {
        void vscode.window.showInputBox({
          prompt: 'Enter asset fully qualified name',
          placeHolder: 'service.database.schema.table',
        }).then(input => {
          if (input) AssetDetailPanel.createOrShow(context.extensionUri, omClient, input);
        });
        return;
      }
      AssetDetailPanel.createOrShow(context.extensionUri, omClient, fqn);
    }),

    // Check Data Quality
    vscode.commands.registerCommand('metalens.checkDataQuality', async (table?: string) => {
      if (!table) return;
      try {
        const found = await omClient.findTable(table);
        if (!found) {
          void vscode.window.showWarningMessage(`MetaLens: Table '${table}' not found in catalog.`);
          return;
        }
        const dq = await omClient.getDataQualityTests(found.id);
        const tests = dq?.data ?? [];
        if (tests.length === 0) {
          void vscode.window.showInformationMessage(`MetaLens: No data quality tests found for '${table}'.`);
          return;
        }
        const passed = tests.filter(t => t.testCaseResult?.testCaseStatus === 'Success').length;
        const failed = tests.filter(t => t.testCaseResult?.testCaseStatus === 'Failed').length;
        void vscode.window.showInformationMessage(
          `MetaLens: ${table} — ${passed} tests passed, ${failed} failed (${tests.length} total).`,
          'View Full Details'
        ).then(action => {
          if (action === 'View Full Details') {
            AssetDetailPanel.createOrShow(context.extensionUri, omClient, found.fullyQualifiedName);
          }
        });
      } catch (err) {
        logError('checkDataQuality command error', err);
      }
    }),

    // Add Description
    vscode.commands.registerCommand('metalens.addDescription', async (table?: string) => {
      if (!table) return;
      try {
        const found = await omClient.findTable(table);
        if (!found) {
          void vscode.window.showWarningMessage(`MetaLens: Table '${table}' not found.`);
          return;
        }
        const current = found.description ?? '';
        const newDesc = await vscode.window.showInputBox({
          prompt: `Enter description for '${table}'`,
          value: current,
          placeHolder: 'A clear description of this table...',
        });
        if (newDesc === undefined) return;
        await omClient.updateDescription('tables', found.id, newDesc);
        void vscode.window.showInformationMessage(`MetaLens: Description updated for '${table}'.`);
      } catch (err) {
        logError('addDescription error', err);
        void vscode.window.showErrorMessage(`MetaLens: Failed to update description: ${String(err)}`);
      }
    }),

    // Configure Connection
    vscode.commands.registerCommand('metalens.configure', async () => {
      const host = await vscode.window.showInputBox({
        title: 'MetaLens: Configure OpenMetadata Connection (1/3)',
        prompt: 'Enter your OpenMetadata or Collate host URL',
        placeHolder: 'https://your-org.getcollate.io',
        value: settings.host,
        ignoreFocusOut: true,
      });
      if (!host) return;

const token = await vscode.window.showInputBox({
    title: 'MetaLens: Configure OpenMetadata Connection (2/4)',
    prompt: 'Paste your Bot JWT token',
    placeHolder: 'eyJhbGci...',
    value: settings.token,
    password: true,
    ignoreFocusOut: true,
  });
      if (!token) return;

      const geminiKey = await vscode.window.showInputBox({
        title: 'MetaLens: Configure OpenMetadata Connection (3/4)',
        prompt: 'Paste your Google Gemini API Key (needed for AI Chat using v1.12+ MCP Tools)',
        placeHolder: 'AIza...',
        password: true,
        ignoreFocusOut: true,
      });
      if (!geminiKey) return;

      // Save host & gemini in settings, token in secure storage
      await vscode.workspace.getConfiguration('metalens').update('host', host, true);
      await vscode.workspace.getConfiguration('metalens').update('geminiKey', geminiKey, true);
      await saveTokenSecurely(context, token);

      // Test connection
      const testClient = new OpenMetadataClient(host, token, new MetadataCache(300));
      const ok = await testClient.ping();
      if (ok) {
    // Update global client singletons without needing a restart
    omClient.updateConfig(host, token);
    aiClient.updateConfig(host, token, omClient);

        void vscode.window.showInformationMessage('MetaLens: ✓ Connected to OpenMetadata successfully!');
        statusBar.setConnected(true);

        // Optionally set default agent
        const agents = await testClient.getAIAgents();
        if (agents.length > 0) {
          const chosen = await vscode.window.showQuickPick(
            agents.map(a => ({ label: a.displayName ?? a.name, value: a.name })),
            { placeHolder: 'Select default AI agent (3/3)', title: 'MetaLens: Choose Default Agent' }
          );
          if (chosen) {
            await vscode.workspace.getConfiguration('metalens').update('defaultAgent', chosen.value, true);
          }
        }
      } else {
        void vscode.window.showErrorMessage(
          'MetaLens: ✗ Could not connect. Check your host URL and token.',
          'Try Again'
        ).then(a => {
          if (a === 'Try Again') void vscode.commands.executeCommand('metalens.configure');
        });
      }
    }),

    // Clear Cache
    vscode.commands.registerCommand('metalens.clearCache', () => {
      cache.clear();
      void vscode.window.showInformationMessage('MetaLens: Metadata cache cleared.');
    })
  );

  log('MetaLens activated successfully.');
}

export function deactivate(): void {
  log('MetaLens deactivated.');
}
