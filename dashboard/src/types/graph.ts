/**
 * Graph domain types.
 * ponytail: 按 src/core/types.ts 形状构造但独立于真实 .mumuspec 文件。
 */

export type NodeKind = 'SpecModule' | 'Constraint' | 'Change' | 'Knowledge';

export interface ChangeEvent {
  id: string;
  changeName: string;
  timestamp: string; // ISO
  type: 'created' | 'phased' | 'archived';
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  summary: string;
  metadata: Record<string, string>;
  changeEvents?: ChangeEvent[];
}

export type EdgeKind = 'GOVERNED_BY' | 'DEPENDS_ON' | 'DERIVED_FROM';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
