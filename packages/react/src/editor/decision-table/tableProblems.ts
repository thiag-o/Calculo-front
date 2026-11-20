// Where each problem of a Decision Table goes: a cell of the grid, a rule, a field of the properties or the table as a
// whole. The `path` of a problem points into the definition that was analyzed (`analyzedDefinition`), which may be a
// little older than the one on screen (the analysis of the latest change is on the way, 400 ms). The rules and the
// columns the edit did not touch are the same objects in both, so a moved rule keeps its marks, and a removed one loses
// them instead of passing them to its neighbour.
import type { WorkflowDefinition, WorkflowProblem } from '../draft';
import { findTable, type DecisionTableNode } from './tableModel';

const NODE_PATH = /^root\.nodes\[(\d+)\]/;
const CELL = /^\.rules\[(\d+)\]\.(when|then)\[(\d+)\]$/;
const RULE = /^\.rules\[(\d+)\]$/;
const CONDITION = /^\.conditions\[(\d+)\]\.expression$/;
const RESULT = /^\.results\[(\d+)\]\.(name|type|scale|default_value)$/;
const RESULT_ITSELF = /^\.results\[(\d+)\]$/;
const NODE_FIELD = /^\.(name|description|hit_policy|rounding_mode|error_policy)$/;

/** A place in the table: a cell (`row`, `column` with the conditions first), a rule, a property field or the table. */
export type TablePlace =
  | { kind: 'cell'; row: number; column: number }
  | { kind: 'rule'; row: number }
  | { kind: 'condition'; index: number }
  | { kind: 'result'; index: number; field: 'name' | 'type' | 'scale' | 'default_value' | null }
  | { kind: 'field'; field: 'name' | 'description' | 'hit_policy' | 'rounding_mode' | 'error_policy' }
  | { kind: 'table' };

export interface TableProblems {
  /** By `cellKey(row, column)`. */
  cells: ReadonlyMap<string, readonly WorkflowProblem[]>;
  /** By rule index (problems of the rule itself, like `rule_width`). */
  rules: ReadonlyMap<number, readonly WorkflowProblem[]>;
  /** By property field key (`fieldKey`). */
  fields: ReadonlyMap<string, readonly WorkflowProblem[]>;
  /** Problems of the table as a whole (no rules, a cycle…) and of fields the screen does not show. */
  table: readonly WorkflowProblem[];
  /** How many problems are in the cells and rules (shown in the grid). */
  inGrid: number;
}

export const NO_TABLE_PROBLEMS: TableProblems = { cells: new Map(), rules: new Map(), fields: new Map(), table: [], inGrid: 0 };

export function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/** The key of a property field: `name`, `condition:0`, `result:1:name`… */
export function fieldKey(place: TablePlace): string {
  switch (place.kind) {
    case 'field':
      return place.field;
    case 'condition':
      return `condition:${place.index}`;
    case 'result':
      return `result:${place.index}:${place.field ?? 'name'}`;
    default:
      return place.kind;
  }
}

/**
 * The index an element had in the analyzed list, in the current list: where the same object is now (it moved), the same
 * index when it was edited in place, or `undefined` when it is gone (its slot now holds another element that was already
 * in the analyzed list somewhere else).
 */
function currentIndex<T>(analyzed: readonly T[] | undefined, current: readonly T[], index: number): number | undefined {
  const element = analyzed?.[index];
  if (element !== undefined) {
    const moved = current.indexOf(element);
    if (moved >= 0) return moved;
  }
  if (index >= current.length) return undefined;
  const occupant = current[index]!;
  const occupantWas = analyzed ? analyzed.indexOf(occupant) : -1;
  return occupantWas >= 0 && occupantWas !== index ? undefined : index;
}

/**
 * The place of a path of the table in the current table. `analyzed` is the table as it was analyzed (the same id in
 * `analyzedDefinition`); `rest` is the path after `root.nodes[i]`. `null` when the place no longer exists.
 */
export function placeOf(rest: string, analyzed: DecisionTableNode | undefined, current: DecisionTableNode): TablePlace | null {
  let match = CELL.exec(rest);
  if (match) {
    const row = currentIndex(analyzed?.rules, current.rules, Number(match[1]));
    const condition = match[2] === 'when';
    const column = condition
      ? currentIndex(analyzed?.conditions, current.conditions, Number(match[3]))
      : currentIndex(analyzed?.results, current.results, Number(match[3]));
    if (row === undefined || column === undefined) return null;
    return { kind: 'cell', row, column: condition ? column : current.conditions.length + column };
  }
  match = RULE.exec(rest);
  if (match) {
    const row = currentIndex(analyzed?.rules, current.rules, Number(match[1]));
    return row === undefined ? null : { kind: 'rule', row };
  }
  match = CONDITION.exec(rest);
  if (match) {
    const index = currentIndex(analyzed?.conditions, current.conditions, Number(match[1]));
    return index === undefined ? null : { kind: 'condition', index };
  }
  match = RESULT.exec(rest) ?? RESULT_ITSELF.exec(rest);
  if (match) {
    const index = currentIndex(analyzed?.results, current.results, Number(match[1]));
    const field = (match[2] as 'name' | 'type' | 'scale' | 'default_value' | undefined) ?? null;
    return index === undefined ? null : { kind: 'result', index, field };
  }
  match = NODE_FIELD.exec(rest);
  if (match) return { kind: 'field', field: match[1] as 'name' | 'description' | 'hit_policy' | 'rounding_mode' | 'error_policy' };
  return { kind: 'table' };
}

/**
 * The place a path (of a problem or of the selection) points to in the table `nodeId`, or `null` when it is about
 * something else. `analyzedDefinition` is where the path was written; `current` is the table on screen.
 */
export function placeOfPath(
  path: string | null,
  nodeId: string,
  analyzedDefinition: WorkflowDefinition,
  current: DecisionTableNode,
  problemNodeId: string | null = null,
): TablePlace | null {
  const match = path ? NODE_PATH.exec(path) : null;
  const analyzedNode = match ? analyzedDefinition.root.nodes[Number(match[1])] : undefined;
  const owner = problemNodeId ?? analyzedNode?.id;
  if (owner !== nodeId) return null;
  if (!match || !path) return { kind: 'table' };
  const analyzed = analyzedNode && analyzedNode.id === nodeId && analyzedNode.type === 'decision_table' ? analyzedNode : findTable(analyzedDefinition, nodeId)?.node;
  return placeOf(path.slice(match[0].length), analyzed, current);
}

function add<K>(map: Map<K, WorkflowProblem[]>, key: K, problem: WorkflowProblem) {
  const list = map.get(key);
  if (list) list.push(problem);
  else map.set(key, [problem]);
}

/** The problems of the table `nodeId`, each in its place on screen. */
export function tableProblems(
  problems: readonly WorkflowProblem[],
  analyzedDefinition: WorkflowDefinition,
  current: DecisionTableNode,
): TableProblems {
  const cells = new Map<string, WorkflowProblem[]>();
  const rules = new Map<number, WorkflowProblem[]>();
  const fields = new Map<string, WorkflowProblem[]>();
  const table: WorkflowProblem[] = [];
  let inGrid = 0;
  for (const problem of problems) {
    const place = placeOfPath(problem.path, current.id, analyzedDefinition, current, problem.node_id);
    if (!place) continue;
    switch (place.kind) {
      case 'cell':
        add(cells, cellKey(place.row, place.column), problem);
        inGrid++;
        break;
      case 'rule':
        add(rules, place.row, problem);
        inGrid++;
        break;
      case 'table':
        table.push(problem);
        break;
      default:
        add(fields, fieldKey(place), problem);
    }
  }
  return { cells, rules, fields, table, inGrid };
}

/**
 * Whether a `path` (of a problem) points to a cell or a rule of a Decision Table: the screen opens the grid to show it
 * (E4-22). The block is the `root.nodes[i]` of the definition the path was written in.
 */
export function isGridPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const match = NODE_PATH.exec(path);
  if (!match) return false;
  const rest = path.slice(match[0].length);
  return CELL.test(rest) || RULE.test(rest);
}
