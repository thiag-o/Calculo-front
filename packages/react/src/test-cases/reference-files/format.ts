// Texts of the reference files section: sizes, dates, counts and percentages in the Brazilian format (estilos.md §3), and
// the checks made in the browser before an upload.
import { formatApiNumber } from '../../design-system';

/** Upload limit of the contract (20 MB, `413 file_too_large`), also checked in the browser. */
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** Only `.csv` (RFC 4180, E7-10). The file input also offers only them. */
export const CSV_ACCEPT = '.csv,text/csv';

export function isCsv(file: Pick<File, 'name'>): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

const sizeFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "512 B", "20 KB", "1,2 MB" (base 1024). */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString('pt-BR')} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

/** "1 registro", "1.180 registros". */
export function recordCount(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'registro' : 'registros'}`;
}

/** "1 arquivo", "3 arquivos". */
export function fileCount(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'arquivo' : 'arquivos'}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "24/11/2026 às 12:50", in the user's time zone; empty if the date is invalid. */
export function dateTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}

/** The SHA-256 as the list shows it: the first 12 characters and "…" (the whole one goes to the clipboard). */
export function shortHash(sha256: string): string {
  return sha256.length > 12 ? `${sha256.slice(0, 12)}…` : sha256;
}

/**
 * The `equal_percent` of the API in the Brazilian format, as it came (never recalculated, E7-26), without the zeros that
 * add nothing: "100.00" → "100%", "98.27" → "98,27%", "98.50" → "98,5%".
 */
export function equalPercent(value: string): string {
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return `${formatApiNumber(trimmed)}%`;
}

/** The last comparison as the list says it: "100% iguais". */
export function comparisonSummary(percent: string): string {
  return `${equalPercent(percent)} iguais`;
}
