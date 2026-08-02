/**
 * React Flow wrapper.
 * ponytail: 用 reactflow 提供的 ReactFlow + Controls + Background，不加自定义 renderer。
 */

import { useCallback, memo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { GraphNode, GraphEdge } from '@/types/graph';
import { useDashboardStore } from '@/store/useDashboardStore';
import { NodeDetail } from './NodeDetail';
import { Minimap } from './Minimap';
import styles from './StructureGraph.module.css';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const GraphCanvas = memo(function GraphCanvas({ nodes, edges }: GraphCanvasProps) {
  const focusNode = useDashboardStore((s) => s.focusNode);

  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    position: { x: Math.random() * 400, y: Math.random() * 300 },
    data: { label: n.label, kind: n.kind },
  }));

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.kind,
    style: { stroke: '#666', strokeWidth: 1 },
    labelStyle: { fontSize: 9, fill: '#888' },
    labelBgStyle: { fill: '#1f2233' },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 3,
  }));

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => focusNode(node.id),
    [focusNode],
  );

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background gap={16} color="#2a2d3e" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <NodeDetail />
      <Minimap />
    </div>
  );
});
