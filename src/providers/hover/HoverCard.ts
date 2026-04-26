import * as vscode from 'vscode';
import type { OMTable } from '../../api/types';
import { buildCollateUrl } from '../../utils/fqn';
import { getSettings } from '../../config/settings';

/**
 * Builds a rich Markdown hover card for a detected table/column.
 */
export function buildHoverCard(table: OMTable): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;
  md.supportHtml = true;

  const settings = getSettings();
  const collateUrl = buildCollateUrl(settings.host, table.fullyQualifiedName);

  // Header
  const tier = table.tier?.tagFQN?.split('.')?.pop() ?? '';
  const tierBadge = tier ? ` · ${tier}` : '';
  md.appendMarkdown(`### 📊 \`${table.name}\`${tierBadge}\n\n`);

  // Schema info
  const schema = table.databaseSchema?.name ?? '';
  const database = table.database?.name ?? '';
  if (schema || database) {
    md.appendMarkdown(`**Schema:** \`${[database, schema].filter(Boolean).join('.')}\`\n\n`);
  }

  // Owner
  const owner = table.owners?.[0];
  if (owner) {
    md.appendMarkdown(`**Owner:** ${owner.displayName ?? owner.name}`);
    if (owner.email) md.appendMarkdown(` · \`${owner.email}\``);
    md.appendMarkdown('\n\n');
  }

  // Domain
  if (table.domain) {
    md.appendMarkdown(`**Domain:** ${table.domain.name}\n\n`);
  }

  // Description
  if (table.description) {
    const desc = table.description.length > 200
      ? table.description.slice(0, 200) + '…'
      : table.description;
    md.appendMarkdown(`${desc}\n\n`);
  }

  // Last updated
  if (table.updatedAt) {
    const date = new Date(table.updatedAt);
    const ago = formatTimeAgo(date);
    md.appendMarkdown(`**Last updated:** ${ago}\n\n`);
  }

  // PII warning
  const piiColumns = (table.columns ?? []).filter(col =>
    col.tags?.some(t => t.tagFQN.toLowerCase().includes('pii'))
  );
  if (piiColumns.length > 0) {
    md.appendMarkdown(`> ⚠️ **PII columns detected:** ${piiColumns.map(c => `\`${c.name}\``).join(', ')}\n\n`);
  }

  // Columns (show up to 5)
  const cols = table.columns?.slice(0, 5) ?? [];
  if (cols.length > 0) {
    md.appendMarkdown('**Columns:**\n\n');
    md.appendMarkdown('| Column | Type | Tags |\n|--------|------|------|\n');
    for (const col of cols) {
      const tags = col.tags?.map(t => `\`${t.tagFQN.split('.').pop()}\``).join(' ') ?? '';
      const name = col.constraint === 'PRIMARY_KEY' ? `**${col.name}** 🔑` : col.name;
      md.appendMarkdown(`| ${name} | \`${col.dataType}\` | ${tags} |\n`);
    }
    if ((table.columns?.length ?? 0) > 5) {
      md.appendMarkdown(`\n*…and ${(table.columns?.length ?? 0) - 5} more columns*\n`);
    }
    md.appendMarkdown('\n');
  }

  // Action links
  const chatCmd = encodeURIComponent(JSON.stringify([table.fullyQualifiedName]));
  const lineageCmd = encodeURIComponent(JSON.stringify([table.fullyQualifiedName]));

  md.appendMarkdown(
    `[Open in Collate ↗](${collateUrl})` +
    `  |  [$(comment-discussion) Ask about this table](command:metalens.openChat)` +
    `  |  [$(type-hierarchy) View Lineage](command:metalens.showLineage?${lineageCmd})\n`
  );

  void chatCmd; // suppress unused warning

  return md;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
