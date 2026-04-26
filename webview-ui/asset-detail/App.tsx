import React, { useState, useEffect } from 'react';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

interface Column {
  name: string;
  displayName?: string;
  dataType: string;
  description?: string;
  tags?: { tagFQN: string }[];
  constraint?: string;
}

interface Table {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  fullyQualifiedName: string;
  columns: Column[];
  tags?: { tagFQN: string }[];
  owners?: { name: string; displayName?: string; email?: string }[];
  domain?: { name: string };
  updatedAt?: number;
  updatedBy?: string;
  tableType?: string;
}

interface TestCase {
  id: string;
  name: string;
  testCaseResult?: { testCaseStatus: 'Success' | 'Failed' | 'Aborted'; timestamp: number };
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 100, padding: '1px 8px', fontSize: 11, fontWeight: 500 }}>
      {children}
    </span>
  );
}

function Tag({ fqn }: { fqn: string }) {
  const name = fqn.split('.').pop() ?? fqn;
  const isPII = fqn.toLowerCase().includes('pii');
  const color = isPII ? '#f38ba8' : '#89b4fa';
  return <Badge color={color}>{name}</Badge>;
}

const S: Record<string, React.CSSProperties> = {
  root: { fontFamily: 'var(--vscode-font-family, sans-serif)', fontSize: 13, color: 'var(--vscode-editor-foreground)', background: 'var(--vscode-editor-background)', minHeight: '100vh', padding: 0 },
  header: { padding: '16px 20px 12px', borderBottom: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-sideBar-background)' },
  headerName: { fontSize: 22, fontWeight: 700, color: '#89b4fa', marginBottom: 4 },
  headerFqn: { fontSize: 11, opacity: 0.5, marginBottom: 10, fontFamily: 'monospace' },
  headerMeta: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, fontSize: 12 },
  section: { padding: '14px 20px', borderBottom: '1px solid var(--vscode-panel-border)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', opacity: 0.6, marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: { textAlign: 'left' as const, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--vscode-panel-border)', fontWeight: 600, fontSize: 11, opacity: 0.8 },
  td: { padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' as const },
  btn: { padding: '5px 14px', borderRadius: 6, border: '1px solid var(--vscode-panel-border)', background: 'transparent', color: 'var(--vscode-editor-foreground)', cursor: 'pointer', fontSize: 12, transition: 'all 0.15s' },
  primaryBtn: { padding: '5px 14px', borderRadius: 6, border: 'none', background: '#89b4fa', color: '#1e1e2e', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  textarea: { width: '100%', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-panel-border)', borderRadius: 6, padding: '8px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' as const, outline: 'none', minHeight: 80 },
};

export default function App(): React.ReactElement {
  const [table, setTable] = useState<Table | null>(null);
  const [dqTests, setDqTests] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [notification, setNotification] = useState<{ message: string; level: string } | null>(null);
  const [searchCol, setSearchCol] = useState('');

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; [key: string]: unknown };
      switch (msg.type) {
        case 'loading': setIsLoading(true); setError(null); break;
        case 'assetData':
          setIsLoading(false);
          setTable(msg.data as Table);
          setDescValue((msg.data as Table).description ?? '');
          break;
        case 'dqData':
          setDqTests(((msg.data as { data?: TestCase[] }).data) ?? []);
          break;
        case 'error':
          setIsLoading(false);
          setError(String(msg.message));
          break;
        case 'notification':
          setNotification({ message: String(msg.message), level: String(msg.level ?? 'info') });
          setTimeout(() => setNotification(null), 3000);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const saveDescription = () => {
    vscode.postMessage({ type: 'updateDescription', description: descValue });
    setEditingDesc(false);
  };

  const filteredCols = table?.columns.filter(c =>
    !searchCol || c.name.toLowerCase().includes(searchCol.toLowerCase())
  ) ?? [];

  const dqPassed = dqTests.filter(t => t.testCaseResult?.testCaseStatus === 'Success').length;
  const dqFailed = dqTests.filter(t => t.testCaseResult?.testCaseStatus === 'Failed').length;

  if (isLoading) {
    return <div style={{ ...S.root, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ textAlign: 'center', opacity: 0.6 }}><div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>Loading asset…</div></div>;
  }

  if (error) {
    return <div style={{ ...S.root, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ textAlign: 'center', color: '#f38ba8' }}><div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>{error}</div></div>;
  }

  if (!table) return <div style={S.root} />;

  return (
    <div style={S.root}>
      {/* Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 100, padding: '8px 16px', borderRadius: 8, background: notification.level === 'success' ? 'rgba(166,227,161,0.2)' : 'rgba(137,180,250,0.2)', border: `1px solid ${notification.level === 'success' ? '#a6e3a1' : '#89b4fa'}`, color: notification.level === 'success' ? '#a6e3a1' : '#89b4fa', fontSize: 12 }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerName}>
          {table.displayName ?? table.name}
        </div>
        <div style={S.headerFqn}>{table.fullyQualifiedName}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {table.tags?.map(t => <Tag key={t.tagFQN} fqn={t.tagFQN} />)}
          {table.tableType && <Badge color="#cba6f7">{table.tableType}</Badge>}
        </div>
        <div style={S.headerMeta}>
          {table.owners?.[0] && (
            <span>👤 {table.owners[0].displayName ?? table.owners[0].name}</span>
          )}
          {table.domain && <span>🏷 {table.domain.name}</span>}
          {table.updatedAt && (
            <span>🕐 Updated {new Date(table.updatedAt).toLocaleDateString()}</span>
          )}
          <span>📋 {table.columns?.length ?? 0} columns</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={S.btn} onClick={() => vscode.postMessage({ type: 'showLineage' })}>🔗 Lineage</button>
          <button style={S.btn} onClick={() => vscode.postMessage({ type: 'openInCollate' })}>↗ Open in Collate</button>
          <button style={S.btn} onClick={() => vscode.postMessage({ type: 'vote', voteType: 'votedUp' })}>👍</button>
          <button style={S.btn} onClick={() => vscode.postMessage({ type: 'vote', voteType: 'votedDown' })}>👎</button>
        </div>
      </div>

      {/* Description */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={S.sectionTitle}>Description</div>
          <button style={S.btn} onClick={() => setEditingDesc(!editingDesc)}>
            {editingDesc ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
        {editingDesc ? (
          <div>
            <textarea style={S.textarea} value={descValue} onChange={e => setDescValue(e.target.value)} rows={4} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button style={S.primaryBtn} onClick={saveDescription}>Save to Catalog</button>
            </div>
          </div>
        ) : (
          <div style={{ opacity: table.description ? 1 : 0.4, fontStyle: table.description ? 'normal' : 'italic', lineHeight: 1.6 }}>
            {table.description ?? 'No description. Click Edit to add one.'}
          </div>
        )}
      </div>

      {/* Data Quality */}
      {dqTests.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Data Quality ({dqTests.length} tests)</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13 }}>
            <span style={{ color: '#a6e3a1' }}>✓ {dqPassed} passed</span>
            <span style={{ color: '#f38ba8' }}>✗ {dqFailed} failed</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dqTests.slice(0, 5).map(test => (
              <div key={test.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span>{test.testCaseResult?.testCaseStatus === 'Success' ? '✅' : test.testCaseResult?.testCaseStatus === 'Failed' ? '❌' : '⚠️'}</span>
                <span style={{ opacity: 0.85 }}>{test.name}</span>
              </div>
            ))}
            {dqTests.length > 5 && <div style={{ fontSize: 11, opacity: 0.5 }}>…and {dqTests.length - 5} more tests</div>}
          </div>
        </div>
      )}

      {/* Columns */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={S.sectionTitle}>Columns ({filteredCols.length})</div>
          <input
            style={{ background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-panel-border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, outline: 'none' }}
            placeholder="Filter columns…"
            value={searchCol}
            onChange={e => setSearchCol(e.target.value)}
          />
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Column</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Tags</th>
              <th style={S.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredCols.map(col => {
              const isPK = col.constraint === 'PRIMARY_KEY';
              const hasPII = col.tags?.some(t => t.tagFQN.toLowerCase().includes('pii'));
              return (
                <tr key={col.name}>
                  <td style={S.td}>
                    <span style={{ fontFamily: 'monospace', fontWeight: isPK ? 700 : 400, color: isPK ? '#89b4fa' : 'inherit' }}>
                      {isPK && '🔑 '}{col.name}
                    </span>
                  </td>
                  <td style={{ ...S.td, opacity: 0.7, fontFamily: 'monospace', fontSize: 11 }}>{col.dataType}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {col.tags?.map(t => <Tag key={t.tagFQN} fqn={t.tagFQN} />)}
                      {hasPII && <Badge color="#f38ba8">⚠️ PII</Badge>}
                    </div>
                  </td>
                  <td style={{ ...S.td, opacity: col.description ? 1 : 0.35, fontStyle: col.description ? 'normal' : 'italic', maxWidth: 200 }}>
                    {col.description ?? 'No description'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
