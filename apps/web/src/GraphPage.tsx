import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import dagre from "dagre";
import { ArrowRight, Info } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { courseUnitCodes, unitLevel, type Expr } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { compareCodes, Note, PageHead } from "./ui";

const NODE_WIDTH = 200;
const COLUMN_GAP = 290;
const ROW_GAP = 82;

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
  const plan = usePlanStore((state) => state.plan);
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  useEffect(() => setSelected(null), [plan.course.code, plan.course.version]);
  const { nodes, edges, levels } = useMemo(() => {
    const codes = new Set(course ? courseUnitCodes(course) : []);
    for (const entry of plan.entries) codes.add(entry.unit);
    const queue = [...codes];
    for (const code of queue) {
      const unit = catalog.units[code];
      if (!unit) continue;
      for (const prerequisite of refs(unit.requisites.prerequisite)) {
        if (catalog.units[prerequisite] && !codes.has(prerequisite)) {
          codes.add(prerequisite);
          queue.push(prerequisite);
        }
      }
    }
    const all = Object.values(catalog.units).filter((unit) =>
      codes.has(unit.code),
    );
    const levels = [...new Set(all.map((unit) => unitLevel(unit)))].sort(
      (a, b) => a - b,
    );
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 22 });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const unit of all)
      graph.setNode(unit.code, { width: NODE_WIDTH, height: 60 });
    const connections: Edge[] = [];
    for (const unit of all)
      for (const source of [...new Set(refs(unit.requisites.prerequisite))]) {
        if (!codes.has(source)) continue;
        graph.setEdge(source, unit.code);
        connections.push({
          id: `${source}-${unit.code}`,
          source,
          target: unit.code,
          type: "smoothstep",
        });
      }
    dagre.layout(graph);
    const labels: Node[] = levels.map((level, index) => ({
      id: `level-${level}`,
      position: { x: index * COLUMN_GAP, y: 0 },
      data: { label: `Level ${level}` },
      className: "level-label",
      selectable: false,
      draggable: false,
      connectable: false,
      focusable: false,
    }));
    const positioned: Node[] = levels.flatMap((level, levelIndex) =>
      all
        .filter((unit) => unitLevel(unit) === level)
        .sort(
          (a, b) =>
            graph.node(a.code).y - graph.node(b.code).y ||
            compareCodes(a.code, b.code),
        )
        .map((unit, unitIndex) => ({
          id: unit.code,
          position: { x: levelIndex * COLUMN_GAP, y: 56 + unitIndex * ROW_GAP },
          data: {
            label: (
              <div className="node-label">
                <span className="code">{unit.code}</span>
                <span>{unit.title}</span>
              </div>
            ),
          },
          className: `unit-node${unit.verified ? "" : " unverified"}`,
          draggable: false,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: { width: NODE_WIDTH },
        })),
    );
    return { nodes: [...labels, ...positioned], edges: connections, levels };
  }, [course, plan.entries]);

  const related = useMemo(() => {
    const up = new Set<string>();
    const down = new Set<string>();
    if (!selected) return { up, down };
    const walk = (code: string, set: Set<string>, forward: boolean) => {
      for (const edge of edges) {
        const [from, to] = forward
          ? [edge.source, edge.target]
          : [edge.target, edge.source];
        if (from === code && !set.has(to)) {
          set.add(to);
          walk(to, set, forward);
        }
      }
    };
    walk(selected, up, false);
    walk(selected, down, true);
    return { up, down };
  }, [edges, selected]);

  const lit = (code: string) =>
    code === selected || related.up.has(code) || related.down.has(code);
  const shownNodes = nodes.map((node) =>
    node.id.startsWith("level-")
      ? node
      : {
          ...node,
          className: `${node.className ?? ""}${selected === node.id ? " picked" : ""}${related.up.has(node.id) ? " before" : ""}${related.down.has(node.id) ? " after" : ""}${selected && !lit(node.id) ? " faded" : ""}`,
        },
  );
  const shownEdges = edges.map((edge) => ({
    ...edge,
    className:
      selected && !(lit(edge.source) && lit(edge.target)) ? "faded" : "",
  }));
  const selectedUnit = selected ? catalog.units[selected] : undefined;
  const list = (set: Set<string>) => [...set].sort(compareCodes);

  return (
    <div className="page graph">
      <PageHead
        index="04"
        kicker="Graph"
        title={
          <>
            What unlocks <em>what.</em>
          </>
        }
        lede="Units laid out by year level. Select one to light up everything it needs and everything it opens."
      />
      {edges.length === 0 && (
        <Note tone="warn" icon={<Info size={15} />}>
          No prerequisite has been verified yet, so the graph has no links. An
          empty graph does <strong>not</strong> mean these units have no
          prerequisites.
        </Note>
      )}
      <div className="graph-layout" data-tour="graph">
        <div className="canvas" aria-label="Prerequisite graph">
          <ReactFlow
            nodes={shownNodes}
            edges={shownEdges}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            nodesConnectable={false}
            nodesDraggable={false}
            onNodeClick={(_, node) =>
              node.id.startsWith("level-") ? undefined : setSelected(node.id)
            }
            onPaneClick={() => setSelected(null)}
          >
            <Background gap={24} size={1.2} color="var(--rule-strong)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="graph-side" aria-live="polite">
          {selectedUnit ? (
            <>
              <p className="kicker">
                <span>●</span>Selected
              </p>
              <h2>
                <span className="code">{selectedUnit.code}</span>
                {selectedUnit.title}
              </h2>
              <dl className="relations">
                <div>
                  <dt>Needs first</dt>
                  <dd>
                    {related.up.size
                      ? list(related.up).join(", ")
                      : "Nothing confirmed"}
                  </dd>
                </div>
                <div>
                  <dt>Opens up</dt>
                  <dd>
                    {related.down.size
                      ? list(related.down).join(", ")
                      : "Nothing confirmed"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="button ghost"
                onClick={() => openUnit(selectedUnit.code)}
              >
                Unit details <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <p className="kicker">
                <span>○</span>Nothing selected
              </p>
              <p className="muted">
                Click a unit in the graph, or pick one here.
              </p>
            </>
          )}
          <label className="field compact">
            <span>Jump to unit</span>
            <select
              value={selected ?? ""}
              onChange={(event) => setSelected(event.target.value || null)}
            >
              <option value="">Choose a unit…</option>
              {Object.keys(catalog.units)
                .sort(compareCodes)
                .map((code) => (
                  <option key={code} value={code}>
                    {code} — {catalog.units[code]!.title}
                  </option>
                ))}
            </select>
          </label>
          <p className="mono-label">
            {nodes.length - levels.length} units · {edges.length} verified links
          </p>
        </aside>
      </div>
    </div>
  );
}
