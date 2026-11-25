// How the comparison with the reference file reads (E7-26; estilos.md §3, §7.5 and §10): the outcome of each record as
// dot + word, the counts, the summary with the percent of the API and the expected × obtained values in the Brazilian
// pattern, with null as "vazio".
import type { Schemas } from '../../api';
import { formatApiNumber, formatDate, formatDateTime, type StatusTone } from '../../design-system';
import { RECORD_STATUS } from '../records';
import type { ComparisonOutcome, ComparisonSummary } from './queries';

/**
 * The outcome of a record (dot + word). Equal is green; every divergence is amber, as a failing test (estilos.md §7.4,
 * "1 teste falhando" in amber): the simulation found a difference to look at, not an error of the execution.
 */
export const OUTCOME_PRESENTATION: Readonly<Record<ComparisonOutcome, { tone: StatusTone; word: string }>> = {
  equal: { tone: 'green', word: 'igual' },
  different: { tone: 'amber', word: 'diferente' },
  status_differs: { tone: 'amber', word: 'status diferente' },
  missing_from_result: { tone: 'amber', word: 'fora do resultado' },
  missing_from_file: { tone: 'amber', word: 'fora do arquivo' },
};

/** Every outcome that is not "igual": the default filter of the table. */
export const DIVERGENT_OUTCOMES: readonly ComparisonOutcome[] = ['different', 'status_differs', 'missing_from_result', 'missing_from_file'];

/** The counts of the summary, in the order of E7-26. */
export const COUNTS: readonly { key: keyof Omit<ComparisonSummary, 'equal_percent'>; label: string }[] = [
  { key: 'equal', label: 'Iguais' },
  { key: 'different', label: 'Diferentes' },
  { key: 'status_differs', label: 'Status diferente' },
  { key: 'missing_from_result', label: 'Fora do resultado' },
  { key: 'missing_from_file', label: 'Fora do arquivo' },
  { key: 'not_compared', label: 'Fora da comparação' },
];

export function countText(value: number): string {
  return value.toLocaleString('pt-BR');
}

/**
 * The percent as the API sent it, never calculated again: the point becomes a comma and the zeros at the end of the
 * decimals go away ("100.00" → "100", "98.27" → "98,27", "50.50" → "50,5").
 */
export function percentText(value: string): string {
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return formatApiNumber(trimmed);
}

/** "100% iguais · 58 de 58 registros", "98,27% iguais · 57 de 58 registros"; nothing compared: "Nenhum registro comparado". */
export function summaryText(summary: ComparisonSummary): string {
  if (summary.equal_percent === null || summary.compared === 0) return 'Nenhum registro comparado';
  const records = summary.compared === 1 ? 'registro' : 'registros';
  return `${percentText(summary.equal_percent)}% iguais · ${countText(summary.equal)} de ${countText(summary.compared)} ${records}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;
// No zeros on the left: a code like "007" stays text (the API writes numbers without them).
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

type Scalar = string | boolean | null;

function scalarText(value: Scalar): string {
  if (value === null) return 'vazio';
  if (typeof value === 'boolean') return value ? 'Verdadeiro' : 'Falso';
  if (value === '') return '""';
  if (DATE.test(value)) return formatDate(value);
  if (DATE_TIME.test(value)) return formatDateTime(value);
  if (NUMBER.test(value)) return formatApiNumber(value);
  return value;
}

/** An expected or obtained value: numbers in the Brazilian pattern ("1.500,00"), dates in dd/mm/aaaa and null as "vazio". */
export function valueText(value: Schemas['Value'] | null): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'nenhuma linha';
    return value
      .map((row) =>
        Object.entries(row)
          .map(([name, part]) => `${name} ${scalarText(part)}`)
          .join(' · '),
      )
      .join('; ');
  }
  return scalarText(value);
}

/** The status class of the file: empty (or no column) means "calculado". */
export function expectedStatusText(status: Schemas['UnitRunStatus'] | null): string {
  return status === null ? 'calculado' : RECORD_STATUS[status].word;
}

export function obtainedStatusText(status: Schemas['UnitRunStatus'] | null): string {
  return status === null ? '—' : RECORD_STATUS[status].word;
}
