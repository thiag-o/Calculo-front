// The values of the last "Calcular" on the canvas (E5-21; design §12, "Tela de debug"): what each node of the trace gave,
// already as text for the screen. Pure: the canvas draws it (nodes.tsx and the group node).
import type { Schemas } from '../../../api';
import type { LastUnitRun, UnitRun } from '../../unit-run';
import { formatValue, variableTypes } from '../../values';

type Value = Schemas['Value'];
type TraceNode = UnitRun['nodes'][number];

export type NodeRunStatus = Schemas['NodeRunStatus'];
export type RecordRunStatus = UnitRun['status'];

/** A value a node gave, by name: `pontos` and `1.225,50`. */
export interface RunValue {
  name: string;
  text: string;
}

/** What a node of the canvas shows after the last run. */
export interface NodeRunView {
  /** The node of the trace: a Calculation, a Decision Table, a Fonte or a group. */
  kind: TraceNode['type'];
  status: NodeRunStatus;
  /** A block: its outputs. A group: its Output. */
  values: RunValue[];
  /** A Decision Table that ran: the rule that matched (from 1), or `null` when none did. Absent for other nodes. */
  matchedRule?: number | null;
  /** A Fonte that ran: how many lines it found. */
  rowsFound?: number;
  /** The failure of the block, in pt-BR (from the trace). */
  error: string | null;
}

/** The values of the last run, by node id, and the status of the record. */
export interface RunViews {
  record: RecordRunStatus;
  nodes: ReadonlyMap<string, NodeRunView>;
}

/** The views of every node of the trace, groups and what is inside them included. */
export function runViews(run: LastUnitRun): RunViews {
  const types = variableTypes(run.definition, run.symbols);
  const values = (entries: Record<string, Value>): RunValue[] =>
    Object.entries(entries).map(([name, value]) => ({ name, text: formatValue(value, types.get(name)) }));
  const nodes = new Map<string, NodeRunView>();
  const visit = (list: readonly TraceNode[]) => {
    for (const node of list) {
      if (node.type === 'group') {
        nodes.set(node.node_id, { kind: 'group', status: node.status, values: values(node.outputs), error: null });
        visit(node.nodes);
        continue;
      }
      const ran = node.status === 'ok' || node.status === 'warning';
      const view: NodeRunView = { kind: node.type, status: node.status, values: values(node.values), error: node.error?.message ?? null };
      if (node.type === 'decision_table' && ran) view.matchedRule = node.matched_rule;
      if (node.type === 'source' && ran) view.rowsFound = node.rows_found;
      nodes.set(node.node_id, view);
    }
  };
  visit(run.trace.nodes);
  return { record: run.trace.status, nodes };
}
