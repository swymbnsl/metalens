import * as vscode from 'vscode';
import type { OpenMetadataClient } from '../../api/openmetadata';
import type { OMSearchHit } from '../../api/types';
import { logError } from '../../utils/logger';

const ENTITY_ICONS: Record<string, string> = {
  table: '$(table)',
  dashboard: '$(graph)',
  pipeline: '$(circuit-board)',
  topic: '$(broadcast)',
  mlmodel: '$(hubot)',
  container: '$(package)',
};

export class QuickPickSearch {
  static async show(omClient: OpenMetadataClient): Promise<void> {
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { hit?: OMSearchHit }>();
    quickPick.placeholder = 'Search OpenMetadata assets (tables, dashboards, topics...)';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    quickPick.onDidChangeValue(value => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!value.trim()) {
        quickPick.items = [];
        return;
      }

      quickPick.busy = true;
      debounceTimer = setTimeout(async () => {
        try {
          const results = await omClient.searchAssets(value, 15);
          const hits = results?.hits?.hits ?? [];
          quickPick.items = hits.map(hit => {
            const src = hit._source;
            const icon = ENTITY_ICONS[src.entityType?.toLowerCase() ?? 'table'] ?? '$(database)';
            return {
              label: `${icon} ${src.displayName ?? src.name}`,
              description: src.fullyQualifiedName,
              detail: src.description
                ? src.description.slice(0, 100)
                : `Owner: ${src.owner?.name ?? 'Unknown'}`,
              hit,
            };
          });
        } catch (err) {
          logError('QuickPick search error', err);
          quickPick.items = [
            { label: '$(error) Search failed', description: String(err), detail: '' }
          ];
        } finally {
          quickPick.busy = false;
        }
      }, 300);
    });

    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0] as (vscode.QuickPickItem & { hit?: OMSearchHit });
      if (!selected?.hit) {
        quickPick.hide();
        return;
      }

      const src = selected.hit._source;
      quickPick.hide();

      // Show options for what to do with selected asset
      void vscode.window.showQuickPick(
        [
          { label: '$(info) View Asset Details', value: 'detail' },
          { label: '$(type-hierarchy) Show Lineage', value: 'lineage' },
          { label: '$(copy) Insert FQN into Editor', value: 'insert' },
        ],
        { placeHolder: `What to do with: ${src.name}?` }
      ).then(action => {
        if (!action) return;
        if (action.value === 'detail') {
          void vscode.commands.executeCommand('metalens.showAssetDetail', src.fullyQualifiedName);
        } else if (action.value === 'lineage') {
          void vscode.commands.executeCommand('metalens.showLineage', src.fullyQualifiedName);
        } else if (action.value === 'insert') {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            void editor.edit(edit => {
              edit.replace(editor.selection, src.fullyQualifiedName);
            });
          }
        }
      });
    });

    quickPick.show();
  }
}
