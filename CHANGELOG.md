# Changelog

All notable changes to MetaLens are documented in this file.

## [0.1.0] — 2026-04-26

### Added

#### Core Extension
- **Extension entry point** with automatic activation on startup
- **SecretStorage** integration for secure JWT token storage
- **First-run wizard** (`metalens.configure`) with host, token, connection test, and agent picker
- **In-memory LRU metadata cache** with configurable TTL (default 5 min)
- **Status bar indicator** — connected (✓), disconnected (⚠️), or detecting tables

#### Metadata Intelligence
- **SQL parser** using `node-sql-parser` with regex fallback — extracts `FROM`, `JOIN`, `INTO`, `UPDATE` table/column refs from CTEs, subqueries, multi-join queries
- **Python parser** — detects `pandas.read_sql`, SQLAlchemy `Table()`, `__tablename__`, `dbt ref()`
- **dbt parser** — detects `{{ ref('model') }}`, `{{ source('schema', 'table') }}`, YAML `name:` fields
- **Jupyter Notebook** SQL cell extractor (bonus)

#### VS Code Providers
- **Hover Cards** — rich Markdown cards with schema, owner, domain, tier, PII columns, last update, column table, action links
- **CodeLens** — per-query: `▶ Explain`, per-table: `🔍 Lineage`, `⚠️ Data Quality`, `📝 Add Description`
- **PII Diagnostics** — `vscode.DiagnosticSeverity.Warning` on lines touching PII-tagged columns
- **Freshness Diagnostics** — Info-level warning when table last updated > 7 days ago
- **On-save handler** — triggers parsers + diagnostics + status bar message on file save
- **Quick Search** — live debounced QuickPick with asset type icons, FQN, description; actions: view detail, lineage, insert FQN

#### Panels (Webview)
- **AI Chat Panel** — React 18, streaming from OpenMetadata AI SDK, context badges, agent selector, suggestion chips, action chips (View Lineage, Asset Detail), markdown renderer
- **Lineage Panel** — D3-like SVG graph (pure React), zoom/pan, color-coded nodes by asset type, hover tooltips, depth sliders (1–5)
- **Asset Detail Panel** — full column table, editable description (push back via JSON Patch), DQ test results, vote buttons, Open in Collate

#### OpenMetadata API Integration
- `GET /api/v1/system/config` — connection ping
- `GET /api/v1/search/query` — full-text asset search
- `GET /api/v1/tables/name/{fqn}` — table metadata with columns, tags, owners
- `GET /api/v1/lineage/table/name/{fqn}` — upstream/downstream lineage
- `GET /api/v1/dataQuality/testCases` — DQ test results
- `PATCH /api/v1/tables/{id}` — description update (JSON Patch)
- `PUT /api/v1/tables/{id}/vote` — vote on data assets
- `GET /api/v1/apps` — list available AI Studio agents

#### Testing
- 32 unit tests (Vitest) — SQL parser (14), Python parser (8), MetadataCache (10)
- VS Code API mock for test isolation
- Fixed hardcoded machine path in `vitest.config.ts`

#### Build & Packaging
- esbuild for extension host (Node CJS)
- esbuild for webview bundles (browser IIFE) — chat, lineage, asset-detail
- `.vsix` packaging with proper `.vscodeignore`
- Added `repository`, `license`, `homepage` to `package.json`
- `@vscode/vsce` for packaging
