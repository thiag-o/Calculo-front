// The formula language of the epic 4 simulation (pnpm e2e): a small reader, checker and evaluator of the part of the
// language the epic 4 flows use, so the simulated API answers the analysis and "Calcular" like the backend
// (../backend/docs/plano.md, Contratos, "Linguagem de fórmula e motor"). It is test support, not the product: the front
// never evaluates formulas (the tables, types and problems always come from the API).
//
// What it covers: numbers with exact decimals (BigInt with 18 places), text, verdadeiro/falso/nulo, + - * / ^, the
// functions ARRED, TRUNCAR, ABS, MÍN, MÁX, SOMA, CONTAR, MÉDIA and EXISTE, `campo[]` inside an aggregation, and the
// Decision Table cells (-, literal, =, <>, >, >=, <, <=, ENTRE, EM). Problems: syntax_error, formula_empty,
// unknown_variable, unknown_function and type_mismatch (with the backend's message for text in a sum).
import type { Schemas } from '../../support/contract';

type DataType = Schemas['DataType'];
type Symbol = Schemas['Symbol'];

// --- Exact decimals ------------------------------------------------------------------------------------------------

const PLACES = 18;
const ONE = 10n ** BigInt(PLACES);

/** An exact decimal: `units / 10^18`. */
export interface Decimal {
  units: bigint;
}

const decimal = (units: bigint): Decimal => ({ units });

export function parseDecimal(text: string): Decimal | null {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = (match[3] ?? '').padEnd(PLACES, '0').slice(0, PLACES);
  const units = BigInt(match[2] ?? '0') * ONE + BigInt(fraction || '0');
  return decimal(match[1] ? -units : units);
}

/** Divides with the half away from zero (the multiplication and division rule, E4-4). */
function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d;
  const rounded = (n % d) * 2n >= d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export type RoundingMode = Schemas['RoundingMode'];

/** Rounds to `scale` places with the mode (E4-5). */
export function roundTo(value: Decimal, scale: number, mode: RoundingMode): Decimal {
  const step = 10n ** BigInt(PLACES - scale);
  const negative = value.units < 0n;
  const magnitude = negative ? -value.units : value.units;
  let kept = magnitude / step;
  const rest = magnitude % step;
  if (mode === 'half_up' && rest * 2n >= step) kept += 1n;
  if (mode === 'half_even' && (rest * 2n > step || (rest * 2n === step && kept % 2n === 1n))) kept += 1n;
  const units = kept * step;
  return decimal(negative ? -units : units);
}

/** The API text of a number with exactly `scale` places (`"225.00"`, `"-3"`). */
export function formatDecimal(value: Decimal, scale: number): string {
  const rounded = roundTo(value, scale, 'half_up');
  const negative = rounded.units < 0n;
  const magnitude = negative ? -rounded.units : rounded.units;
  const integer = magnitude / ONE;
  const fraction = (magnitude % ONE).toString().padStart(PLACES, '0').slice(0, scale);
  const sign = negative && magnitude !== 0n ? '-' : '';
  return scale > 0 ? `${sign}${integer}.${fraction}` : `${sign}${integer}`;
}

// --- Reading ---------------------------------------------------------------------------------------------------------

type TokenKind = 'number' | 'text' | 'name' | 'operator' | 'open' | 'close' | 'comma' | 'end';

interface Token {
  kind: TokenKind;
  text: string;
  /** In code points, from 0; `end` exclusive. */
  start: number;
  end: number;
  /** `campo[]`: a name with the brackets glued to it. */
  brackets?: boolean;
}

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
  }
}

const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{N}_]/u;

function tokenize(source: string): Token[] {
  const chars = Array.from(source);
  const tokens: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const char = chars[i] ?? '';
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    const start = i;
    if (/\d/.test(char)) {
      while (/\d/.test(chars[i] ?? '')) i += 1;
      if (chars[i] === '.') {
        i += 1;
        if (!/\d/.test(chars[i] ?? '')) throw new FormulaSyntaxError('Número incompleto.', start, i);
        while (/\d/.test(chars[i] ?? '')) i += 1;
      }
      tokens.push({ kind: 'number', text: chars.slice(start, i).join(''), start, end: i });
      continue;
    }
    if (char === '"') {
      let text = '';
      i += 1;
      for (;;) {
        if (i >= chars.length) throw new FormulaSyntaxError('Texto sem fechar.', start, start + 1);
        if (chars[i] === '"') {
          if (chars[i + 1] === '"') {
            text += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        text += chars[i];
        i += 1;
      }
      tokens.push({ kind: 'text', text, start, end: i });
      continue;
    }
    if (NAME_START.test(char)) {
      while (NAME_PART.test(chars[i] ?? '')) i += 1;
      const text = chars.slice(start, i).join('');
      const brackets = chars[i] === '[' && chars[i + 1] === ']';
      if (brackets) i += 2;
      tokens.push({ kind: 'name', text, start, end: i, brackets });
      continue;
    }
    const two = `${char}${chars[i + 1] ?? ''}`;
    if (two === '<>' || two === '>=' || two === '<=') {
      tokens.push({ kind: 'operator', text: two, start, end: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/^=<>'.includes(char)) tokens.push({ kind: 'operator', text: char, start, end: i + 1 });
    else if (char === '(') tokens.push({ kind: 'open', text: char, start, end: i + 1 });
    else if (char === ')') tokens.push({ kind: 'close', text: char, start, end: i + 1 });
    else if (char === ',') tokens.push({ kind: 'comma', text: char, start, end: i + 1 });
    else throw new FormulaSyntaxError(`Símbolo inesperado: ${char}.`, start, start + 1);
    i += 1;
  }
  tokens.push({ kind: 'end', text: '', start: chars.length, end: chars.length });
  return tokens;
}

export type Expression =
  | { kind: 'number'; text: string; start: number; end: number }
  | { kind: 'text'; value: string; start: number; end: number }
  | { kind: 'boolean'; value: boolean; start: number; end: number }
  | { kind: 'null'; start: number; end: number }
  | { kind: 'variable'; name: string; brackets: boolean; start: number; end: number }
  | { kind: 'call'; name: string; args: Expression[]; start: number; end: number }
  | { kind: 'negate'; operand: Expression; start: number; end: number }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression; start: number; end: number };

const FUNCTIONS = ['ARRED', 'TRUNCAR', 'ABS', 'MIN', 'MAX', 'SOMA', 'CONTAR', 'MEDIA', 'EXISTE'] as const;
type FunctionName = (typeof FUNCTIONS)[number];
const AGGREGATIONS: ReadonlySet<string> = new Set(['SOMA', 'CONTAR', 'MEDIA', 'EXISTE']);

/** `MÍN`, `min` and `Min` are the same function: upper case, without accents. */
function functionKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parseWhole(): Expression {
    const expression = this.additive();
    const next = this.peek();
    if (next.kind !== 'end') throw new FormulaSyntaxError(`Símbolo inesperado: ${next.text}.`, next.start, next.end);
    return expression;
  }

  /** The cell parts reuse the reader up to a token the cell syntax knows (`E` of ENTRE, `,` and `)` of EM). */
  parsePart(): Expression {
    return this.additive();
  }

  peek(): Token {
    return this.tokens[this.position] ?? (this.tokens[this.tokens.length - 1] as Token);
  }

  take(): Token {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  private additive(): Expression {
    let left = this.multiplicative();
    while (this.peek().kind === 'operator' && (this.peek().text === '+' || this.peek().text === '-')) {
      const operator = this.take().text;
      const right = this.multiplicative();
      left = { kind: 'binary', operator, left, right, start: left.start, end: right.end };
    }
    return left;
  }

  private multiplicative(): Expression {
    let left = this.unary();
    while (this.peek().kind === 'operator' && (this.peek().text === '*' || this.peek().text === '/')) {
      const operator = this.take().text;
      const right = this.unary();
      left = { kind: 'binary', operator, left, right, start: left.start, end: right.end };
    }
    return left;
  }

  private unary(): Expression {
    const token = this.peek();
    if (token.kind === 'operator' && token.text === '-') {
      this.take();
      const operand = this.unary();
      return { kind: 'negate', operand, start: token.start, end: operand.end };
    }
    return this.power();
  }

  private power(): Expression {
    const base = this.primary();
    if (this.peek().kind === 'operator' && this.peek().text === '^') {
      this.take();
      const exponent = this.unary();
      return { kind: 'binary', operator: '^', left: base, right: exponent, start: base.start, end: exponent.end };
    }
    return base;
  }

  private primary(): Expression {
    const token = this.take();
    switch (token.kind) {
      case 'number':
        return { kind: 'number', text: token.text, start: token.start, end: token.end };
      case 'text':
        return { kind: 'text', value: token.text, start: token.start, end: token.end };
      case 'open': {
        const inner = this.additive();
        const close = this.take();
        if (close.kind !== 'close') throw new FormulaSyntaxError('Falta fechar o parêntese.', token.start, token.end);
        return { ...inner, start: token.start, end: close.end };
      }
      case 'name': {
        const lower = token.text.toLowerCase();
        if (!token.brackets && this.peek().kind === 'open') return this.call(token);
        if (lower === 'verdadeiro' || lower === 'falso') {
          return { kind: 'boolean', value: lower === 'verdadeiro', start: token.start, end: token.end };
        }
        if (lower === 'nulo') return { kind: 'null', start: token.start, end: token.end };
        return { kind: 'variable', name: token.text, brackets: token.brackets === true, start: token.start, end: token.end };
      }
      default:
        throw new FormulaSyntaxError(
          token.kind === 'end' ? 'A fórmula terminou antes do esperado.' : `Símbolo inesperado: ${token.text}.`,
          token.start,
          token.end,
        );
    }
  }

  private call(name: Token): Expression {
    this.take();
    const args: Expression[] = [];
    if (this.peek().kind !== 'close') {
      for (;;) {
        args.push(this.additive());
        if (this.peek().kind !== 'comma') break;
        this.take();
      }
    }
    const close = this.take();
    if (close.kind !== 'close') throw new FormulaSyntaxError('Falta fechar o parêntese.', name.start, name.end);
    return { kind: 'call', name: name.text, args, start: name.start, end: close.end };
  }
}

export function parseFormula(source: string): Expression {
  return new Parser(tokenize(source)).parseWhole();
}

// --- Decision Table cells --------------------------------------------------------------------------------------------

export type Cell =
  | { kind: 'any' }
  | { kind: 'compare'; operator: '=' | '<>' | '>' | '>=' | '<' | '<='; value: Expression }
  | { kind: 'between'; low: Expression; high: Expression }
  | { kind: 'in'; values: Expression[] };

export function parseCell(source: string): Cell {
  const trimmed = source.trim();
  if (trimmed === '' || trimmed === '-') return { kind: 'any' };
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const first = parser.peek();
  const word = first.kind === 'name' ? first.text.toUpperCase() : '';
  let cell: Cell;
  if (word === 'ENTRE') {
    parser.take();
    const low = parser.parsePart();
    const and = parser.take();
    if (and.kind !== 'name' || and.text.toUpperCase() !== 'E') throw new FormulaSyntaxError('Use ENTRE a E b.', and.start, and.end);
    cell = { kind: 'between', low, high: parser.parsePart() };
  } else if (word === 'EM') {
    parser.take();
    const open = parser.take();
    if (open.kind !== 'open') throw new FormulaSyntaxError('Use EM (a, b).', open.start, open.end);
    const values: Expression[] = [];
    for (;;) {
      values.push(parser.parsePart());
      const next = parser.take();
      if (next.kind === 'close') break;
      if (next.kind !== 'comma') throw new FormulaSyntaxError('Use EM (a, b).', next.start, next.end);
    }
    cell = { kind: 'in', values };
  } else if (first.kind === 'operator' && ['=', '<>', '>', '>=', '<', '<='].includes(first.text)) {
    parser.take();
    cell = { kind: 'compare', operator: first.text as '=', value: parser.parsePart() };
  } else {
    cell = { kind: 'compare', operator: '=', value: parser.parsePart() };
  }
  const end = parser.peek();
  if (end.kind !== 'end') throw new FormulaSyntaxError(`Símbolo inesperado: ${end.text}.`, end.start, end.end);
  return cell;
}

// --- Checking --------------------------------------------------------------------------------------------------------

/** A problem found in one formula, before the path and the node are added. */
export interface FormulaProblem {
  code: Schemas['ProblemCode'];
  message: string;
  start: number | null;
  end: number | null;
}

/** The type a subexpression gives: a value type, a list (`pontuacoes[]`), nulo, or unknown (no cascade). */
type CheckedType = DataType | 'list' | 'null' | 'unknown';

const TYPE_WORDS: Readonly<Record<DataType, string>> = {
  text: 'texto',
  integer: 'inteiro',
  decimal: 'decimal',
  date: 'data',
  datetime: 'data e hora',
  boolean: 'booleano',
};

const isNumber = (type: CheckedType) => type === 'integer' || type === 'decimal' || type === 'null' || type === 'unknown';

/** Collects the variable names a formula reads (a list field by its own name). */
export function readNames(expression: Expression, into: Set<string>): void {
  switch (expression.kind) {
    case 'variable':
      into.add(expression.name);
      return;
    case 'call':
      for (const arg of expression.args) readNames(arg, into);
      return;
    case 'negate':
      readNames(expression.operand, into);
      return;
    case 'binary':
      readNames(expression.left, into);
      readNames(expression.right, into);
      return;
    default:
      return;
  }
}

export function cellExpressions(cell: Cell): Expression[] {
  switch (cell.kind) {
    case 'any':
      return [];
    case 'compare':
      return [cell.value];
    case 'between':
      return [cell.low, cell.high];
    case 'in':
      return cell.values;
  }
}

/** Checks a formula against the known symbols; returns its type and the problems (all the independent ones). */
export function checkExpression(expression: Expression, symbols: readonly Symbol[]): { type: CheckedType; problems: FormulaProblem[] } {
  const problems: FormulaProblem[] = [];
  const byName = new Map(symbols.map((symbol) => [symbol.name, symbol]));

  const visit = (node: Expression, inAggregation: boolean): CheckedType => {
    switch (node.kind) {
      case 'number':
        return node.text.includes('.') ? 'decimal' : 'integer';
      case 'text':
        return 'text';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      case 'variable': {
        const symbol = byName.get(node.name);
        if (!symbol) {
          problems.push({
            code: 'unknown_variable',
            message: `${node.name} não existe neste ponto do fluxo.`,
            start: node.start,
            end: node.end,
          });
          return 'unknown';
        }
        if (symbol.cardinality === 'multiple' && symbol.list === null) return 'list';
        return symbol.type ?? 'unknown';
      }
      case 'negate': {
        const type = visit(node.operand, inAggregation);
        return isNumber(type) ? type : mismatch(node.operand, type);
      }
      case 'binary': {
        const left = visit(node.left, inAggregation);
        const right = visit(node.right, inAggregation);
        if (left === 'unknown' || right === 'unknown') return 'unknown';
        if (!isNumber(left)) return mismatch(node.left, left);
        if (!isNumber(right)) return mismatch(node.right, right);
        if (node.operator === '/') return 'decimal';
        return left === 'decimal' || right === 'decimal' ? 'decimal' : left === 'null' ? right : left;
      }
      case 'call': {
        const key = functionKey(node.name);
        if (!(FUNCTIONS as readonly string[]).includes(key)) {
          problems.push({ code: 'unknown_function', message: `${node.name} não é uma função da linguagem.`, start: node.start, end: node.end });
          return 'unknown';
        }
        const aggregation = AGGREGATIONS.has(key) || ((key === 'MIN' || key === 'MAX') && node.args.length === 1);
        const types = node.args.map((arg) => visit(arg, inAggregation || aggregation));
        if (types.includes('unknown')) return 'unknown';
        switch (key as FunctionName) {
          case 'EXISTE':
            return 'boolean';
          case 'CONTAR':
            return 'integer';
          case 'MEDIA':
            return 'decimal';
          default: {
            const numeric = types.find((type) => type !== 'null' && type !== 'list') ?? 'null';
            const wrong = node.args.findIndex((_, index) => !isNumber(types[index] ?? 'unknown') && types[index] !== 'list');
            if (wrong >= 0) return mismatch(node.args[wrong] as Expression, types[wrong] as CheckedType);
            return key === 'ARRED' || key === 'TRUNCAR' ? (types[0] ?? 'unknown') : numeric;
          }
        }
      }
    }
  };

  const mismatch = (node: Expression, type: CheckedType): CheckedType => {
    const word = type in TYPE_WORDS ? TYPE_WORDS[type as DataType] : 'uma lista';
    const subject = node.kind === 'variable' ? node.name : 'Este trecho';
    problems.push({ code: 'type_mismatch', message: `${subject} é ${word} e não entra em conta.`, start: node.start, end: node.end });
    return 'unknown';
  };

  return { type: visit(expression, false), problems };
}

// --- Evaluating ------------------------------------------------------------------------------------------------------

/** A value while evaluating: a number, text, boolean, nulo, or a list of items (records). */
export type RuntimeValue = Decimal | string | boolean | null | RuntimeItem[];
export type RuntimeItem = Readonly<Record<string, RuntimeValue>>;

/** A data failure of a record (division by zero); the run turns it into the node's error. */
export class EvaluationFailure extends Error {
  constructor(
    readonly code: Schemas['FailureCode'],
    message: string,
  ) {
    super(message);
  }
}

const isDecimal = (value: RuntimeValue): value is Decimal => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface Scope {
  /** Linear variables (inputs and node outputs). */
  linear: ReadonlyMap<string, RuntimeValue>;
  /** List name → its items; field name → its list name. */
  lists: ReadonlyMap<string, RuntimeItem[]>;
  fieldList: ReadonlyMap<string, string>;
}

export function evaluate(expression: Expression, scope: Scope, item?: RuntimeItem): RuntimeValue {
  switch (expression.kind) {
    case 'number':
      return parseDecimal(expression.text);
    case 'text':
      return expression.value;
    case 'boolean':
      return expression.value;
    case 'null':
      return null;
    case 'variable': {
      if (expression.brackets) {
        const list = scope.lists.get(expression.name);
        if (list) return list;
        return item ? (item[expression.name] ?? null) : null;
      }
      return scope.linear.get(expression.name) ?? null;
    }
    case 'negate': {
      const value = evaluate(expression.operand, scope, item);
      return isDecimal(value) ? decimal(-value.units) : null;
    }
    case 'binary': {
      const left = evaluate(expression.left, scope, item);
      const right = evaluate(expression.right, scope, item);
      if (!isDecimal(left) || !isDecimal(right)) return null;
      switch (expression.operator) {
        case '+':
          return decimal(left.units + right.units);
        case '-':
          return decimal(left.units - right.units);
        case '*':
          return decimal(divideHalfUp(left.units * right.units, ONE));
        case '/':
          if (right.units === 0n) throw new EvaluationFailure('division_by_zero', 'Divisão por zero.');
          return decimal(divideHalfUp(left.units * ONE, right.units));
        default: {
          const exponent = Number(right.units / ONE);
          let result = decimal(ONE);
          for (let i = 0; i < Math.abs(exponent); i += 1) result = decimal(divideHalfUp(result.units * left.units, ONE));
          if (exponent >= 0) return result;
          if (result.units === 0n) throw new EvaluationFailure('division_by_zero', 'Divisão por zero.');
          return decimal(divideHalfUp(ONE * ONE, result.units));
        }
      }
    }
    case 'call':
      return call(expression, scope, item);
  }
}

/** The list an aggregation goes over: the one of the first `[]` in the argument. */
function aggregatedList(expression: Expression, scope: Scope): RuntimeItem[] {
  const names = new Set<string>();
  const collect = (node: Expression) => {
    if (node.kind === 'variable' && node.brackets) names.add(node.name);
    if (node.kind === 'call') node.args.forEach(collect);
    if (node.kind === 'negate') collect(node.operand);
    if (node.kind === 'binary') {
      collect(node.left);
      collect(node.right);
    }
  };
  collect(expression);
  for (const name of names) {
    const list = scope.lists.get(name) ?? scope.lists.get(scope.fieldList.get(name) ?? '');
    if (list) return list;
  }
  return [];
}

function call(expression: Extract<Expression, { kind: 'call' }>, scope: Scope, item?: RuntimeItem): RuntimeValue {
  const key = functionKey(expression.name);
  const [first, second] = expression.args;
  const aggregation = AGGREGATIONS.has(key) || ((key === 'MIN' || key === 'MAX') && expression.args.length === 1);
  if (aggregation && first) {
    const listOnly = first.kind === 'variable' && first.brackets && scope.lists.has(first.name);
    const list = aggregatedList(first, scope);
    if (listOnly && key === 'CONTAR') return decimal(BigInt(list.length) * ONE);
    if (listOnly && key === 'EXISTE') return list.length > 0;
    const values = list.map((each) => evaluate(first, scope, each)).filter((value) => value !== null);
    if (key === 'EXISTE') return values.length > 0;
    if (key === 'CONTAR') return decimal(BigInt(values.length) * ONE);
    const numbers = values.filter(isDecimal);
    if (key === 'SOMA') return decimal(numbers.reduce((sum, value) => sum + value.units, 0n));
    if (numbers.length === 0) return null;
    if (key === 'MEDIA') return decimal(divideHalfUp(numbers.reduce((sum, value) => sum + value.units, 0n) * ONE, BigInt(numbers.length) * ONE));
    return extreme(numbers, key === 'MIN');
  }
  const args = expression.args.map((arg) => evaluate(arg, scope, item));
  if (args.some((arg) => arg === null)) return null;
  const numbers = args.filter(isDecimal);
  switch (key) {
    case 'MIN':
    case 'MAX':
      return extreme(numbers, key === 'MIN');
    case 'ABS': {
      const value = numbers[0];
      return value ? decimal(value.units < 0n ? -value.units : value.units) : null;
    }
    case 'ARRED':
    case 'TRUNCAR': {
      const value = numbers[0];
      const places = second?.kind === 'number' ? Number(second.text) : 0;
      return value ? roundTo(value, places, key === 'ARRED' ? 'half_up' : 'down') : null;
    }
    default:
      return null;
  }
}

function extreme(numbers: readonly Decimal[], smallest: boolean): Decimal | null {
  let best: Decimal | null = null;
  for (const value of numbers) {
    if (best === null || (smallest ? value.units < best.units : value.units > best.units)) best = value;
  }
  return best;
}

/** Whether a cell matches the condition value (with nulo, only `-`, empty and `nulo` match). */
export function cellMatches(cell: Cell, value: RuntimeValue, scope: Scope): boolean {
  if (cell.kind === 'any') return true;
  const compare = (other: RuntimeValue): number | null => {
    if (isDecimal(value) && isDecimal(other)) return value.units === other.units ? 0 : value.units < other.units ? -1 : 1;
    if (typeof value === 'string' && typeof other === 'string') return value === other ? 0 : null;
    if (typeof value === 'boolean' && typeof other === 'boolean') return value === other ? 0 : null;
    return null;
  };
  if (cell.kind === 'compare' && cell.value.kind === 'null') {
    return cell.operator === '=' ? value === null : cell.operator === '<>' ? value !== null : false;
  }
  if (value === null) return false;
  switch (cell.kind) {
    case 'compare': {
      const result = compare(evaluate(cell.value, scope));
      switch (cell.operator) {
        case '=':
          return result === 0;
        case '<>':
          return result !== 0;
        case '>':
          return result === 1;
        case '>=':
          return result === 1 || result === 0;
        case '<':
          return result === -1;
        case '<=':
          return result === -1 || result === 0;
      }
      return false;
    }
    case 'between': {
      const low = compare(evaluate(cell.low, scope));
      const high = compare(evaluate(cell.high, scope));
      return (low === 0 || low === 1) && (high === 0 || high === -1);
    }
    case 'in':
      return cell.values.some((each) => compare(evaluate(each, scope)) === 0);
  }
}

export { isDecimal };
