// The Decision Table edits (E4-8, E4-22), as pure functions over the workflow definition: each one returns a new
// definition, keeping the untouched rules, columns and nodes (the same objects), so the problems of a slightly older
// analysis can still be placed (see tableProblems.ts) and the grid rows that did not change are not drawn again.
import type { Schemas } from '../../api';
import type { WorkflowDefinition } from '../draft';

export type DecisionTableNode = Schemas['DecisionTableNode'];
export type DecisionCondition = Schemas['DecisionCondition'];
export type DecisionResult = Schemas['DecisionResult'];
export type DecisionRule = Schemas['DecisionRule'];
export type DataType = Schemas['DataType'];

/** Contract limits (E4-12): rules, condition columns and result columns of a table; characters of a cell. */
export const MAX_RULES = 500;
export const MAX_CONDITIONS = 30;
export const MAX_RESULTS = 20;
export const MAX_CELL_LENGTH = 10000;
/** A node name has 1 to 200 characters, the description up to 500 (E4-12). */
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;
/** A variable name (result column): the contract pattern. Anything else is a shape error (`422 invalid_data`). */
export const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/;
export const MAX_SCALE = 18;

/** The text cut at the cell limit (10,000 UTF-16 units), without splitting a surrogate pair at the cut. */
export function cutCell(value: string): string {
  if (value.length <= MAX_CELL_LENGTH) return value;
  const last = value.charCodeAt(MAX_CELL_LENGTH - 1);
  const highSurrogate = last >= 0xd800 && last <= 0xdbff;
  return value.slice(0, highSurrogate ? MAX_CELL_LENGTH - 1 : MAX_CELL_LENGTH);
}

/** The Decision Table with this id, and its position in `root.nodes`. */
export function findTable(definition: WorkflowDefinition, nodeId: string): { node: DecisionTableNode; index: number } | null {
  const index = definition.root.nodes.findIndex((node) => node.id === nodeId);
  const node = definition.root.nodes[index];
  return node && node.type === 'decision_table' ? { node, index } : null;
}

/** The definition with the table changed by `update` (the same definition when the table is not there). */
export function updateTable(
  definition: WorkflowDefinition,
  nodeId: string,
  update: (node: DecisionTableNode) => DecisionTableNode,
): WorkflowDefinition {
  const found = findTable(definition, nodeId);
  if (!found) return definition;
  const next = update(found.node);
  if (next === found.node) return definition;
  const nodes = definition.root.nodes.slice();
  nodes[found.index] = next;
  return { ...definition, root: { ...definition.root, nodes } };
}

/** How many columns the grid has: the conditions, then the results. */
export function columnCount(node: DecisionTableNode): number {
  return node.conditions.length + node.results.length;
}

/** The text of a cell; `column` counts the conditions first, then the results. A missing cell reads as empty. */
export function cellValue(node: DecisionTableNode, rule: DecisionRule, column: number): string {
  const conditions = node.conditions.length;
  return (column < conditions ? rule.when[column] : rule.then[column - conditions]) ?? '';
}

/** The cells of a rule with exactly one per column (missing ones empty, extra ones dropped). */
function fitRule(node: DecisionTableNode, rule: DecisionRule): DecisionRule {
  const when = Array.from({ length: node.conditions.length }, (_, index) => rule.when[index] ?? '');
  const then = Array.from({ length: node.results.length }, (_, index) => rule.then[index] ?? '');
  return { when, then };
}

function emptyRule(node: DecisionTableNode): DecisionRule {
  return { when: node.conditions.map(() => ''), then: node.results.map(() => '') };
}

/** The table with the cells of a block set from `(row, column)`. Rows past the end become new rules (up to 500). */
export function setCells(node: DecisionTableNode, row: number, column: number, block: readonly (readonly string[])[]): DecisionTableNode {
  const columns = columnCount(node);
  const lastRow = Math.min(row + block.length, MAX_RULES);
  if (block.length === 0 || column >= columns || row >= lastRow) return node;
  const rules = node.rules.slice();
  for (let index = rules.length; index < lastRow; index++) rules.push(emptyRule(node));
  const conditions = node.conditions.length;
  for (let target = row; target < lastRow; target++) {
    const values = block[target - row] ?? [];
    const original = rules[target]!;
    const rule = fitRule(node, original);
    for (let offset = 0; offset < values.length && column + offset < columns; offset++) {
      const at = column + offset;
      const value = cutCell(values[offset] ?? '');
      if (at < conditions) rule.when[at] = value;
      else rule.then[at - conditions] = value;
    }
    rules[target] = sameCells(rule, original) ? original : rule;
  }
  return rules.length === node.rules.length && rules.every((rule, index) => rule === node.rules[index]) ? node : { ...node, rules };
}

function sameCells(a: DecisionRule, b: DecisionRule): boolean {
  return (
    a.when.length === b.when.length &&
    a.then.length === b.then.length &&
    a.when.every((cell, index) => cell === b.when[index]) &&
    a.then.every((cell, index) => cell === b.then[index])
  );
}

/** The table with one cell changed. */
export function setCell(node: DecisionTableNode, row: number, column: number, value: string): DecisionTableNode {
  if (row >= node.rules.length) return node;
  return setCells(node, row, column, [[value]]);
}

/** A new empty rule at `index` (the end when omitted). */
export function insertRule(node: DecisionTableNode, index = node.rules.length): DecisionTableNode {
  if (node.rules.length >= MAX_RULES) return node;
  const rules = node.rules.slice();
  rules.splice(Math.max(0, Math.min(index, rules.length)), 0, emptyRule(node));
  return { ...node, rules };
}

export function removeRule(node: DecisionTableNode, index: number): DecisionTableNode {
  if (index < 0 || index >= node.rules.length) return node;
  return { ...node, rules: node.rules.filter((_, position) => position !== index) };
}

/** The rule at `index` one place up (`-1`) or down (`1`). */
export function moveRule(node: DecisionTableNode, index: number, direction: -1 | 1): DecisionTableNode {
  const target = index + direction;
  if (index < 0 || index >= node.rules.length || target < 0 || target >= node.rules.length) return node;
  const rules = node.rules.slice();
  [rules[index], rules[target]] = [rules[target]!, rules[index]!];
  return { ...node, rules };
}

/** A new condition column at the end of the conditions, with an empty cell in every rule. */
export function addCondition(node: DecisionTableNode, expression = ''): DecisionTableNode {
  if (node.conditions.length >= MAX_CONDITIONS) return node;
  const at = node.conditions.length;
  return {
    ...node,
    conditions: [...node.conditions, { expression }],
    rules: node.rules.map((rule) => {
      const when = fitRule(node, rule).when;
      when.splice(at, 0, '');
      return { when, then: rule.then };
    }),
  };
}

/** A new result column at the end, with an empty cell (a deliberate null) in every rule. */
export function addResult(node: DecisionTableNode, result: DecisionResult): DecisionTableNode {
  if (node.results.length >= MAX_RESULTS) return node;
  const at = node.results.length;
  return {
    ...node,
    results: [...node.results, result],
    rules: node.rules.map((rule) => {
      const then = fitRule(node, rule).then;
      then.splice(at, 0, '');
      return { when: rule.when, then };
    }),
  };
}

/** The table without the column (conditions first, then results) and its cell in every rule. */
export function removeColumn(node: DecisionTableNode, column: number): DecisionTableNode {
  const conditions = node.conditions.length;
  if (column < 0 || column >= columnCount(node)) return node;
  if (column < conditions) {
    return {
      ...node,
      conditions: node.conditions.filter((_, index) => index !== column),
      rules: node.rules.map((rule) => ({ when: rule.when.filter((_, index) => index !== column), then: rule.then })),
    };
  }
  const result = column - conditions;
  return {
    ...node,
    results: node.results.filter((_, index) => index !== result),
    rules: node.rules.map((rule) => ({ when: rule.when, then: rule.then.filter((_, index) => index !== result) })),
  };
}

export function setCondition(node: DecisionTableNode, index: number, expression: string): DecisionTableNode {
  const current = node.conditions[index];
  if (!current || current.expression === expression) return node;
  const conditions = node.conditions.slice();
  conditions[index] = { ...current, expression };
  return { ...node, conditions };
}

export function setResult(node: DecisionTableNode, index: number, update: (result: DecisionResult) => DecisionResult): DecisionTableNode {
  const current = node.results[index];
  if (!current) return node;
  const next = update(current);
  if (next === current) return node;
  const results = node.results.slice();
  results[index] = next;
  return { ...node, results };
}

/**
 * The result with another type. `scale` exists only on `decimal` (anything else is a shape error): it is dropped from
 * the other types and, on `decimal`, kept or set to the workflow's default.
 */
export function withType(result: DecisionResult, type: DataType, defaultScale: number): DecisionResult {
  if (result.type === type) return result;
  const { scale, ...rest } = result;
  if (type !== 'decimal') return { ...rest, type };
  return { ...rest, type, scale: typeof scale === 'number' ? scale : defaultScale };
}
