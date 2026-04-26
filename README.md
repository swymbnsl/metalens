# MetaLens — OpenMetadata Intelligence for VS Code

> **Hackathon:** WeMakeDevs × OpenMetadata "Back to the Metadata" (April 17–26, 2026)  
> **Tagline:** *Your data catalog, right where you code.*

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visualstudiocode)](https://github.com/swymbnsl/metalens)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

MetaLens is a **context-aware metadata co-pilot** that brings the full OpenMetadata/Collate semantic layer directly into VS Code. It understands what file you're editing, automatically detects table references, and proactively surfaces rich metadata right where you code — without ever switching to a browser tab.

---

## ✨ Features

### 🗂️ Inline Hover Cards
Hover over any table or column name in SQL, Python, dbt YAML, or Jinja-SQL files to instantly see:
- Schema, database, owner, and domain
- PII-tagged columns (highlighted with ⚠️)
- Data freshness (last updated timestamp)
- Tier classification and tags
- Quick-action links: Open in Collate, View Lineage, Ask AI

### 🤖 AI Chat Panel (OpenMetadata AI SDK)
Pre-seeded with your workspace context — opens with detected table names already loaded as context badges:
- Powered by the **OpenMetadata AI SDK** with streaming responses
- Choose any AI Studio agent (AskCollateAgent, DataQualityPlannerAgent, LineageAgent, etc.)
- Auto-injects active file's table names as context
- Action chips after each response: View Lineage, Asset Detail

### 🔗 Interactive Lineage Visualization
D3-powered SVG lineage graph inside VS Code:
- Upstream/downstream traversal with configurable depth (1–5 levels)
- Color-coded by asset type (table, pipeline, dashboard, topic, ML model)
- Zoom/pan with mouse wheel and drag
- Click any node to open its Asset Detail panel

### 🔍 CodeLens Actions
Above every SQL query and table reference:
- `▶ Explain this query` — AI explains query logic using metadata context
- `🔍 Lineage: {table}` — jumps straight to lineage view
- `⚠️ Data Quality` — shows DQ test pass/fail results
- `📝 Add Description` — edit table description and push back to catalog

### 🩺 On-Save Diagnostics
When saving SQL, Python, or dbt YAML files:
- **PII warnings** (`metalens.pii`): Flags columns tagged PII_SENSITIVE/PII_NONSENSITIVE with yellow squiggles
- **Freshness alerts** (`metalens.freshness`): Info-level diagnostics when tables haven't been updated in 7+ days
- Status bar flash: `$(database) MetaLens: N table(s) detected. Hover for metadata.`

### 📦 Asset Detail Panel
Rich read/write panel for any catalog asset:
- Full column table with types, tags, and descriptions
- Editable description with push-back to OpenMetadata via JSON Patch API
- Data quality test results (pass/fail counts)
- Vote on assets (👍 / 👎)
- "Open in Collate" button

### 🔎 Metadata Quick Search
`Ctrl+Shift+Alt+M` → live semantic search across all data assets:
- Results show entity type icon, FQN, owner, description preview
- Actions: View Details, Show Lineage, or Insert FQN into editor

### 🔒 Secure Configuration
- JWT token stored in VS Code **SecretStorage** (not plaintext settings)
- First-run wizard: `MetaLens: Configure Connection` walks you through host, token, and agent selection

---

## 🚀 Quick Start

### 1. Install the Extension

**From `.vsix` file (Hackathon Demo):**
```bash
code --install-extension metalens-0.1.0.vsix
```

**From source:**
```bash
git clone https://github.com/swymbnsl/metalens.git
cd metalens
npm install
npm run build:all
# Press F5 in VS Code to launch Extension Development Host
```

### 2. Configure Connection

Open the Command Palette (`Ctrl+Shift+P`) and run:
```
MetaLens: Configure Connection
```

Enter:
1. Your OpenMetadata or Collate host URL (e.g., `https://your-org.getcollate.io`)
2. Your Bot JWT token (stored securely)
3. Select a default AI agent

### 3. Start Using MetaLens

Open any `.sql`, `.py`, or dbt YAML file. MetaLens will:
- Show metadata hover cards when you hover table names
- Display CodeLens actions above queries
- Run PII/freshness diagnostics on save
- Pre-seed the AI Chat with detected table context

---

## ⌨️ Commands & Keybindings

| Command | Description | Keybinding |
|---------|-------------|-----------|
| `MetaLens: Open AI Chat` | Open the AI Chat panel | `Ctrl+Shift+M` |
| `MetaLens: Search Data Assets` | Live semantic search | `Ctrl+Shift+Alt+M` |
| `MetaLens: Show Lineage for Table` | Open lineage visualization | — |
| `MetaLens: Explain Selected Query` | AI query explanation | Right-click menu |
| `MetaLens: Show Asset Details` | Open asset detail panel | — |
| `MetaLens: Configure Connection` | Setup wizard | — |
| `MetaLens: Clear Metadata Cache` | Clear 5-min metadata cache | — |
| `MetaLens: Check Data Quality` | Show DQ test results | — |
| `MetaLens: Add/Edit Description` | Edit and push back description | — |

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `metalens.host` | `""` | OpenMetadata/Collate host URL |
| `metalens.token` | `""` | Legacy plaintext token (use SecretStorage via wizard instead) |
| `metalens.defaultAgent` | `"AskCollateAgent"` | Default AI Studio agent |
| `metalens.onSaveSuggestions` | `true` | Enable on-save metadata detection |
| `metalens.piiDiagnostics` | `true` | Enable PII diagnostic warnings |
| `metalens.cacheSeconds` | `300` | Metadata cache TTL in seconds |

---

## 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Build extension host
npm run build

# Build webview bundles (React + D3)
npm run build:webview

# Build both
npm run build:all

# Watch mode (extension)
npm run watch

# Run unit tests
npm test

# Package .vsix
npm run package
```

### Project Structure

```
metalens/
├── src/
│   ├── extension.ts          # Entry point — activate/deactivate
│   ├── api/                  # OpenMetadata REST + AI SDK clients
│   ├── providers/            # Hover, CodeLens, Diagnostics, Search
│   ├── parsers/              # SQL, Python, dbt table extractors
│   ├── panels/               # Chat, Lineage, AssetDetail webview hosts
│   ├── cache/                # In-memory LRU cache (5min TTL)
│   ├── statusBar/            # Connection indicator
│   ├── onSave/               # On-save orchestrator
│   └── utils/                # Logger, FQN helpers, notifications
├── webview-ui/
│   ├── chat/                 # React chat UI with streaming
│   ├── lineage/              # D3 lineage graph
│   └── asset-detail/         # Asset detail + edit panel
├── test/
│   └── unit/                 # Vitest unit tests (32 tests, all passing)
└── demo/queries/             # Sample SQL files for demo
```

---

## 📺 Demo Script (Hackathon)

1. Open `demo/queries/revenue_report.sql`
2. **Save the file** → watch the status bar flash "3 tables detected"
3. **Hover** over `orders` → see hover card with owner, PII columns, schema
4. Click **CodeLens `🔍 Lineage: orders`** → see the D3 lineage graph
5. Click **`▶ Explain this query`** → AI Chat opens, pre-seeded with table context
6. Ask: *"Are there any data quality issues with the orders table?"*
7. Watch the **streamed AI response** with DQ results
8. In the Asset Detail panel, click **✏️ Edit** → update description → **Save to Catalog**

---

## 🔧 OpenMetadata API & AI SDK

MetaLens uses these OpenMetadata API endpoints:

| Feature | Endpoint |
|---------|---------|
| Connection test | `GET /api/v1/system/config` |
| Search assets | `GET /api/v1/search/query?q={q}&index=dataAsset` |
| Get table | `GET /api/v1/tables/name/{fqn}?fields=columns,tags,owners` |
| Lineage | `GET /api/v1/lineage/table/name/{fqn}?upstreamDepth=2&downstreamDepth=2` |
| Data quality | `GET /api/v1/dataQuality/testCases?entityLink=...` |
| Update description | `PATCH /api/v1/tables/{id}` (JSON Patch) |
| Vote | `PUT /api/v1/tables/{id}/vote` |
| List agents | `GET /api/v1/apps?limit=50` |

AI streaming uses the **`@openmetadata/ai-sdk`** with a REST fallback:
```typescript
// Streaming via SDK
for await (const event of sdk.agent('AskCollateAgent').stream(prompt)) {
  if (event.type === 'content') yield event.content;
}
```

---

## 🆚 MetaLens vs. Basic Chat Port (GitHub Issue #26650)

| Dimension | Basic Port | MetaLens |
|-----------|-----------|---------|
| **Trigger** | User opens, types | Auto on save + cursor-aware |
| **Context** | Manual | Auto-detected from active file |
| **Hover Cards** | ❌ | ✅ Rich inline metadata |
| **Diagnostics** | ❌ | ✅ PII + freshness warnings |
| **CodeLens** | ❌ | ✅ Explain, Lineage, DQ, Edit |
| **Lineage Panel** | ❌ | ✅ Interactive D3 graph |
| **Write-back** | ❌ | ✅ Edit descriptions, vote |
| **Agent Selection** | Single | Multi-agent picker |

---

## 📄 License

MIT — see [LICENSE](./LICENSE)
