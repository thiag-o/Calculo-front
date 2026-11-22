// A run parameter in a filter value (E6-18; D35): which references of the draft's parameters serve a variable and an
// operator, and, for a typed `@`, why it would not serve. It is only a hint: the API analysis decides
// (`unknown_parameter`, `period_without_part`, `list_outside_in`, `parameter_type_mismatch`), and nothing here blocks.
import { DATA_TYPE_LABELS } from '../../../catalog';
import {
  PERIOD_PARTS,
  findParameter,
  parameterReferences,
  readParameterReference,
  type ParameterReference,
  type WorkflowParameter,
} from '../../../formula';
import type { DataType, FilterOperator } from './filterRules';

/** Types compared by value: an `integer` and a `decimal` serve each other, as in the links (Contratos, `SourceLink`). */
function sameFamily(a: DataType, b: DataType): boolean {
  const numeric = (type: DataType) => type === 'integer' || type === 'decimal';
  return a === b || (numeric(a) && numeric(b));
}

function typeName(parameter: WorkflowParameter): string {
  return parameter.type === 'period' ? 'Período' : DATA_TYPE_LABELS[parameter.type];
}

/**
 * Why the reference would not serve a value of a variable of `type` under `operator`, or `null` when it serves:
 * the name is a parameter, a period comes with `.inicio` or `.fim` (a `date`), a list only in `EM (lista)`, and the type
 * is the variable's.
 */
function misfit(parameters: readonly WorkflowParameter[], name: string, part: string | null, type: DataType, operator: FilterOperator): string | null {
  const parameter = findParameter(parameters, name);
  if (!parameter) return `@${name} não é um parâmetro do workflow.`;
  const at = `@${parameter.name}`;
  if (parameter.type === 'period') {
    if (part === null) return `${at} é um período: use ${at}.inicio ou ${at}.fim.`;
    if (!(PERIOD_PARTS as readonly string[]).includes(part.toLowerCase())) return `Um período só tem as partes .inicio e .fim: use ${at}.inicio ou ${at}.fim.`;
  } else if (part !== null) {
    return `${at} não é um período: use ${at}, sem .${part}.`;
  }
  if (parameter.list && operator !== 'in') return `${at} é uma lista: só serve no operador EM (lista).`;
  const valueType: DataType = parameter.type === 'period' ? 'date' : parameter.type;
  if (!sameFamily(valueType, type)) {
    const shown = parameter.type === 'period' ? `${at}.${part!.toLowerCase()}` : at;
    return `${shown} é ${parameter.type === 'period' ? 'Data' : typeName(parameter)}, e a variável é ${DATA_TYPE_LABELS[type]}.`;
  }
  return null;
}

/** The references of the draft's parameters that serve a value of a variable of `type` under `operator`, in their order. */
export function servingReferences(parameters: readonly WorkflowParameter[], type: DataType, operator: FilterOperator): ParameterReference[] {
  return parameterReferences(parameters).filter((reference) => misfit(parameters, reference.parameter.name, reference.part, type, operator) === null);
}

/**
 * The help under a value that is a parameter and would not serve there, or `null` (not a parameter, a reference still being
 * written, or one that serves). A value that starts with `@` but is not `@nome` nor `@nome.parte` gets no help: the
 * analysis answers it.
 */
export function parameterHint(text: string, parameters: readonly WorkflowParameter[], type: DataType, operator: FilterOperator): string | null {
  const reading = readParameterReference(text);
  if (!reading) return null;
  return misfit(parameters, reading.name, reading.part, type, operator);
}
