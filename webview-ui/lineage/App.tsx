import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

interface LineageNode {
  id: string;
  type: string;
  fullyQualifiedName: string;
  name: string;
  displayName?: string;
  description?: string;
}

interface LineageEdge {
  fromEntity: string;
  toEntity: string;
}

interface LineageData {
  entity: LineageNode;
  nodes?: LineageNode[];
  upstreamEdges?: LineageEdge[];
  downstreamEdges?: LineageEdge[];
}

type PositionedNode = LineageNode & { x: number; y: number; side: 'upstream' | 'center' | 'downstream' | 'other' };

const NODE_COLORS: Record<string, string> = {
  table: '#6ea8ff',
  pipeline: '#71d7a7',
  dashboard: '#f3b56b',
  topic: '#f1d77b',
  mlmodel: '#d49cff',
  container: '#7ed6d1',
};

const NODE_ICONS: Record<string, string> = {
  table: '▣',
  pipeline: '≋',
  dashboard: '◫',
  topic: '◉',
  mlmodel: '◇',
  container: '▤',
};

const CARD_W = 240;
const CARD_H = 88;
const CARD_GAP = 34;
const TOP_MARGIN = 84;
const SIDE_MARGIN = 64;
const COLUMN_GAP = 160;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function stripHtml(text?: string): string {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitLineage(data: LineageData): {
  upstreamNodes: LineageNode[];
  downstreamNodes: LineageNode[];
  otherNodes: LineageNode[];
} {
  const allNodes = data.nodes ?? [];
  const upstreamIds = new Set((data.upstreamEdges ?? []).map((edge) => edge.fromEntity));
  const downstreamIds = new Set((data.downstreamEdges ?? []).map((edge) => edge.toEntity));

  const upstreamNodes = allNodes.filter((node) => upstreamIds.has(node.id));
  const downstreamNodes = allNodes.filter((node) => downstreamIds.has(node.id));
  const assigned = new Set([...upstreamNodes, ...downstreamNodes].map((node) => node.id));
  const otherNodes = allNodes.filter((node) => !assigned.has(node.id));

  return { upstreamNodes, downstreamNodes, otherNodes };
}

function stackNodes(
  nodes: LineageNode[],
  x: number,
  side: PositionedNode['side'],
  startY: number,
): PositionedNode[] {
  return nodes.map((node, index) => ({
    ...node,
    x,
    y: startY + index * (CARD_H + CARD_GAP),
    side,
  }));
}

function buildLayout(data: LineageData): {
  nodes: PositionedNode[];
  width: number;
  height: number;
  centerX: number;
  laneMeta: Array<{ label: string; count: number; x: number; tone: string }>;
} {
  const { upstreamNodes, downstreamNodes, otherNodes } = splitLineage(data);

  const laneCounts = [upstreamNodes.length, 1, downstreamNodes.length, otherNodes.length].filter(Boolean);
  const tallestLane = Math.max(...laneCounts, 1);
  const contentHeight = tallestLane * CARD_H + Math.max(0, tallestLane - 1) * CARD_GAP;
  const height = Math.max(520, TOP_MARGIN + contentHeight + 110);

  const upstreamX = SIDE_MARGIN;
  const centerX = upstreamX + CARD_W + COLUMN_GAP;
  const downstreamX = centerX + CARD_W + COLUMN_GAP;
  const otherX = downstreamX + CARD_W + 80;
  const width = otherNodes.length > 0 ? otherX + CARD_W + SIDE_MARGIN : downstreamX + CARD_W + SIDE_MARGIN;

  const centerY = TOP_MARGIN + contentHeight / 2 - CARD_H / 2;
  const centeredStart = (count: number) => TOP_MARGIN + contentHeight / 2 - (count * CARD_H + Math.max(0, count - 1) * CARD_GAP) / 2;

  const positionedNodes: PositionedNode[] = [
    ...stackNodes(upstreamNodes, upstreamX, 'upstream', centeredStart(upstreamNodes.length)),
    { ...data.entity, x: centerX, y: centerY, side: 'center' },
    ...stackNodes(downstreamNodes, downstreamX, 'downstream', centeredStart(downstreamNodes.length)),
    ...stackNodes(otherNodes, otherX, 'other', TOP_MARGIN),
  ];

  return {
    nodes: positionedNodes,
    width,
    height,
    centerX,
    laneMeta: [
      { label: 'Upstream Sources', count: upstreamNodes.length, x: upstreamX, tone: '#73b0ff' },
      { label: 'Selected Asset', count: 1, x: centerX, tone: '#9cc0ff' },
      { label: 'Downstream Consumers', count: downstreamNodes.length, x: downstreamX, tone: '#71d7a7' },
      ...(otherNodes.length > 0 ? [{ label: 'Related Nodes', count: otherNodes.length, x: otherX, tone: '#b5b8cc' }] : []),
    ],
  };
}

export default function App(): React.ReactElement {
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFqn, setCurrentFqn] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [upstreamDepth, setUpstreamDepth] = useState(3);
  const [downstreamDepth, setDownstreamDepth] = useState(3);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 32, y: 18, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; [key: string]: unknown };
      switch (msg.type) {
        case 'loading':
          setIsLoading(true);
          setError(null);
          setCurrentFqn(String(msg.fqn ?? ''));
          setSearchInput(String(msg.fqn ?? ''));
          break;
        case 'lineageData':
          setIsLoading(false);
          setLineageData(msg.data as LineageData);
          break;
        case 'error':
          setIsLoading(false);
          setError(String(msg.message));
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const loadLineage = useCallback(
    (fqn: string) => {
      if (!fqn.trim()) return;
      setCurrentFqn(fqn);
      vscode.postMessage({ type: 'loadLineage', fqn, upstreamDepth, downstreamDepth });
    },
    [downstreamDepth, upstreamDepth],
  );

  const handleNodeClick = (node: LineageNode) => {
    vscode.postMessage({ type: 'nodeClicked', fqn: node.fullyQualifiedName });
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const scaleFactor = event.deltaY < 0 ? 1.08 : 0.92;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.55, Math.min(2.2, prev.scale * scaleFactor)),
    }));
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = { x: event.clientX - transform.x, y: event.clientY - transform.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTransform((prev) => ({
      ...prev,
      x: event.clientX - panStart.current.x,
      y: event.clientY - panStart.current.y,
    }));
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const graph = useMemo(() => {
    if (!lineageData) return null;
    return buildLayout(lineageData);
  }, [lineageData]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const node of graph?.nodes ?? []) map.set(node.id, node);
    return map;
  }, [graph]);

  const edges = useMemo(
    () => [...(lineageData?.upstreamEdges ?? []), ...(lineageData?.downstreamEdges ?? [])],
    [lineageData],
  );

  return (
    <div style={S.shell}>
      <div style={S.toolbar}>
        <div style={S.brand}>
          <span style={S.brandIcon}>↠</span>
          <div>
            <div style={S.brandTitle}>Lineage Flow</div>
            <div style={S.brandSub}>Trace sources and consumers around a catalog asset</div>
          </div>
        </div>

        <div style={S.searchWrap}>
          <input
            style={S.input}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && loadLineage(searchInput)}
            placeholder="Enter full table FQN"
          />
          <button onClick={() => loadLineage(searchInput || currentFqn)} style={S.primaryButton}>
            Load
          </button>
        </div>

        <div style={S.sliderGroup}>
          <div style={S.sliderLabel}>Upstream {upstreamDepth}</div>
          <input
            type="range"
            min={1}
            max={5}
            value={upstreamDepth}
            onChange={(event) => setUpstreamDepth(Number(event.target.value))}
            style={S.slider}
          />
        </div>

        <div style={S.sliderGroup}>
          <div style={S.sliderLabel}>Downstream {downstreamDepth}</div>
          <input
            type="range"
            min={1}
            max={5}
            value={downstreamDepth}
            onChange={(event) => setDownstreamDepth(Number(event.target.value))}
            style={S.slider}
          />
        </div>

        <button onClick={() => setTransform({ x: 32, y: 18, scale: 1 })} style={S.secondaryButton}>
          Reset View
        </button>
      </div>

      <div style={S.content}>
        {lineageData && graph && (
          <div style={S.summaryBar}>
            {graph.laneMeta
              .filter((lane) => lane.count > 0)
              .map((lane) => (
                <div key={lane.label} style={{ ...S.summaryCard, borderColor: `${lane.tone}55` }}>
                  <div style={{ ...S.summaryTone, background: lane.tone }} />
                  <div style={S.summaryLabel}>{lane.label}</div>
                  <div style={S.summaryValue}>{lane.count}</div>
                </div>
              ))}
            <div style={S.summaryFqn}>{currentFqn}</div>
          </div>
        )}

        <div
          style={{
            ...S.canvasWrap,
            cursor: isPanning.current ? 'grabbing' : graph ? 'grab' : 'default',
          }}
        >
          {isLoading && (
            <div style={S.overlay}>
              <div style={S.overlayCard}>
                <div style={S.spinner}>◎</div>
                <div style={S.overlayTitle}>Loading lineage</div>
                <div style={S.overlayText}>{currentFqn}</div>
              </div>
            </div>
          )}

          {error && (
            <div style={S.overlay}>
              <div style={{ ...S.overlayCard, borderColor: 'rgba(255,120,120,0.35)' }}>
                <div style={{ ...S.overlayTitle, color: '#ffb0b0' }}>Lineage request failed</div>
                <div style={S.errorText}>{error}</div>
                <button onClick={() => loadLineage(currentFqn)} style={S.primaryButton}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && !lineageData && (
            <div style={S.emptyState}>
              <div style={S.emptyMark}>↠</div>
              <div style={S.emptyTitle}>No lineage loaded</div>
              <div style={S.emptyText}>Enter a full FQN above or trigger lineage from the editor.</div>
            </div>
          )}

          {lineageData && graph && (
            <svg
              style={S.svg}
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <linearGradient id="bgGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(65,115,220,0.16)" />
                  <stop offset="100%" stopColor="rgba(50,210,150,0.06)" />
                </linearGradient>
                <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L0,10 L10,5 z" fill="rgba(115,176,255,0.7)" />
                </marker>
                <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L0,10 L10,5 z" fill="rgba(113,215,167,0.7)" />
                </marker>
              </defs>

              <rect x={0} y={0} width={graph.width} height={graph.height} fill="#081018" />
              <rect x={18} y={18} width={graph.width - 36} height={graph.height - 36} rx={28} fill="url(#bgGlow)" />

              <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
                {graph.laneMeta.map((lane) => (
                  <g key={lane.label}>
                    <text x={lane.x} y={44} fill={lane.tone} fontSize={13} fontWeight={700} letterSpacing={0.4}>
                      {lane.label.toUpperCase()}
                    </text>
                    <line
                      x1={lane.x}
                      y1={52}
                      x2={lane.x + CARD_W}
                      y2={52}
                      stroke={`${lane.tone}33`}
                      strokeWidth={1}
                    />
                  </g>
                ))}

                {edges.map((edge, index) => {
                  const from = nodeMap.get(edge.fromEntity);
                  const to = nodeMap.get(edge.toEntity);
                  if (!from || !to) return null;

                  const x1 = from.x + CARD_W;
                  const y1 = from.y + CARD_H / 2;
                  const x2 = to.x;
                  const y2 = to.y + CARD_H / 2;
                  const pull = Math.max(50, Math.abs(x2 - x1) * 0.45);
                  const stroke = to.side === 'downstream' ? 'rgba(113,215,167,0.6)' : 'rgba(115,176,255,0.6)';
                  const marker = to.side === 'downstream' ? 'url(#arrowGreen)' : 'url(#arrowBlue)';

                  return (
                    <path
                      key={`${edge.fromEntity}-${edge.toEntity}-${index}`}
                      d={`M${x1},${y1} C${x1 + pull},${y1} ${x2 - pull},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={2.2}
                      markerEnd={marker}
                      opacity={0.9}
                    />
                  );
                })}

                {graph.nodes.map((node) => {
                  const color = NODE_COLORS[node.type?.toLowerCase() ?? 'table'] ?? '#6ea8ff';
                  const label = node.displayName || node.name;
                  const description = stripHtml(node.description);
                  const isCenter = node.side === 'center';
                  const isHovered = hoveredNode === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <rect
                        width={CARD_W}
                        height={CARD_H}
                        rx={18}
                        fill={isCenter ? 'rgba(22,35,53,0.96)' : 'rgba(20,26,41,0.88)'}
                        stroke={isCenter ? '#8fb9ff' : isHovered ? color : 'rgba(145,165,205,0.18)'}
                        strokeWidth={isCenter ? 2.4 : isHovered ? 1.8 : 1}
                      />
                      <rect
                        x={0}
                        y={0}
                        width={6}
                        height={CARD_H}
                        rx={18}
                        fill={color}
                        opacity={isCenter ? 1 : 0.82}
                      />
                      <text x={18} y={28} fontSize={17} fill={color}>
                        {NODE_ICONS[node.type?.toLowerCase() ?? 'table'] ?? '▣'}
                      </text>
                      <text x={44} y={29} fontSize={15} fill="#dfe8ff" fontWeight={700}>
                        {truncate(label, 22)}
                      </text>
                      <text x={18} y={54} fontSize={11} fill="rgba(192,206,235,0.78)">
                        {node.type || 'table'}
                      </text>
                      <text x={18} y={72} fontSize={10.5} fill="rgba(155,170,199,0.64)">
                        {truncate(node.fullyQualifiedName, 34)}
                      </text>
                      {isHovered && description && (
                        <foreignObject x={0} y={CARD_H + 10} width={CARD_W} height={86}>
                          <div style={S.tooltip}>
                            <div style={S.tooltipTitle}>Description</div>
                            <div style={S.tooltipText}>{truncate(description, 180)}</div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(65,115,220,0.14), transparent 28%), linear-gradient(180deg, #08111b 0%, #05080d 100%)',
    color: 'var(--vscode-editor-foreground)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 18px',
    borderBottom: '1px solid rgba(125,150,190,0.16)',
    background: 'rgba(9,14,22,0.78)',
    backdropFilter: 'blur(14px)',
    flexWrap: 'wrap',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, rgba(110,168,255,0.24), rgba(113,215,167,0.14))',
    color: '#9cc0ff',
    fontSize: 18,
    fontWeight: 700,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e7efff',
  },
  brandSub: {
    fontSize: 11,
    color: 'rgba(184,198,225,0.72)',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 280,
  },
  input: {
    flex: 1,
    minWidth: 220,
    background: 'rgba(9,16,28,0.92)',
    color: '#ebf1ff',
    border: '1px solid rgba(124,151,201,0.18)',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 12,
    outline: 'none',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #69a3ff, #88bcff)',
    color: '#07101b',
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  secondaryButton: {
    background: 'rgba(17,26,40,0.85)',
    color: '#d7e4ff',
    border: '1px solid rgba(130,155,205,0.18)',
    borderRadius: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 112,
  },
  sliderLabel: {
    fontSize: 11,
    color: 'rgba(196,210,235,0.82)',
  },
  slider: {
    width: 110,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  summaryBar: {
    display: 'flex',
    gap: 10,
    padding: '12px 18px 0',
    flexWrap: 'wrap',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid rgba(120,140,185,0.18)',
    background: 'rgba(10,16,27,0.7)',
    borderRadius: 14,
    padding: '10px 12px',
  },
  summaryTone: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(192,206,235,0.78)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: 700,
    color: '#eef4ff',
  },
  summaryFqn: {
    marginLeft: 'auto',
    maxWidth: '100%',
    alignSelf: 'center',
    fontSize: 11,
    color: 'rgba(180,194,221,0.68)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  canvasWrap: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    margin: 18,
    borderRadius: 26,
    border: '1px solid rgba(127,152,205,0.14)',
    background: 'linear-gradient(180deg, rgba(7,12,19,0.98), rgba(3,6,11,1))',
  },
  svg: {
    width: '100%',
    height: '100%',
    userSelect: 'none',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
    background: 'rgba(4,8,14,0.48)',
    backdropFilter: 'blur(4px)',
  },
  overlayCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    maxWidth: 560,
    padding: 24,
    borderRadius: 20,
    border: '1px solid rgba(125,150,190,0.2)',
    background: 'rgba(8,13,22,0.92)',
    color: '#e7efff',
    textAlign: 'center',
  },
  spinner: {
    fontSize: 24,
    color: '#89b4fa',
    animation: 'spin 1s linear infinite',
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  overlayText: {
    fontSize: 12,
    color: 'rgba(189,203,229,0.76)',
    wordBreak: 'break-word',
  },
  errorText: {
    fontSize: 12,
    color: '#ffd2d2',
    wordBreak: 'break-word',
  },
  emptyState: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: 'rgba(195,208,231,0.7)',
    textAlign: 'center',
    padding: 24,
  },
  emptyMark: {
    fontSize: 42,
    color: '#7dafff',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#edf4ff',
  },
  emptyText: {
    fontSize: 13,
    maxWidth: 400,
  },
  tooltip: {
    borderRadius: 14,
    border: '1px solid rgba(121,150,205,0.18)',
    background: 'rgba(9,14,22,0.96)',
    padding: '10px 12px',
    color: '#deebff',
    fontSize: 11,
    lineHeight: 1.45,
  },
  tooltipTitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'rgba(148,182,243,0.9)',
    marginBottom: 6,
  },
  tooltipText: {
    color: 'rgba(221,232,250,0.84)',
  },
};
