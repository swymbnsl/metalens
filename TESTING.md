# MetaLens Testing Guide

This document explains how to manually test each major MetaLens feature inside VS Code.

## Prerequisites

- Install the extension in VS Code.
- Have access to a working OpenMetadata instance.
- Keep these values ready:
  - OpenMetadata host URL
  - Bot JWT token
  - Gemini API key, if you want to test AI chat
- Open a workspace containing SQL, Python, or dbt-style files that reference real catalog assets.

## 1. Connection Setup

### What to test

- The extension accepts your host, token, and Gemini key.
- The connection succeeds and the status bar reflects it.

### Steps

1. Run `MetaLens: Configure Connection`.
2. Enter your OpenMetadata host URL.
3. Enter your bot token.
4. Enter your Gemini key.
5. Confirm that the extension shows a successful connection message.
6. Check that the MetaLens status bar item changes to connected.

### Expected result

- You see a success message.
- Metadata-backed features work without authentication errors.

## 2. Asset Search

### What to test

- Search can find catalog assets from OpenMetadata.

### Steps

1. Run `MetaLens: Search Data Assets`.
2. Type a known table or asset name.
3. Select a result.
4. Choose each available action one by one:
   - `View Asset Details`
   - `Show Lineage`
   - `Insert FQN into Editor`

### Expected result

- Results appear quickly.
- The correct FQN is shown in the picker.
- Each action opens the correct panel or inserts the correct FQN.

## 3. Hover Metadata

### What to test

- Hover cards appear over detected assets in supported files.

### Steps

1. Open a SQL, Python, YAML, or dbt-related file.
2. Make sure it references a table that exists in OpenMetadata.
3. Hover over the table reference.

### Expected result

- A hover card appears with metadata such as:
  - table name
  - schema
  - owner
  - tags
  - domain
  - quick actions

## 4. Lineage View

### What to test

- Lineage loads correctly from a full FQN.
- Upstream and downstream depth controls work.

### Steps

1. Trigger lineage from one of these places:
   - CodeLens
   - hover action
   - asset detail panel
   - command palette
2. If opening manually, enter a full FQN.
3. Change upstream and downstream depth sliders.
4. Reload lineage.
5. Click nodes in the lineage graph.

### Expected result

- The lineage graph opens in VS Code.
- Nodes and edges render clearly.
- Changing depth changes the returned graph.
- Clicking a node opens its asset detail panel.

## 5. Asset Detail Panel

### What to test

- Full asset metadata loads.
- Actions in the panel work.

### Steps

1. Open asset details from search, hover, or lineage.
2. Review metadata shown in the panel.
3. Click:
   - `Lineage`
   - `Open in Collate`
   - vote buttons

### Expected result

- The panel shows table metadata, tags, domain, owner, and columns.
- `Lineage` opens the lineage panel for the same asset.
- `Open in Collate` opens the correct browser page.
- Voting sends successfully.

## 6. Description Editing

### What to test

- Table descriptions can be updated from VS Code.

### Steps

1. Open an asset detail panel.
2. Click `Edit` in the description section.
3. Change the description.
4. Save it.
5. Reload the asset detail panel if needed.

### Expected result

- A success notification appears.
- The new description is visible afterward.
- The change is reflected in OpenMetadata.

## 7. Data Quality Checks

### What to test

- Test cases load for a table.
- The command summary works.

### Steps

1. Trigger `MetaLens: Check Data Quality` from a detected table.
2. Or open an asset detail panel for a table with test cases.
3. Review the returned test summary.

### Expected result

- Passed and failed counts are shown.
- Asset detail shows test entries when they exist.
- If no tests exist, the extension tells you clearly.

## 8. PII Diagnostics

### What to test

- PII-tagged columns create warnings in supported files.

### Steps

1. Open a SQL or Python file that references a table with PII-tagged columns.
2. Reference one of those columns directly, or use `*`.
3. Save the file.

### Expected result

- A warning diagnostic appears on the relevant line or column.
- The warning mentions the PII tag from OpenMetadata.

## 9. Freshness Diagnostics

### What to test

- Stale tables create informational diagnostics.

### Steps

1. Open a file referencing a table with an old `updatedAt` value in OpenMetadata.
2. Save the file.

### Expected result

- An info diagnostic appears saying the table has not been updated recently.

## 10. CodeLens Actions

### What to test

- CodeLens appears for detected assets and triggers the correct flows.

### Steps

1. Open a supported file with detected tables.
2. Verify CodeLens appears near those references.
3. Test each action:
   - `Lineage`
   - `Data Quality`
   - `Add Description`

### Expected result

- Each action opens the correct panel or flow.
- The correct table is used.

## 11. AI Chat

### What to test

- Chat opens, accepts prompts, and uses editor context.

### Steps

1. Run `MetaLens: Open AI Chat`.
2. Open a file with detected tables before opening chat.
3. Ask questions like:
   - `What tables are in this file?`
   - `Explain this query`
   - `Show me lineage for this asset`
4. Use chat result actions if shown.

### Expected result

- The chat opens in a panel.
- Detected tables appear as context.
- Responses stream back.
- Actions like lineage and asset detail open the right view.

## 12. On-Save Metadata Workflow

### What to test

- Saving supported files triggers diagnostics and status feedback.

### Steps

1. Open a supported file with table references.
2. Save the file.

### Expected result

- MetaLens detects assets.
- Diagnostics run in the background.
- A short status bar message appears.

## 13. Cache Refresh After Mutations

### What to test

- Updated metadata is visible after actions like description edits or votes.

### Steps

1. Open an asset detail panel.
2. Change a description or vote on the asset.
3. Reload the same asset.

### Expected result

- The panel reflects the updated state instead of stale cached data.

## Recommended Test Data

Use at least one real asset for each scenario:

- a table with lineage
- a table with data quality tests
- a table with PII-tagged columns
- a stale table with old `updatedAt`
- a table with owner, tags, and domain metadata

## Known Good Test Paths

The most reliable end-to-end checks are:

1. Search asset -> open asset detail -> open lineage
2. Hover table -> open lineage
3. Save SQL file -> check diagnostics
4. Edit description -> reload asset detail
5. Open AI chat -> ask about detected tables
