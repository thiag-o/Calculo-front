import { DATA_TYPE_LABELS } from '../../catalog';
import type { SelectOption } from '../../design-system';
import { READ_ONLY_REASON } from '../draft';
import type { DataType, DeclaredInput, ErrorPolicy, RoundingMode } from './definition';

/** Fixed labels (Contratos do épico 4; estilos §13): one sentence per action. */
export const INHERIT_LABEL = 'Herdar do workflow';
/** The value of "Herdar do workflow" in the selects (a select option cannot be empty; the definition keeps `null`). */
export const INHERIT_VALUE = 'inherit';

export const ERROR_POLICY_LABELS: Readonly<Record<ErrorPolicy, string>> = {
  error: 'Gerar erro',
  null_with_warning: 'Deixar vazio com aviso',
  default_value: 'Usar valor padrão',
};

export const ROUNDING_MODE_LABELS: Readonly<Record<RoundingMode, string>> = {
  half_up: 'Meio para cima',
  half_even: 'Meio para o par',
  down: 'Cortar',
};

export const CARDINALITY_LABELS: Readonly<Record<DeclaredInput['cardinality'], string>> = {
  linear: 'Linear',
  multiple: 'Múltiplo',
};

const ERROR_POLICIES: readonly ErrorPolicy[] = ['error', 'null_with_warning', 'default_value'];
const ROUNDING_MODES: readonly RoundingMode[] = ['half_up', 'half_even', 'down'];
const DATA_TYPES: readonly DataType[] = ['text', 'integer', 'decimal', 'date', 'datetime', 'boolean'];
/** A Calculation gives a number (E4-4): its output is `integer` or `decimal`. */
const CALCULATION_TYPES: readonly DataType[] = ['integer', 'decimal'];

export const ERROR_POLICY_OPTIONS: readonly SelectOption[] = ERROR_POLICIES.map((value) => ({ value, label: ERROR_POLICY_LABELS[value] }));
export const ROUNDING_MODE_OPTIONS: readonly SelectOption[] = ROUNDING_MODES.map((value) => ({ value, label: ROUNDING_MODE_LABELS[value] }));
export const DATA_TYPE_OPTIONS: readonly SelectOption[] = DATA_TYPES.map((value) => ({ value, label: DATA_TYPE_LABELS[value] }));

/** "Inteiro" and "Decimal"; a type out of these, already in the definition, stays listed so the select shows it. */
export function calculationTypeOptions(current: DataType): SelectOption[] {
  const types = CALCULATION_TYPES.includes(current) ? CALCULATION_TYPES : [...CALCULATION_TYPES, current];
  return types.map((value) => ({ value, label: DATA_TYPE_LABELS[value] }));
}

export { READ_ONLY_REASON };

export const NAME_TOOLTIP = 'Letras minúsculas sem acento, números e _, começando por uma letra. Ex.: valor_item';
export const NAME_RULE_MESSAGE = 'Use de 1 a 63 caracteres: letras minúsculas sem acento, números e _, começando por uma letra.';
export const SCALE_RULE_MESSAGE = 'Use um número inteiro de 0 a 18.';
export const NOT_SAVED_NOTE = 'Enquanto o campo tiver erro, a mudança não é salva.';
export const DUPLICATE_VARIABLE_MESSAGE = 'Já existe uma variável com este nome. Escolha outro.';
export const DUPLICATE_OUTPUT_FIELD_MESSAGE = 'Já existe um campo de saída com este nome. Escolha outro.';

/**
 * Warns, as it is typed, about a name already in use (`counts` has how many times each name is in the definition,
 * `current` included). The analysis gives the same problem; the warning only comes earlier.
 */
export function duplicateWarning(counts: ReadonlyMap<string, number>, current: string, message: string) {
  return (text: string) => ((counts.get(text) ?? 0) > (text === current ? 1 : 0) ? message : null);
}
