# MetaLens — OpenMetadata Intelligence for VS Code

> **Hackathon:** WeMakeDevs × OpenMetadata "Back to the Metadata" (April 17–26, 2026)
> **Tagline:** *Your data catalog, right where you code.*

---

## 1. Vision & Positioning

AskCollate exists in the browser and in Slack/Teams. Developers, however, live in VS Code. Every time a data engineer, analytics engineer, or ML practitioner needs to understand a table schema, trace lineage, check a PII classification, or validate their SQL against real metadata — they break flow to open a browser tab.

**MetaLens** is a VS Code extension that brings the full OpenMetadata/Collate semantic layer into the IDE. It is not a "chatbot added to VS Code". It is a **context-aware metadata co-pilot** that understands what file you are editing, what tables you reference, and proactively surfaces the right metadata at the right moment — without you ever asking.

### Why this is not the GitHub issue #26650 pitch

The existing GitHub issue requests a basic AskCollate chat panel — essentially porting the web UI into a sidebar. MetaLens goes further in three dimensions:

| Dimension | Basic Port | MetaLens |
|---|---|---|
| Trigger | User opens panel and types | Automatic, file-save-aware, cursor-aware |
| Context | User provides context manually | Extension reads open file, detects table names, infers intent |
| Output | Chat response | Inline decorations, hovers, diagnostics, CodeLens, quick-fixes |

---

## 2. Core Features (Detailed)

### 2.1 MetaLens Chat Panel

A sidebar webview panel powered by the **OpenMetadata AI SDK** (`@openmetadata/ai-sdk`). Users can ask questions in natural language. The key differentiator: the chat is **pre-seeded with workspace context**.

- When you open Chat, it automatically injects:
  - The active file's detected table/column names
  - Active file language (SQL, Python, dbt YAML, etc.)
  - Glossary terms found in the current file
- Supports streaming responses (`client.agent().stream()`)
- Maintains multi-turn conversation history per workspace session
- Renders markdown, tables, and code blocks (Monaco-compatible renderer)
- Supports multiple configured agents from AI Studio (e.g., `DataQualityPlannerAgent`, `LineageAgent`, custom agents)

### 2.2 Intelligent On-Save Suggestions

When a file is saved, MetaLens scans it for **table and column identifiers** and queries OpenMetadata for relevant metadata. It then shows a non-intrusive notification or sidebar update:

- **SQL files**: Detect `FROM table_name`, `JOIN schema.table`, CTE names
- **Python files**: Detect SQLAlchemy model names, pandas `read_sql` table args, dbt ref() calls
- **dbt YAML/models**: Detect `ref()`, `source()`, model names
- **Jupyter Notebooks**: Detect SQL magic cells, pandas calls

For each detected asset, MetaLens can surface:
- Owner and domain
- Data quality test pass/fail status
- Last ingestion timestamp
- PII/classification tags on columns
- Deprecation notices
- Freshness SLA breach warnings

This is shown as a **VS Code diagnostic** (yellow/red squiggle) or as a **status bar quick-pick**.

### 2.3 Hover Cards (Inline Metadata)

Hovering over a detected table or column name in any supported file type shows a rich hover card:

```
📊  orders  (schema: ecommerce, db: warehouse)
Owner: data-team@company.com | Domain: Commerce
Last Updated: 2 hours ago | Tier: Tier 1

Columns (3 of 12 shown):
  order_id    BIGINT    PK  — Unique order identifier
  customer_id BIGINT    FK  — References customers.id  ⚠️ PII
  status      VARCHAR       — ['pending','shipped','delivered']

[Open in Collate ↗]  [Ask about this table]  [View Lineage]
```

### 2.4 CodeLens Actions

Above SQL queries, dbt model blocks, and Python table references, CodeLens buttons appear:

- `▶ Explain this query` — AI explains query logic using metadata context
- `🔍 View Lineage` — opens a lineage panel inside VS Code
- `⚠️ Check Data Quality` — runs a query against OpenMetadata's test results
- `📝 Add Description` — lets you write/update the table or column description from the IDE and push it back to OpenMetadata via API

### 2.5 Lineage Visualization Panel

A webview panel (D3.js-based SVG diagram) that renders upstream/downstream lineage of any selected table. Fetches lineage via the OpenMetadata REST API (`GET /api/v1/lineage/table/{fqn}`).

- Clickable nodes (click to jump to that table's metadata)
- Color-coded by asset type (table, pipeline, dashboard, topic)
- Collapsible upstream/downstream depth control
- Export as PNG

### 2.6 Metadata Quick Search (Command Palette Integration)

`Ctrl+Shift+P` → `MetaLens: Search Assets` opens a VS Code quick-pick with live semantic search powered by OpenMetadata's search API. Results show:

- Asset type icon
- Fully qualified name
- Owner
- Description preview

Selecting an asset either opens its detail panel or inserts its FQN into the editor.

### 2.7 PII & Classification Diagnostics

When a SQL file is saved, MetaLens fetches classification tags for all detected columns. If a query touches PII columns without expected filters (e.g., no `WHERE user_id = ?`), it raises a VS Code **diagnostic warning**:

```
⚠️  Column 'email' is tagged PII_SENSITIVE in OpenMetadata.
    Ensure access is authorized and data is handled per policy.
    [Learn more in Collate] [Dismiss]
```

### 2.8 Push-Back to Catalog (Write Support)

Using the OpenMetadata REST API, users can update the catalog from within VS Code:

- Edit table/column descriptions inline and push back
- Add glossary terms to assets
- Vote on data assets (thumbs up/down)
- Create data quality issues

All write operations are authenticated via the same JWT token used for reads.

### 2.9 Git-Aware Metadata Diff (Bonus / Stretch)

When a dbt model file is committed (via VS Code's Git integration), MetaLens can:

- Detect which tables' schemas might be impacted
- Fetch those tables' lineage downstream assets
- Warn: "Changing this model may affect 3 downstream dashboards"

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Extension host | TypeScript + VS Code Extension API | Native VS Code, full API access |
| AI / NLP | `@openmetadata/ai-sdk` (Node.js) | Official SDK, streaming support, agent invocation |
| OpenMetadata REST | Fetch API + OpenMetadata Python client (optional) | Table metadata, lineage, search |
| Webview UI (Chat + Lineage) | React 18 + Tailwind CSS | Component reuse, fast iteration |
| Lineage Graph | D3.js | Flexible SVG-based graph rendering |
| SQL Parsing | `node-sql-parser` | Extract table/column references from SQL |
| Python AST (optional) | `tree-sitter` WASM | Parse Python files for table references |
| Bundler | esbuild | Fast, VS Code-compatible bundling |
| Test | Vitest + `@vscode/test-electron` | Unit + integration tests |
| CI | GitHub Actions | Lint, test, package |

---

## 4. File & Folder Structure

```
metalens/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + test on every push
│       └── release.yml             # Package .vsix on tag
│
├── .vscode/
│   ├── launch.json                 # Extension debug config
│   └── tasks.json                  # Build tasks
│
├── src/
│   ├── extension.ts                # Entry point — activate/deactivate
│   │
│   ├── config/
│   │   └── settings.ts             # Typed wrapper around VS Code workspace config
│   │
│   ├── api/
│   │   ├── openmetadata.ts         # REST client: search, lineage, entity fetch, patch
│   │   ├── ai-sdk.ts               # @openmetadata/ai-sdk wrapper — agent calls, streaming
│   │   └── types.ts                # Shared TypeScript interfaces for OM API responses
│   │
│   ├── providers/
│   │   ├── hover/
│   │   │   ├── HoverProvider.ts    # vscode.HoverProvider impl — SQL, Python, YAML
│   │   │   └── HoverCard.ts        # Markdown hover card builder
│   │   │
│   │   ├── codelens/
│   │   │   ├── CodeLensProvider.ts # vscode.CodeLensProvider impl
│   │   │   └── commands.ts         # CodeLens command handlers
│   │   │
│   │   ├── diagnostics/
│   │   │   ├── DiagnosticsProvider.ts  # On-save diagnostic runner
│   │   │   ├── PIIChecker.ts           # Flags PII columns in query
│   │   │   └── FreshnessChecker.ts     # Flags stale/broken assets
│   │   │
│   │   ├── completion/
│   │   │   └── CompletionProvider.ts   # (stretch) Table/column autocomplete
│   │   │
│   │   └── search/
│   │       └── QuickPick.ts        # Command palette asset search
│   │
│   ├── parsers/
│   │   ├── sql.ts                  # SQL table/column extractor (node-sql-parser)
│   │   ├── python.ts               # Python AST table extractor (tree-sitter WASM)
│   │   ├── dbt.ts                  # dbt model YAML / Jinja ref() extractor
│   │   └── notebook.ts             # Jupyter notebook SQL cell extractor
│   │
│   ├── panels/
│   │   ├── ChatPanel.ts            # Webview panel host for Chat UI
│   │   ├── LineagePanel.ts         # Webview panel host for Lineage UI
│   │   └── AssetDetailPanel.ts     # Webview panel host for Asset detail view
│   │
│   ├── cache/
│   │   └── MetadataCache.ts        # In-memory LRU cache for OM API responses (5 min TTL)
│   │
│   ├── onSave/
│   │   └── OnSaveHandler.ts        # Registers onDidSaveTextDocument, orchestrates suggestions
│   │
│   ├── statusBar/
│   │   └── StatusBarItem.ts        # Bottom status bar — connection indicator
│   │
│   └── utils/
│       ├── logger.ts               # VS Code output channel logger
│       ├── fqn.ts                  # FQN parsing and construction helpers
│       └── notify.ts               # Wrapper for VS Code notifications
│
├── webview-ui/
│   ├── chat/
│   │   ├── index.html              # Chat panel HTML shell
│   │   ├── App.tsx                 # Root React component — Chat UI
│   │   ├── components/
│   │   │   ├── ChatInput.tsx       # Message input with context badges
│   │   │   ├── ChatMessage.tsx     # Streamed message renderer (markdown)
│   │   │   ├── ContextBadge.tsx    # Shows detected tables pre-seeded as context
│   │   │   ├── AgentSelector.tsx   # Dropdown to pick AI Studio agent
│   │   │   └── ActionChips.tsx     # Quick action buttons (View Lineage, etc.)
│   │   ├── hooks/
│   │   │   ├── useChat.ts          # Chat state, streaming, history management
│   │   │   └── useVSCode.ts        # VS Code webview message bridge hook
│   │   └── styles/
│   │       └── chat.css            # Tailwind + custom tokens matching VS Code theme
│   │
│   ├── lineage/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── LineageGraph.tsx     # D3 SVG graph — nodes, edges, zoom/pan
│   │   │   ├── NodeCard.tsx         # Node tooltip on hover
│   │   │   └── DepthControl.tsx     # Upstream/downstream depth slider
│   │   └── hooks/
│   │       └── useLineage.ts        # Fetch lineage data, build D3 graph state
│   │
│   └── asset-detail/
│       ├── index.html
│       ├── App.tsx
│       └── components/
│           ├── AssetHeader.tsx      # Name, type, owner, tags
│           ├── ColumnTable.tsx      # Column list with types, tags, descriptions
│           ├── QualityBadges.tsx    # Data quality test results
│           ├── DescriptionEditor.tsx # Editable description — push back to catalog
│           └── GlossaryTerms.tsx    # Linked business glossary terms
│
├── test/
│   ├── unit/
│   │   ├── parsers/
│   │   │   ├── sql.test.ts
│   │   │   ├── python.test.ts
│   │   │   └── dbt.test.ts
│   │   ├── api/
│   │   │   └── openmetadata.test.ts
│   │   └── cache/
│   │       └── MetadataCache.test.ts
│   │
│   └── integration/
│       └── extension.test.ts       # @vscode/test-electron integration tests
│
├── media/
│   ├── icon.png                    # Extension icon (128x128)
│   └── demo.gif                    # Demo GIF for README
│
├── scripts/
│   └── build-webview.mjs           # esbuild script for webview bundles
│
├── package.json                    # Extension manifest + dependencies
├── tsconfig.json                   # TypeScript config for extension host
├── tsconfig.webview.json           # TypeScript config for webview (React)
├── esbuild.mjs                     # esbuild bundler config for extension host
├── .eslintrc.json
├── .prettierrc
├── .vscodeignore                   # Exclude src, node_modules from .vsix
├── CHANGELOG.md
├── README.md
└── LICENSE
```

---

## 5. VS Code Extension Manifest (`package.json`) — Key Fields

```json
{
  "name": "metalens",
  "displayName": "MetaLens — OpenMetadata for VS Code",
  "description": "Bring your OpenMetadata/Collate data catalog into VS Code with inline metadata, AI chat, lineage visualization, and PII diagnostics.",
  "version": "0.1.0",
  "publisher": "metalens",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Data Science", "Other"],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "configuration": {
      "title": "MetaLens",
      "properties": {
        "metalens.host": {
          "type": "string",
          "description": "OpenMetadata or Collate server URL (e.g. https://your-org.getcollate.io)"
        },
        "metalens.token": {
          "type": "string",
          "description": "Bot JWT token for authentication"
        },
        "metalens.defaultAgent": {
          "type": "string",
          "default": "AskCollateAgent",
          "description": "Default AI Studio agent name to use in Chat"
        },
        "metalens.onSaveSuggestions": {
          "type": "boolean",
          "default": true,
          "description": "Show metadata suggestions when a file is saved"
        },
        "metalens.piiDiagnostics": {
          "type": "boolean",
          "default": true,
          "description": "Show diagnostic warnings for PII-tagged columns"
        },
        "metalens.cacheSeconds": {
          "type": "number",
          "default": 300,
          "description": "Metadata cache TTL in seconds"
        }
      }
    },
    "commands": [
      { "command": "metalens.openChat", "title": "MetaLens: Open AI Chat" },
      { "command": "metalens.searchAssets", "title": "MetaLens: Search Data Assets" },
      { "command": "metalens.showLineage", "title": "MetaLens: Show Lineage for Table" },
      { "command": "metalens.explainQuery", "title": "MetaLens: Explain Selected Query" },
      { "command": "metalens.showAssetDetail", "title": "MetaLens: Show Asset Details" },
      { "command": "metalens.configure", "title": "MetaLens: Configure Connection" },
      { "command": "metalens.clearCache", "title": "MetaLens: Clear Metadata Cache" }
    ],
    "viewsContainers": {
      "activitybar": [{
        "id": "metalens-sidebar",
        "title": "MetaLens",
        "icon": "media/icon.svg"
      }]
    },
    "views": {
      "metalens-sidebar": [
        { "type": "webview", "id": "metalens.chatView", "name": "AI Chat" },
        { "id": "metalens.assetsView", "name": "Detected Assets" }
      ]
    },
    "menus": {
      "editor/context": [
        { "command": "metalens.explainQuery", "when": "editorHasSelection", "group": "metalens" },
        { "command": "metalens.showLineage", "group": "metalens" }
      ]
    }
  },
  "dependencies": {
    "@openmetadata/ai-sdk": "^1.12.0",
    "node-sql-parser": "^4.18.0",
    "web-tree-sitter": "^0.22.0",
    "d3": "^7.9.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/d3": "^7.4.0",
    "@vscode/test-electron": "^2.3.0",
    "esbuild": "^0.21.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "build:webview": "node scripts/build-webview.mjs",
    "watch": "node esbuild.mjs --watch",
    "package": "vsce package",
    "test": "vitest run",
    "test:integration": "node ./test/integration/runTests.js",
    "lint": "eslint src --ext ts"
  }
}
```

---

## 6. Core Implementation Details

### 6.1 Extension Entry Point (`src/extension.ts`)

```typescript
import * as vscode from 'vscode';
import { OpenMetadataClient } from './api/openmetadata';
import { AISdkClient } from './api/ai-sdk';
import { HoverProvider } from './providers/hover/HoverProvider';
import { CodeLensProvider } from './providers/codelens/CodeLensProvider';
import { DiagnosticsProvider } from './providers/diagnostics/DiagnosticsProvider';
import { QuickPickSearch } from './providers/search/QuickPick';
import { ChatPanel } from './panels/ChatPanel';
import { LineagePanel } from './panels/LineagePanel';
import { OnSaveHandler } from './onSave/OnSaveHandler';
import { StatusBarItem } from './statusBar/StatusBarItem';
import { MetadataCache } from './cache/MetadataCache';
import { getSettings } from './config/settings';

export async function activate(context: vscode.ExtensionContext) {
  const settings = getSettings();
  
  if (!settings.host || !settings.token) {
    vscode.window.showWarningMessage(
      'MetaLens: No connection configured. Run "MetaLens: Configure Connection".',
      'Configure'
    ).then(action => {
      if (action === 'Configure') {
        vscode.commands.executeCommand('metalens.configure');
      }
    });
  }

  const cache = new MetadataCache(settings.cacheSeconds);
  const omClient = new OpenMetadataClient(settings.host, settings.token, cache);
  const aiClient = new AISdkClient(settings.host, settings.token);

  const statusBar = new StatusBarItem();
  context.subscriptions.push(statusBar);

  // Test connection
  omClient.ping().then(ok => statusBar.setConnected(ok));

  // Register Hover Providers for all supported languages
  const SUPPORTED_LANGS = ['sql', 'python', 'yaml', 'jinja-sql'];
  const hoverProvider = new HoverProvider(omClient);
  SUPPORTED_LANGS.forEach(lang => {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(lang, hoverProvider)
    );
  });

  // Register CodeLens
  const codeLensProvider = new CodeLensProvider(omClient);
  SUPPORTED_LANGS.forEach(lang => {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(lang, codeLensProvider)
    );
  });

  // Diagnostics
  const diagCollection = vscode.languages.createDiagnosticCollection('metalens');
  context.subscriptions.push(diagCollection);
  const diagnosticsProvider = new DiagnosticsProvider(omClient, diagCollection);

  // On-save handler
  const onSaveHandler = new OnSaveHandler(omClient, diagnosticsProvider);
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => onSaveHandler.handle(doc))
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('metalens.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri, aiClient, omClient);
    }),
    vscode.commands.registerCommand('metalens.searchAssets', () => {
      QuickPickSearch.show(omClient);
    }),
    vscode.commands.registerCommand('metalens.showLineage', (fqn?: string) => {
      LineagePanel.createOrShow(context.extensionUri, omClient, fqn);
    }),
    vscode.commands.registerCommand('metalens.clearCache', () => {
      cache.clear();
      vscode.window.showInformationMessage('MetaLens: Metadata cache cleared.');
    })
  );
}

export function deactivate() {}
```

### 6.2 OpenMetadata REST Client (`src/api/openmetadata.ts`)

```typescript
import { MetadataCache } from '../cache/MetadataCache';

export class OpenMetadataClient {
  constructor(
    private host: string,
    private token: string,
    private cache: MetadataCache
  ) {}

  private async fetch<T>(path: string): Promise<T> {
    const cacheKey = path;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${this.host}/api/v1${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`OM API ${res.status}: ${path}`);
    const data = await res.json() as T;
    this.cache.set(cacheKey, data);
    return data;
  }

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.host}/api/v1/system/config`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return true;
    } catch { return false; }
  }

  async searchAssets(query: string, limit = 10) {
    return this.fetch(`/search/query?q=${encodeURIComponent(query)}&index=dataAsset&from=0&size=${limit}`);
  }

  async getTableByFQN(fqn: string) {
    return this.fetch(`/tables/name/${encodeURIComponent(fqn)}?fields=columns,tags,owner,followers,dataModel`);
  }

  async getLineage(fqn: string, entityType = 'table', upstreamDepth = 2, downstreamDepth = 2) {
    return this.fetch(`/lineage/${entityType}/name/${encodeURIComponent(fqn)}?upstreamDepth=${upstreamDepth}&downstreamDepth=${downstreamDepth}`);
  }

  async getDataQualityTests(tableId: string) {
    return this.fetch(`/dataQuality/testCases?entityLink=<#E::table::${tableId}>&limit=50`);
  }

  async updateDescription(entityType: string, id: string, description: string) {
    const res = await fetch(`${this.host}/api/v1/${entityType}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify([{ op: 'add', path: '/description', value: description }]),
    });
    if (!res.ok) throw new Error(`Failed to update description: ${res.status}`);
    return res.json();
  }
}
```

### 6.3 AI SDK Client (`src/api/ai-sdk.ts`)

```typescript
import { AISdk } from '@openmetadata/ai-sdk';

export class AISdkClient {
  private sdk: AISdk;

  constructor(host: string, token: string) {
    this.sdk = new AISdk({ host, token });
  }

  async *streamResponse(agentName: string, prompt: string): AsyncGenerator<string> {
    for await (const event of this.sdk.agent(agentName).stream(prompt)) {
      if (event.type === 'content' && event.content) {
        yield event.content;
      }
    }
  }

  async ask(agentName: string, prompt: string): Promise<string> {
    const response = await this.sdk.agent(agentName).call(prompt);
    return response.response;
  }
}
```

### 6.4 SQL Parser (`src/parsers/sql.ts`)

```typescript
import { Parser } from 'node-sql-parser';

const parser = new Parser();

export interface ExtractedAsset {
  table: string;
  schema?: string;
  database?: string;
  columns: string[];
  range?: { line: number; character: number; length: number };
}

export function extractAssetsFromSQL(sql: string): ExtractedAsset[] {
  try {
    const ast = parser.astify(sql);
    const assets: ExtractedAsset[] = [];
    traverseAST(ast, assets);
    return assets;
  } catch {
    // Fallback: regex-based extraction for partial/invalid SQL
    return extractByRegex(sql);
  }
}

function extractByRegex(sql: string): ExtractedAsset[] {
  const tableRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][\w.]*)/gi;
  const assets: ExtractedAsset[] = [];
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const parts = match[1].split('.');
    assets.push({
      table: parts[parts.length - 1],
      schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
      database: parts.length >= 3 ? parts[parts.length - 3] : undefined,
      columns: [],
    });
  }
  return assets;
}

function traverseAST(node: any, assets: ExtractedAsset[]): void {
  // Recursively walk AST to collect table references
  if (!node || typeof node !== 'object') return;
  if (node.type === 'select' && node.from) {
    for (const ref of node.from) {
      if (ref.table) {
        assets.push({
          table: ref.table,
          schema: ref.db ?? undefined,
          columns: extractColumns(node.columns),
        });
      }
    }
  }
  Object.values(node).forEach(child => {
    if (Array.isArray(child)) child.forEach(c => traverseAST(c, assets));
    else traverseAST(child, assets);
  });
}

function extractColumns(cols: any[]): string[] {
  if (!cols) return [];
  return cols
    .filter(c => c?.expr?.type === 'column_ref')
    .map(c => c.expr.column)
    .filter(Boolean);
}
```

### 6.5 On-Save Handler (`src/onSave/OnSaveHandler.ts`)

```typescript
import * as vscode from 'vscode';
import { OpenMetadataClient } from '../api/openmetadata';
import { DiagnosticsProvider } from '../providers/diagnostics/DiagnosticsProvider';
import { extractAssetsFromSQL } from '../parsers/sql';
import { extractAssetsFromPython } from '../parsers/python';
import { getSettings } from '../config/settings';

const SUPPORTED = new Set(['sql', 'python', 'yaml']);

export class OnSaveHandler {
  constructor(
    private omClient: OpenMetadataClient,
    private diagnostics: DiagnosticsProvider
  ) {}

  async handle(doc: vscode.TextDocument): Promise<void> {
    const lang = doc.languageId;
    if (!SUPPORTED.has(lang)) return;
    if (!getSettings().onSaveSuggestions) return;

    const text = doc.getText();
    let assets = lang === 'sql' ? extractAssetsFromSQL(text)
               : lang === 'python' ? extractAssetsFromPython(text)
               : [];

    if (assets.length === 0) return;

    // Run diagnostics (PII, freshness)
    await this.diagnostics.run(doc, assets);

    // Show a subtle notification for significant findings
    const uniqueTables = [...new Set(assets.map(a => a.table))];
    if (uniqueTables.length > 0) {
      const msg = `MetaLens detected ${uniqueTables.length} table(s). Hover for metadata.`;
      vscode.window.setStatusBarMessage(`$(database) ${msg}`, 4000);
    }
  }
}
```

### 6.6 Chat Panel (`src/panels/ChatPanel.ts`)

```typescript
import * as vscode from 'vscode';
import { AISdkClient } from '../api/ai-sdk';
import { OpenMetadataClient } from '../api/openmetadata';
import { extractAssetsFromSQL } from '../parsers/sql';
import { getSettings } from '../config/settings';
import * as fs from 'fs';
import * as path from 'path';

export class ChatPanel {
  static currentPanel: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static createOrShow(uri: vscode.Uri, ai: AISdkClient, om: OpenMetadataClient) {
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'metalens.chat', 'MetaLens Chat',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [uri] }
    );
    ChatPanel.currentPanel = new ChatPanel(panel, uri, ai, om);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private ai: AISdkClient,
    private om: OpenMetadataClient
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(extensionUri);
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    this.panel.onDidDispose(() => { ChatPanel.currentPanel = undefined; });

    // Pre-seed context from active editor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'sql') {
      const assets = extractAssetsFromSQL(editor.document.getText());
      if (assets.length > 0) {
        this.panel.webview.postMessage({
          type: 'seedContext',
          tables: assets.map(a => a.table),
        });
      }
    }
  }

  private async handleMessage(msg: any) {
    if (msg.type === 'sendMessage') {
      const { text, agentName, context } = msg;
      const prompt = context?.length
        ? `User is working with these tables: ${context.join(', ')}.\n\n${text}`
        : text;

      this.panel.webview.postMessage({ type: 'startStream' });
      try {
        for await (const chunk of this.ai.streamResponse(agentName ?? getSettings().defaultAgent, prompt)) {
          this.panel.webview.postMessage({ type: 'chunk', content: chunk });
        }
      } catch (e: any) {
        this.panel.webview.postMessage({ type: 'error', message: e.message });
      }
      this.panel.webview.postMessage({ type: 'endStream' });
    }

    if (msg.type === 'searchAssets') {
      const results = await this.om.searchAssets(msg.query);
      this.panel.webview.postMessage({ type: 'searchResults', results });
    }
  }

  private getHtml(extensionUri: vscode.Uri): string {
    // Load compiled React bundle from webview-ui/chat/dist/
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'chat.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${this.panel.webview.cspSource}; style-src ${this.panel.webview.cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetaLens Chat</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

---

## 7. OpenMetadata API Endpoints Used

| Feature | Method | Endpoint |
|---|---|---|
| Connection test | GET | `/api/v1/system/config` |
| Search assets | GET | `/api/v1/search/query?q={query}&index=dataAsset` |
| Get table by FQN | GET | `/api/v1/tables/name/{fqn}?fields=columns,tags,owner` |
| Get lineage | GET | `/api/v1/lineage/table/name/{fqn}?upstreamDepth=2&downstreamDepth=2` |
| Get DQ tests | GET | `/api/v1/dataQuality/testCases?entityLink=...` |
| Get glossary terms | GET | `/api/v1/glossaryTerms?glossary={name}&limit=100` |
| Update description | PATCH | `/api/v1/tables/{id}` (JSON Patch) |
| List AI agents | GET | `/api/v1/apps?limit=50` (filter by type) |

### AI SDK Usage

```typescript
// Direct agent invocation (non-streaming)
const response = await client.agent('AskCollateAgent').call(prompt);

// Streaming (used in Chat Panel)
for await (const event of client.agent('AskCollateAgent').stream(prompt)) {
  if (event.type === 'content') process(event.content);
}
```

---

## 8. Data Flow Diagrams

### 8.1 On-Save Flow

```
User saves .sql file
        │
        ▼
OnSaveHandler.handle(doc)
        │
        ├─► SQLParser.extractAssets(text)
        │         │
        │         └─► [{ table: 'orders', columns: ['email', 'user_id'] }]
        │
        ├─► OpenMetadataClient.getTableByFQN(fqn) ◄── MetadataCache (5min TTL)
        │         │
        │         └─► { tags: [PII_SENSITIVE on email], owner, lastUpdated }
        │
        ├─► DiagnosticsProvider.run()
        │         │
        │         ├─► PIIChecker → vscode.Diagnostic (Warning) on line with 'email'
        │         └─► FreshnessChecker → vscode.Diagnostic (Info) if stale
        │
        └─► StatusBar: "MetaLens: 2 tables detected. Hover for metadata."
```

### 8.2 Chat Flow

```
User types message in Chat Panel (webview)
        │
        ▼
WebviewPanel.postMessage({ type: 'sendMessage', text, agentName, context })
        │
        ▼
ChatPanel.handleMessage()
        │
        ├─► Build prompt with injected workspace context (detected tables)
        │
        ├─► AISdkClient.streamResponse(agentName, prompt)
        │         │
        │         └─► @openmetadata/ai-sdk → Collate AI Studio Agent
        │                   │
        │                   └─► OpenMetadata knowledge graph
        │                         (glossary, lineage, DQ, catalog)
        │
        └─► postMessage({ type: 'chunk', content }) → React UI renders incrementally
```

---

## 9. Configuration & Authentication

MetaLens uses VS Code's `SecretStorage` API to store the JWT token securely (not in `settings.json`).

```typescript
// Store token securely
await context.secrets.store('metalens.token', token);

// Retrieve
const token = await context.secrets.get('metalens.token');
```

The host URL is stored in regular workspace/user settings.

A **first-run wizard** (`metalens.configure` command) walks users through:
1. Entering their Collate/OpenMetadata host URL
2. Pasting their bot JWT token
3. Testing the connection
4. Selecting a default agent from available AI Studio agents

---

## 10. Webview UI — Chat Panel React App

The Chat webview follows VS Code's recommended React + message-passing pattern.

### Communication Bridge

```typescript
// In webview (React side)
const vscode = acquireVsCodeApi();

// Send to extension host
vscode.postMessage({ type: 'sendMessage', text: input, agentName, context: detectedTables });

// Receive from extension host
window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'chunk') appendChunk(msg.content);
  if (msg.type === 'seedContext') setDetectedTables(msg.tables);
  if (msg.type === 'endStream') setStreaming(false);
});
```

### Chat UI Features

- **Context badges**: Small chips at the top showing pre-detected table names
- **Agent selector**: Dropdown populated dynamically from available AI Studio agents
- **Streaming render**: Uses `useState` to accumulate streamed chunks; renders markdown via `marked.js`
- **Action chips**: "View Lineage", "Open in Collate", "Check Quality" appear after relevant responses
- **VS Code theme tokens**: Uses `--vscode-editor-background`, `--vscode-foreground` CSS vars for seamless theming

---

## 11. Testing Strategy

### Unit Tests (Vitest)

- `parsers/sql.test.ts`: Test extraction of tables/columns from 20+ SQL patterns (CTEs, subqueries, multiple JOINs, aliased schemas)
- `parsers/python.test.ts`: Test pandas, SQLAlchemy, dbt ref detection
- `api/openmetadata.test.ts`: Mock fetch, test cache hits/misses, test error handling
- `cache/MetadataCache.test.ts`: TTL expiry, eviction, concurrent access

### Integration Tests (`@vscode/test-electron`)

- Open a workspace with test .sql files
- Trigger on-save and assert diagnostics are created
- Verify hover card appears over table name
- Verify CodeLens buttons appear above SELECT queries

### Manual Demo Script (for hackathon demo)

1. Open `demo/queries/revenue_report.sql` (included in repo)
2. Save — show on-save status bar message
3. Hover over `orders` table — show hover card
4. Click CodeLens "Show Lineage" — show lineage panel
5. Open Chat — show pre-seeded context badges
6. Ask: "Are there any quality issues with the orders table?"
7. Show streamed AI response with DQ test results

---

## 12. Repository Setup Steps

```bash
# 1. Clone and install
git clone https://github.com/your-handle/metalens
cd metalens
npm install

# 2. Install webview deps
cd webview-ui && npm install && cd ..

# 3. Build extension host
npm run build

# 4. Build webview bundles
npm run build:webview

# 5. Launch VS Code Extension Development Host
# Press F5 in VS Code with this repo open

# 6. Run unit tests
npm test

# 7. Package .vsix
npm run package
```

---

## 13. Environment Variables / `.env` for Development

```env
# Used in integration tests only — never shipped
OM_HOST=https://sandbox.getcollate.io
OM_TOKEN=eyJhbGci...
OM_AGENT=AskCollateAgent
```

---

## 14. Differentiators vs. GitHub Issue #26650

| Aspect | Issue #26650 (basic chat panel) | MetaLens |
|---|---|---|
| **Trigger model** | Pull (user opens, asks) | Push + pull (extension proactively acts on context) |
| **File awareness** | None | Reads active file, detects tables automatically |
| **Hover cards** | Not mentioned | Inline rich hover for every table/column reference |
| **Diagnostics** | Not mentioned | PII warnings, freshness alerts as VS Code diagnostics |
| **CodeLens** | Not mentioned | Explain Query, Show Lineage, Check Quality above queries |
| **Lineage panel** | Not mentioned | Full interactive D3 lineage graph inside VS Code |
| **Write-back** | Not mentioned | Edit descriptions, add glossary terms from IDE |
| **Agent selection** | Single (AskCollate) | Multi-agent — choose any AI Studio agent |
| **Context injection** | Manual | Automatic from editor file |

---

## 15. Stretch Goals (Post-Hackathon)

- **Column-level autocomplete**: As you type SQL, suggest table/column names from the catalog
- **Git pre-commit hook**: Warn on schema-impacting changes before commit
- **dbt integration**: Auto-populate dbt model descriptions from OpenMetadata on pull
- **Jupyter Notebook support**: Metadata hover in `%%sql` cells
- **Multi-workspace**: Support multiple OpenMetadata instances per workspace
- **Collate Free Tier onboarding**: In-extension wizard to sign up for free tier

---

## 16. Submission Checklist

- [ ] `README.md` with demo GIF, setup instructions, feature overview
- [ ] `CHANGELOG.md`
- [ ] Working `.vsix` file generated
- [ ] Public GitHub repository with MIT license
- [ ] Demo video (2–5 min): file save → hover → chat → lineage
- [ ] OpenMetadata AI SDK used (required by hackathon)
- [ ] At least one AI Studio agent invoked
- [ ] Write-back to catalog (bonus points: bidirectional integration)
