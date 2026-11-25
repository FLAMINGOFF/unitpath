import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  type Edge,
  type Node,
} from "@xyflow/react";
import dagre from "dagre";
import { GitBranch, Info } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { unitLevel, type Expr } from "@unitpath/engine";
import { catalog } from "./catalog";

function refs(expr: Expr | null | "TODO"): string[] {
  if (!expr || expr === "TODO") return [];
  if ("unit" in expr) return [expr.unit];
  if ("all" in expr) return expr.all.flatMap(refs);
  if ("any" in expr) return expr.any.flatMap(refs);
  if ("atLeast" in expr) return expr.atLeast.of.flatMap(refs);
  return [];
}

export function GraphPage({ openUnit }: { openUnit: (code: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => {
    const all = Object.values(catalog.units);
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: "LR",
      ranksep: 80,
      nodesep: 22,
      marginx: 30,
      marginy: 30,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const unit of all)
      graph.setNode(unit.code, { width: 185, height: 64 });
    const connections: Edge[] = [];
    for (const unit of all)
      for (const source of refs(unit.requisites.prerequisite)) {
        if (!catalog.units[source]) continue;
        graph.setEdge(source, unit.code);
        connections.push({
          id: `${source}-${unit.code}`,
          source,
          target: unit.code,
          type: "smoothstep",
          animated: false,
        });
      }
    dagre.layout(graph);
    const positioned: Node[] = [1, 2, 3].flatMap((level) =>
      all
        .filter((unit) => unitLevel(unit.code) === level)
        .sort(
          (a, b) =>
            graph.node(a.code).y - graph.node(b.code).y ||
            a.code.localeCompare(b.code),
        )
        .map((unit, index) => ({
          id: unit.code,
          position: { x: (level - 1) * 250 + 30, y: index * 87 + 30 },
          data: {
            label: (
              <div className="graph-node-label">
                <strong>{unit.code}</strong>
                <span>{unit.title}</span>
              </div>
            ),
          },
          draggable: false,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: {
            width: 185,
            borderRadius: 12,
            border: "1px solid #dce4e8",
            boxShadow: "0 4px 14px #15212e0a",
            background: "#fff",
          },
        })),
    );
    return { nodes: positioned, edges: connections };
  }, []);
  const highlighted = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    const visit = (code: string, direction: "up" | "down") => {
      if (set.has(code)) return;
      set.add(code);
      for (const edge of edges) {
        if (direction === "down" && edge.source === code)
          visit(edge.target, direction);
        if (direction === "up" && edge.target === code)
          visit(edge.source, direction);
      }
    };
    visit(selected, "up");
    const descendants = new Set<string>();
    const visitDown = (code: string) => {
      if (descendants.has(code)) return;
      descendants.add(code);
      for (const edge of edges)
        if (edge.source === code) visitDown(edge.target);
    };
    visitDown(selected);
    for (const code of descendants) set.add(code);
    return set;
  }, [edges, selected]);
  const shownNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      opacity: selected && !highlighted.has(node.id) ? 0.35 : 1,
      borderColor: selected === node.id ? "#348a80" : "#dce4e8",
    },
  }));
  const shownEdges = edges.map((edge) => ({
    ...edge,
    style: {
      opacity:
        selected &&
        (!highlighted.has(edge.source) || !highlighted.has(edge.target))
          ? 0.2
          : 1,
      stroke: "#529488",
      strokeWidth: 2,
    },
  }));
  return (
    <div className="page graph-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DEPENDENCIES</span>
          <h1>Prerequisite graph</h1>
          <p>
            Explore how units connect. Select a node to highlight its confirmed
            dependencies.
          </p>
        </div>
        <div className="heading-illustration">
          <GitBranch size={42} strokeWidth={1.4} />
        </div>
      </div>
      <div className="warning-box">
        <Info size={19} />
        <span>
          All prerequisite fields are awaiting Handbook verification. The graph
          currently has no confirmed edges; it must not be read as “no
          prerequisites.”
        </span>
      </div>
      <div className="graph-card">
        <div className="graph-toolbar">
          <strong>Applied cybersecurity · 2026</strong>
          <span>
            {nodes.length} units · {edges.length} confirmed links
          </span>
          {selected && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                openUnit(selected);
              }}
            >
              View {selected}
            </button>
          )}
        </div>
        <div className="graph-canvas">
          <ReactFlow
            nodes={shownNodes}
            edges={shownEdges}
            fitView
            nodesConnectable={false}
            nodesDraggable={false}
            onNodeClick={(_, node) => setSelected(node.id)}
            onPaneClick={() => setSelected(null)}
          >
            <Background color="#edf2f3" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
