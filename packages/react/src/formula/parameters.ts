// Run parameters as `@nome` (E6-18; Contratos do back, "Parâmetro na definição"): how a reference is written, what the
// autocomplete offers after `@` and after the dot of a period, and the pieces the highlight marks. The parameters come from
// the draft; whether a reference fits where it is written is decided by the API analysis (`unknown_parameter`,
// `period_without_part`, `list_outside_in`, `parameter_type_mismatch`), never here.
import type { WorkflowParameter } from './queries';

/** The parts of a `period` (`@periodo.inicio`, `@periodo.fim`), both of type `date`; the period is used only by them. */
export const PERIOD_PARTS = ['inicio', 'fim'] as const;
export type PeriodPart = (typeof PERIOD_PARTS)[number];

const PART_LABELS: Readonly<Record<PeriodPart, string>> = { inicio: 'Início do período', fim: 'Fim do período' };

/** A character that continues a name: a letter (with or without accent), a digit or `_`. */
export const NAME_CHAR_CLASS = '[A-Za-zÀ-ÖØ-öø-ÿ0-9_]';

/**
 * A name of the language (a letter or `_`, then letters, digits and `_`): a variable, a function and a parameter follow it.
 * The one rule, shared by the Monarch tokenizer and the parameter references.
 */
export const NAME_SOURCE = `[A-Za-zÀ-ÖØ-öø-ÿ_]${NAME_CHAR_CLASS}*`;

/** `@nome` with the optional part of a period, as the highlight marks it (the reserved words do not distinguish case). */
export const PARAMETER_PATTERN = new RegExp(`@${NAME_SOURCE}(?:\\.(?:${PERIOD_PARTS.join('|')})(?!${NAME_CHAR_CLASS}))?`, 'i');

const TYPE_LABELS: Readonly<Record<WorkflowParameter['type'], string>> = {
  text: 'texto',
  integer: 'inteiro',
  decimal: 'decimal',
  date: 'data',
  datetime: 'data e hora',
  boolean: 'booleano',
  period: 'período',
};

/** The type as the autocomplete writes it: `decimal(2)`, `período`, `lista de texto`. */
export function parameterTypeLabel(parameter: Pick<WorkflowParameter, 'type' | 'scale' | 'list'>): string {
  const name = TYPE_LABELS[parameter.type];
  const typed = parameter.type === 'decimal' && parameter.scale !== null ? `${name}(${parameter.scale})` : name;
  return parameter.list ? `lista de ${typed}` : typed;
}

/** What a written reference names: `@periodo.inicio` is `{ name: 'periodo', part: 'inicio' }`. */
export interface ParameterReading {
  name: string;
  /** The text after the dot, as written (any name; only `inicio` and `fim` exist), or `null` without a dot. */
  part: string | null;
}

const WHOLE_REFERENCE = new RegExp(`^@(${NAME_SOURCE})(?:\\.(${NAME_SOURCE}))?$`);

/** The reference a whole value is (a filter value is `@nome` or `@nome.parte` alone), or `null` when it is not one. */
export function readParameterReference(text: string): ParameterReading | null {
  const match = WHOLE_REFERENCE.exec(text.trim());
  return match ? { name: match[1]!, part: match[2] ?? null } : null;
}

/** The parameter `name` refers to: the names compare without case, like the variables of the language. */
export function findParameter(parameters: readonly WorkflowParameter[], name: string): WorkflowParameter | undefined {
  const lower = name.toLowerCase();
  return parameters.find((parameter) => parameter.name.toLowerCase() === lower);
}

/** One reference a parameter offers: `@lojas`, or each part of a period (`@periodo.inicio`, `@periodo.fim`). */
export interface ParameterReference {
  /** As written in a value or formula. */
  text: string;
  parameter: WorkflowParameter;
  part: PeriodPart | null;
  /** The type of the reference: a part of a period is a `date`. */
  typeLabel: string;
}

/** The references of the parameters, in their order: a period by its two parts (it is never used alone). */
export function parameterReferences(parameters: readonly WorkflowParameter[]): ParameterReference[] {
  return parameters.flatMap((parameter): ParameterReference[] =>
    parameter.type === 'period'
      ? PERIOD_PARTS.map((part) => ({ text: `@${parameter.name}.${part}`, parameter, part, typeLabel: 'data' }))
      : [{ text: `@${parameter.name}`, parameter, part: null, typeLabel: parameterTypeLabel(parameter) }],
  );
}

/** An item of the `@` autocomplete of a formula. */
export interface ParameterCompletion {
  label: string;
  insertText: string;
  /** `período`, `decimal(2)`, `lista de texto`; `data` in a part of a period. */
  typeLabel: string;
  /** In words: "Parâmetro", "Início do período". */
  description: string;
  /** A period completes with the dot, and the autocomplete opens again with its parts. */
  reopens: boolean;
}

/** What the autocomplete offers at the cursor: the items and where (UTF-16 offset in the text) the replaced text starts. */
export interface ParameterCompletionAt {
  from: number;
  items: ParameterCompletion[];
}

const AFTER_AT = new RegExp(`@(${NAME_SOURCE})?$`);
const AFTER_DOT = new RegExp(`@(${NAME_SOURCE})\\.(${NAME_SOURCE})?$`);
/** A name glued before the `@` (`a@`) is not the start of a reference. */
const NAME_CHAR = new RegExp(`${NAME_CHAR_CLASS}$`);

/**
 * The parameter autocomplete for the text before the cursor, or `null` when the cursor is not in a reference:
 * - right after `@` or in its name, every parameter (`@periodo`, `@lojas`), replacing from the `@`;
 * - after the dot of a period (`@periodo.`), its parts `inicio` and `fim`, replacing from the dot on;
 * - after the dot of a parameter that is not a period, nothing (an empty list: the reference has no parts).
 * Inside a text (between quotes) there is no reference.
 */
export function parameterCompletionAt(before: string, parameters: readonly WorkflowParameter[]): ParameterCompletionAt | null {
  if (insideText(before)) return null;
  const dot = AFTER_DOT.exec(before);
  if (dot && !NAME_CHAR.test(before.slice(0, dot.index))) {
    const parameter = findParameter(parameters, dot[1]!);
    const items =
      parameter?.type === 'period'
        ? PERIOD_PARTS.map((part) => ({ label: part, insertText: part, typeLabel: 'data', description: PART_LABELS[part], reopens: false }))
        : [];
    return { from: before.length - (dot[2]?.length ?? 0), items };
  }
  const at = AFTER_AT.exec(before);
  if (!at || NAME_CHAR.test(before.slice(0, at.index))) return null;
  const items = parameters.map((parameter) => ({
    label: `@${parameter.name}`,
    insertText: parameter.type === 'period' ? `@${parameter.name}.` : `@${parameter.name}`,
    typeLabel: parameterTypeLabel(parameter),
    description: 'Parâmetro',
    reopens: parameter.type === 'period',
  }));
  return { from: at.index, items };
}

/** Whether the end of `before` is inside a text literal (an odd number of quotes; `""` inside a text is two). */
function insideText(before: string): boolean {
  let quotes = 0;
  for (const char of before) if (char === '"') quotes++;
  return quotes % 2 === 1;
}

/** A piece of a formula for the highlight of the plain field: the parameter references apart from the rest. */
export interface FormulaSegment {
  text: string;
  parameter: boolean;
}

/** The formula in pieces, the references (`@nome`, `@periodo.inicio`) marked; texts between quotes stay plain. */
export function formulaSegments(text: string): FormulaSegment[] {
  const segments: FormulaSegment[] = [];
  const pattern = new RegExp(PARAMETER_PATTERN.source, 'gi');
  let plainFrom = 0;
  let quoted = false;
  let scanned = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    for (; scanned < match.index; scanned++) if (text[scanned] === '"') quoted = !quoted;
    // `a@b` is a name glued to `@`, and a reference inside a text is text: neither is marked.
    if (quoted || NAME_CHAR.test(text.slice(0, match.index))) continue;
    if (match.index > plainFrom) segments.push({ text: text.slice(plainFrom, match.index), parameter: false });
    segments.push({ text: match[0], parameter: true });
    plainFrom = match.index + match[0].length;
  }
  if (plainFrom < text.length) segments.push({ text: text.slice(plainFrom), parameter: false });
  return segments;
}

/**
 * The text "Trocar por X" writes in place of the marked text. An `unknown_parameter` suggests the name without the `@`
 * (`categorias`): when the marked text starts with `@`, the `@` stays.
 */
export function fixText(code: string, marked: string, suggestion: string): string {
  return code === 'unknown_parameter' && marked.startsWith('@') && !suggestion.startsWith('@') ? `@${suggestion}` : suggestion;
}

/** The name the fix button shows: a parameter always with its `@`. */
export function fixLabel(code: string, suggestion: string): string {
  return code === 'unknown_parameter' && !suggestion.startsWith('@') ? `@${suggestion}` : suggestion;
}
