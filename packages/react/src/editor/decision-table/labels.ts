// Texts of the Decision Table on screen (pt-BR), with the fixed labels of the plan (Contratos, "Rótulos fixos").
import type { Schemas } from '../../api';
import type { DataType } from './tableModel';

type HitPolicy = Schemas['HitPolicy'];
type RoundingMode = Schemas['RoundingMode'];
type ErrorPolicy = Schemas['ErrorPolicy'];

export const HIT_POLICY_LABELS: Readonly<Record<HitPolicy, string>> = { first: 'Primeira', unique: 'Única' };

export const ROUNDING_MODE_LABELS: Readonly<Record<RoundingMode, string>> = {
  half_up: 'Meio para cima',
  half_even: 'Meio para o par',
  down: 'Cortar',
};

export const ERROR_POLICY_LABELS: Readonly<Record<ErrorPolicy, string>> = {
  error: 'Gerar erro',
  null_with_warning: 'Deixar vazio com aviso',
  default_value: 'Usar valor padrão',
};

/** The node has no value of its own: it takes the workflow's. */
export const INHERIT_LABEL = 'Herdar do workflow';
/** The value of the "Herdar do workflow" option (a select option cannot be empty). */
export const INHERIT_VALUE = 'inherit';

/** Name of each data type on screen, in the order the API declares them. */
export const DATA_TYPE_LABELS: Readonly<Record<DataType, string>> = {
  text: 'Texto',
  integer: 'Inteiro',
  decimal: 'Decimal',
  date: 'Data',
  datetime: 'Data e hora',
  boolean: 'Booleano',
};

/** The type as in the ports of the canvas (`decimal(4)`, `text`). */
export function typeCode(type: DataType, scale?: number | null): string {
  return type === 'decimal' && typeof scale === 'number' ? `decimal(${scale})` : type;
}

/** "1 regra", "12 regras". */
export function rulesText(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'regra' : 'regras'}`;
}

/** "1 problema nas regras", "3 problemas nas regras". */
export function gridProblemsText(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'problema' : 'problemas'} nas regras`;
}

/** The accessible name of a condition column: "Condição 2: categoria" (or "Condição 2, sem fórmula"). */
export function conditionName(index: number, expression: string): string {
  return expression.trim() ? `Condição ${index + 1}: ${expression}` : `Condição ${index + 1}, sem fórmula`;
}

export function resultName(index: number, name: string): string {
  return `Resultado ${index + 1}: ${name}`;
}

export const NAME_REQUIRED = 'Informe o nome da tabela.';
export const VARIABLE_NAME_RULE = 'Use letras minúsculas, números e _, começando por uma letra (até 63 caracteres).';
export const MAX_RULES_REASON = 'A tabela já tem 500 regras, o limite';
export const MAX_CONDITIONS_REASON = 'A tabela já tem 30 condições, o limite';
export const MAX_RESULTS_REASON = 'A tabela já tem 20 resultados, o limite';
