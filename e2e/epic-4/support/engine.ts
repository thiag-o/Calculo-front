// The analysis and the unit run of the epic 4 simulation (pnpm e2e), over the formula reader of formula.ts: symbols,
// dependencies, order and problems of a definition, and "Calcular" of one record, like the backend's engine
// (../backend/docs/plano.md, Contratos, "Linguagem de fórmula e motor"). Test support only.
import type { Schemas } from '../../support/contract';
import {
  EvaluationFailure,
  FormulaSyntaxError,
  cellExpressions,
  cellMatches,
  checkExpression,
  evaluate,
  formatDecimal,
  isDecimal,
  parseCell,
  parseDecimal,
  parseFormula,
  readNames,
  roundTo,
  type Expression,
  type FormulaProblem,
  type RuntimeItem,
  type RuntimeValue,
  type Scope,
} from './formula';

type Definition = Schemas['WorkflowDefinition'];
type WorkflowNode = Definition['root']['nodes'][number];
type Symbol = Schemas['Symbol'];
type Problem = Schemas['WorkflowProblem'];
export type Analysis = Schemas['Analysis'];
export type UnitRun = Schemas['UnitRunTrace'];
type TraceNode = Schemas['TraceFormulaNode'];
type TraceMessage = Schemas['TraceMessage'];
type Value = Schemas['Value'];

// --- Analysis --------------------------------------------------------------------------------------------------------

/** The variables a definition offers: the inputs (a list and its fields), then each node's outputs, in order. */
function symbolsOf(definition: Definition): Symbol[] {
  const symbols: Symbol[] = [];
  const add = (symbol: Symbol) => {
    if (!symbols.some((known) => known.name === symbol.name)) symbols.push(symbol);
  };
  for (const input of definition.root.inputs) {
    if (input.cardinality === 'linear') {
      add({ name: input.name, type: input.type, scale: input.scale ?? null, cardinality: 'linear', list: null, origin: 'input', node_id: null, group_id: null });
    } else {
      add({ name: input.name, type: null, scale: null, cardinality: 'multiple', list: null, origin: 'input', node_id: null, group_id: null });
      for (const field of input.fields) {
        add({ name: field.name, type: field.type, scale: field.scale ?? null, cardinality: 'multiple', list: input.name, origin: 'input', node_id: null, group_id: null });
      }
    }
  }
  for (const node of definition.root.nodes) {
    if (node.type === 'calculation') {
      const { name, type, scale } = node.output;
      add({ name, type, scale: scale ?? null, cardinality: 'linear', list: null, origin: 'calculation', node_id: node.id, group_id: null });
    } else if (node.type === 'decision_table') {
      for (const result of node.results) {
        add({
          name: result.name,
          type: result.type,
          scale: result.scale ?? null,
          cardinality: 'linear',
          list: null,
          origin: 'decision_table',
          node_id: node.id,
          group_id: null,
        });
      }
    }
  }
  return symbols;
}

/** One formula of a node: where it is in the document and what it is. */
interface NodeFormula {
  path: string;
  source: string;
  kind: 'formula' | 'cell';
  /** Empty is a problem only in a Calculation's expression and in a condition column. */
  required: boolean;
}

function formulasOf(node: WorkflowNode, index: number): NodeFormula[] {
  const base = `root.nodes[${index}]`;
  if (node.type === 'calculation') {
    const formulas: NodeFormula[] = [{ path: `${base}.expression`, source: node.expression, kind: 'formula', required: true }];
    if (node.default_value !== null) formulas.push({ path: `${base}.default_value`, source: node.default_value, kind: 'formula', required: false });
    return formulas;
  }
  if (node.type !== 'decision_table') return [];
  return [
    ...node.conditions.map((condition, column) => ({
      path: `${base}.conditions[${column}].expression`,
      source: condition.expression,
      kind: 'formula' as const,
      required: true,
    })),
    ...node.rules.flatMap((rule, row) => [
      ...rule.when.map((cell, column) => ({ path: `${base}.rules[${row}].when[${column}]`, source: cell, kind: 'cell' as const, required: false })),
      ...rule.then.map((cell, column) => ({ path: `${base}.rules[${row}].then[${column}]`, source: cell, kind: 'formula' as const, required: false })),
    ]),
  ];
}

/** The expressions of one formula, or the syntax problem. Empty optional formulas have none. */
function read(formula: NodeFormula): { expressions: Expression[]; problem?: FormulaProblem } {
  if (formula.source.trim() === '') {
    return formula.required
      ? { expressions: [], problem: { code: 'formula_empty', message: 'A fórmula está vazia.', start: 0, end: 0 } }
      : { expressions: [] };
  }
  try {
    return { expressions: formula.kind === 'cell' ? cellExpressions(parseCell(formula.source)) : [parseFormula(formula.source)] };
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
    return { expressions: [], problem: { code: 'syntax_error', message: error.message, start: error.start, end: error.end } };
  }
}

/** Problems, symbols, dependencies and order of a definition (`POST .../draft/analysis` and the draft). */
export function analyze(definition: Definition): Analysis {
  const symbols = symbolsOf(definition);
  const known = new Set(symbols.map((symbol) => symbol.name));
  const problems: Problem[] = [];
  const dependencies: Schemas['Dependency'][] = [];

  definition.root.nodes.forEach((node, index) => {
    const reads = new Set<string>();
    for (const formula of formulasOf(node, index)) {
      const { expressions, problem } = read(formula);
      const found: FormulaProblem[] = problem ? [problem] : [];
      for (const expression of expressions) {
        readNames(expression, reads);
        found.push(...checkExpression(expression, symbols).problems);
      }
      for (const each of found) problems.push({ ...each, path: formula.path, node_id: node.id, suggestion: null });
    }
    if (node.type === 'decision_table' && (node.rules.length === 0 || node.results.length === 0)) {
      problems.push({
        code: 'empty_decision_table',
        message: `${node.name} precisa de pelo menos uma regra e uma coluna de resultado.`,
        path: `root.nodes[${index}]`,
        node_id: node.id,
        start: null,
        end: null,
        suggestion: null,
      });
    }
    dependencies.push({ node_id: node.id, reads: [...reads].filter((name) => known.has(name)).sort() });
  });

  return { problems, symbols, dependencies, order: order(definition, symbols, dependencies), groups: [] };
}

/** Topological order, the tie broken by the position in `root.nodes`; empty with a cycle. */
function order(definition: Definition, symbols: readonly Symbol[], dependencies: readonly Schemas['Dependency'][]): string[] {
  const producer = new Map(symbols.filter((symbol) => symbol.node_id !== null).map((symbol) => [symbol.name, symbol.node_id as string]));
  const ids = definition.root.nodes.map((node) => node.id);
  const needs = new Map(
    dependencies.map((dependency) => [
      dependency.node_id,
      new Set(dependency.reads.map((name) => producer.get(name)).filter((id): id is string => id !== undefined)),
    ]),
  );
  const done: string[] = [];
  while (done.length < ids.length) {
    const next = ids.find((id) => !done.includes(id) && [...(needs.get(id) ?? [])].every((need) => done.includes(need)));
    if (next === undefined) return [];
    done.push(next);
  }
  return done;
}

// --- Unit run --------------------------------------------------------------------------------------------------------

/** The input values typed in "Calcular", in the API format (numbers as text with a point). */
function inputScope(definition: Definition, inputs: Readonly<Record<string, Value>>): Scope {
  const toRuntime = (value: Value | undefined, type: Schemas['DataType']): RuntimeValue => {
    if (value === null || value === undefined) return null;
    if ((type === 'integer' || type === 'decimal') && typeof value === 'string') return parseDecimal(value);
    return typeof value === 'string' || typeof value === 'boolean' ? value : null;
  };
  const linear = new Map<string, RuntimeValue>();
  const lists = new Map<string, RuntimeItem[]>();
  const fieldList = new Map<string, string>();
  for (const input of definition.root.inputs) {
    const value = inputs[input.name];
    if (input.cardinality === 'linear') {
      linear.set(input.name, toRuntime(value, input.type));
      continue;
    }
    const items = Array.isArray(value) ? value : [];
    lists.set(
      input.name,
      items.map((item) => Object.fromEntries(input.fields.map((field) => [field.name, toRuntime(item[field.name], field.type)]))),
    );
    for (const field of input.fields) fieldList.set(field.name, input.name);
  }
  return { linear, lists, fieldList };
}

/** A node's output value, rounded to the declared places by the node's mode (or the workflow's), as the API sends it. */
function outputValue(value: RuntimeValue, type: Schemas['DataType'], scale: number | null | undefined, mode: Schemas['RoundingMode']): Value {
  if (value === null || Array.isArray(value)) return null;
  if (isDecimal(value)) {
    const places = type === 'integer' ? 0 : (scale ?? 0);
    return formatDecimal(roundTo(value, places, mode), places);
  }
  return value;
}

function asRuntime(value: Value): RuntimeValue {
  if (typeof value === 'string') return parseDecimal(value) ?? value;
  return Array.isArray(value) ? null : value;
}

/** Runs one record (`POST .../draft/unit-runs`) over a definition without problems. Only the `error` policy fails. */
export function runUnit(definition: Definition, analysis: Analysis, inputs: Readonly<Record<string, Value>>): UnitRun {
  const scope = inputScope(definition, inputs);
  const linear = scope.linear as Map<string, RuntimeValue>;
  const mode = definition.settings.rounding.mode;
  const nodes: TraceNode[] = [];
  let failure: TraceMessage | null = null;

  for (const id of analysis.order) {
    const node = definition.root.nodes.find((each) => each.id === id);
    if (!node || (node.type !== 'calculation' && node.type !== 'decision_table')) continue;
    if (failure) {
      nodes.push({ type: node.type, node_id: id, status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null });
      continue;
    }
    const nodeMode = node.rounding_mode ?? mode;
    try {
      if (node.type === 'calculation') {
        const raw = evaluate(parseFormula(node.expression), scope);
        const value = outputValue(raw, node.output.type, node.output.scale, nodeMode);
        if (value === null) throw new EvaluationFailure('null_result', `O resultado de ${node.name} ficou nulo.`);
        linear.set(node.output.name, asRuntime(value));
        nodes.push({ type: 'calculation', node_id: id, status: 'ok', values: { [node.output.name]: value }, matched_rule: null, warnings: [], error: null });
        continue;
      }
      const conditions = node.conditions.map((condition) => evaluate(parseFormula(condition.expression), scope));
      const matched = node.rules
        .map((rule, index) => ({ rule, number: index + 1 }))
        .filter(({ rule }) => rule.when.every((cell, column) => cellMatches(parseCell(cell), conditions[column] ?? null, scope)));
      if (matched.length === 0) throw new EvaluationFailure('no_rule_matched', `Nenhuma regra de ${node.name} casou.`);
      if (node.hit_policy === 'unique' && matched.length > 1) {
        const numbers = matched.map(({ number }) => number);
        const list = `${numbers.slice(0, -1).join(', ')} e ${numbers[numbers.length - 1]}`;
        throw new EvaluationFailure('multiple_rules_matched', `As regras ${list} casaram.`);
      }
      const chosen = matched[0] as (typeof matched)[number];
      const values = node.results.map((result, column) => {
        const cell = chosen.rule.then[column] ?? '';
        const raw = cell.trim() === '' ? null : evaluate(parseFormula(cell), scope);
        return { name: result.name, value: outputValue(raw, result.type, result.scale, nodeMode) };
      });
      for (const { name, value } of values) linear.set(name, asRuntime(value));
      nodes.push({
        type: 'decision_table',
        node_id: id,
        status: 'ok',
        values: Object.fromEntries(values.map(({ name, value }) => [name, value])),
        matched_rule: chosen.number,
        warnings: [],
        error: null,
      });
    } catch (error) {
      if (!(error instanceof EvaluationFailure)) throw error;
      const message = { code: error.code, message: error.message };
      const outputs = node.type === 'calculation' ? [node.output.name] : node.results.map((result) => result.name);
      nodes.push({
        type: node.type,
        node_id: id,
        status: 'error',
        values: Object.fromEntries(outputs.map((name) => [name, null])),
        matched_rule: null,
        warnings: [],
        error: message,
      });
      failure = { node_id: id, ...message, values: {} };
    }
  }

  const declared = definition.root.inputs.map((input) => ({ variable: input.name, value: inputs[input.name] ?? null, origin: null }));
  const inputHash = `sha256:${'0'.repeat(64)}`;
  if (failure) {
    return { status: 'error', record_key: null, inputs: declared, nodes, outputs: {}, input_hash: inputHash, output_hash: null, error: failure, warnings: [] };
  }
  const outputs: Record<string, Value> = {};
  for (const field of definition.root.output.fields) {
    const produced = nodes.map((node) => node.values[field.variable]).find((value) => value !== undefined);
    outputs[field.name] = produced !== undefined ? produced : (inputs[field.variable] ?? null);
  }
  return { status: 'ok', record_key: null, inputs: declared, nodes, outputs, input_hash: inputHash, output_hash: inputHash, error: null, warnings: [] };
}
