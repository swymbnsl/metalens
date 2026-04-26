# MetaLens — OpenMetadata for VS Code

Bring your OpenMetadata and Collate data catalog directly into your VS Code editor. MetaLens is a context-aware metadata co-pilot that surfaces the right metadata at the right moment — without you ever asking.

## Features

- **Inline Hover Metadata**: Hover over table and column names in SQL, Python, or dbt files to instantly see schema, owners, domain, description, tags, and PII alerts.
- **AI Chat**: Pre-seeded with your workspace context. Ask questions about your catalog, linege, or DQ directly to an AI Studio Agent.
- **Interactive Lineage**: View upstream and downstream lineage of any table within a D3-powered webview directly inside VS Code.
- **CodeLens Actions**: Above queries, easily click to Explain Query, Show Lineage, Check Data Quality, or Add/Edit Descriptions.
- **On-Save Suggestions**: When saving a file, MetaLens silently parses the file and checks OpenMetadata, providing freshness or PII warnings via inline diagnostics.

## Setup

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and select **MetaLens: Configure Connection**.
2. Enter your OpenMetadata or Collate host URL (e.g., `https://your-org.getcollate.io`).
3. Paste your Bot JWT token securely.
4. Select your preferred default AI Studio Agent.

## Commands

- `MetaLens: Open AI Chat`
- `MetaLens: Search Data Assets`
- `MetaLens: Show Lineage for Table`
- `MetaLens: Explain Selected Query`
- `MetaLens: Show Asset Details`
- `MetaLens: Clear Metadata Cache`

## Hackathon Submission

This extension is built for the WeMakeDevs × OpenMetadata "Back to the Metadata" Hackathon.
