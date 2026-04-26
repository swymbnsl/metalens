import React, { useState, useEffect, useRef, useCallback } from 'react';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

interface LineageNode {
  id: string;
  type: string;
  fullyQualifiedName: string;
  name: string;
  description?: string;
  x?: number;
  y?: number;
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

const NODE_COLORS: Record<string, string> = {
  table: '#89b4fa',
  pipeline: '#a6e3a1',
  dashboard: '#fab387',
  topic: '#f9e2af',
  mlmodel: '#cba6f7',
  container: '#94e2d5',
};

const NODE_ICONS: Record<string, string> = {
  table: '🗄',
  pipeline: '⚙️',
  dashboard: '📊',
  topic: '📡',
  mlmodel: '🤖',
  container: '📦',
};

const NODE_W = 160;
const NODE_H = 60;
const H_GAP = 220;
const V_GAP = 90;

function layoutNodes(data: LineageData): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const allNodes = [data.entity, ...(data.nodes ?? [])];

  // Simple layered layout
  // Find upstream and downstream sets
  const upstreamIds = new Set((data.upstreamEdges ?? []).map((e) => e.fromEntity));
  const downstreamIds = new Set((data.downstreamEdges ?? []).map((e) => e.toEntity));

  const upstreamNodes = allNodes.filter((n) => upstreamIds.has(n.id));
  const downstreamNodes = allNodes.filter((n) => downstreamIds.has(n.id));
  const centerX = Math.max(upstreamNodes.length, 1) * H_GAP;

  // Center node
  positions.set(data.entity.id, { x: centerX, y: 300 });

  // Upstream (left)
  upstreamNodes.forEach((node, i) => {
    const totalHeight = upstreamNodes.length * V_GAP;
    const startY = 300 - totalHeight / 2 + i * V_GAP;
    positions.set(node.id, { x: centerX - H_GAP, y: startY });
  });

  // Downstream (right)
  downstreamNodes.forEach((node, i) => {
    const totalHeight = downstreamNodes.length * V_GAP;
    const startY = 300 - totalHeight / 2 + i * V_GAP;
    positions.set(node.id, { x: centerX + H_GAP, y: startY });
  });

  // Any remaining nodes
  let extraY = 100;
  for (const node of allNodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: centerX + 2 * H_GAP, y: extraY });
      extraY += V_GAP;
    }
  }

  return positions;
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
  const [transform, setTransform] = useState({ x: 50, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
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
    [upstreamDepth, downstreamDepth],
  );

  const handleNodeClick = (node: LineageNode) => {
    vscode.postMessage({ type: 'nodeClicked', fqn: node.fullyQualifiedName });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * scaleFactor)),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    }));
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const positions = lineageData ? layoutNodes(lineageData) : new Map();
  const allNodes = lineageData ? [lineageData.entity, ...(lineageData.nodes ?? [])] : [];
  const allEdges = [...(lineageData?.upstreamEdges ?? []), ...(lineageData?.downstreamEdges ?? [])];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-editor-foreground)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          background: 'var(--vscode-sideBar-background)',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18 }}>🔗</span>
        <strong style={{ fontSize: 13, color: '#89b4fa' }}>Lineage</strong>
        <input
          style={{
            flex: 1,
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            outline: 'none',
          }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadLineage(searchInput)}
          placeholder="Enter table FQN to visualize lineage…"
        />
        <button
          onClick={() => loadLineage(searchInput || currentFqn)}
          style={{
            background: '#89b4fa',
            color: '#1e1e2e',
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Load
        </button>
        <label style={{ fontSize: 11, opacity: 0.7 }}>↑{upstreamDepth}</label>
        <input
          type="range"
          min={1}
          max={5}
          value={upstreamDepth}
          onChange={(e) => setUpstreamDepth(Number(e.target.value))}
          style={{ width: 60 }}
        />
        <label style={{ fontSize: 11, opacity: 0.7 }}>↓{downstreamDepth}</label>
        <input
          type="range"
          min={1}
          max={5}
          value={downstreamDepth}
          onChange={(e) => setDownstreamDepth(Number(e.target.value))}
          style={{ width: 60 }}
        />
        <button
          onClick={() => setTransform({ x: 50, y: 0, scale: 1 })}
          style={{
            background: 'transparent',
            color: 'var(--vscode-editor-foreground)',
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: 6,
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isPanning.current ? 'grabbing' : 'grab',
        }}
      >
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <div style={{ textAlign: 'center', opacity: 0.7 }}>
              <div style={{ fontSize: 36, marginBottom: 12, animation: 'spin 1s linear infinite' }}>
                ⚙️
              </div>
              <div>Loading lineage for {currentFqn}…</div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center', color: '#f38ba8', padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <div>{error}</div>
              <button
                onClick={() => loadLineage(currentFqn)}
                style={{
                  marginTop: 12,
                  background: '#89b4fa',
                  color: '#1e1e2e',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 16px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && !lineageData && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.5,
              textAlign: 'center',
              padding: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🔗</div>
              <div style={{ fontSize: 16, marginBottom: 8, color: '#89b4fa' }}>
                No lineage loaded
              </div>
              <div style={{ fontSize: 13 }}>
                Enter a table FQN above or click "Show Lineage" in your editor
              </div>
            </div>
          </div>
        )}

        {lineageData && (
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', userSelect: 'none' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(137,180,250,0.6)" />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
              {/* Edges */}
              {allEdges.map((edge, i) => {
                const fromPos = positions.get(edge.fromEntity);
                const toPos = positions.get(edge.toEntity);
                if (!fromPos || !toPos) return null;
                const x1 = fromPos.x + NODE_W;
                const y1 = fromPos.y + NODE_H / 2;
                const x2 = toPos.x;
                const y2 = toPos.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="rgba(137,180,250,0.4)"
                    strokeWidth={2}
                    markerEnd="url(#arrow)"
                  />
                );
              })}

              {/* Nodes */}
              {allNodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                const isCenter = node.id === lineageData.entity.id;
                const color = NODE_COLORS[node.type?.toLowerCase() ?? 'table'] ?? '#89b4fa';
                const isHovered = hoveredNode === node.id;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={10}
                      ry={10}
                      fill={isCenter ? 'rgba(137,180,250,0.2)' : 'rgba(30,30,46,0.9)'}
                      stroke={isCenter ? '#89b4fa' : isHovered ? color : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isCenter ? 2 : isHovered ? 2 : 1}
                      filter={isHovered ? 'url(#glow)' : undefined}
                    />
                    <text x={14} y={22} fontSize={18} dominantBaseline="middle">
                      {NODE_ICONS[node.type?.toLowerCase() ?? 'table'] ?? '🗄'}
                    </text>
                    <text
                      x={38}
                      y={22}
                      fontSize={12}
                      fontWeight={isCenter ? 700 : 500}
                      fill={color}
                      dominantBaseline="middle"
                    >
                      {node.name.length > 14 ? node.name.slice(0, 14) + '…' : node.name}
                    </text>
                    <text
                      x={14}
                      y={44}
                      fontSize={10}
                      fill="rgba(255,255,255,0.5)"
                      dominantBaseline="middle"
                    >
                      {node.type ?? 'table'}
                    </text>
                    {isHovered && node.description && (
                      <foreignObject x={0} y={NODE_H + 4} width={220} height={60}>
                        <div
                          style={{
                            background: 'rgba(30,30,46,0.95)',
                            border: '1px solid rgba(137,180,250,0.3)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            color: '#cdd6f4',
                            lineHeight: 1.4,
                          }}
                        >
                          {node.description.slice(0, 100)}
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

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '6px 12px',
          borderTop: '1px solid var(--vscode-panel-border)',
          background: 'var(--vscode-sideBar-background)',
          fontSize: 11,
          opacity: 0.7,
          flexShrink: 0,
        }}
      >
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                display: 'inline-block',
              }}
            />
            {type}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          Scroll to zoom · Drag to pan · Click node for details
        </span>
      </div>
    </div>
  );
}
