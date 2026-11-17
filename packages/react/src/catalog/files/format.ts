// Texts of the Excel files screens: sizes, dates and counts in the Brazilian format (estilos.md §3), and the checks
// made in the browser before an upload.

/** Upload limit, the API default (`FLUXO_EXCEL_MAX_SIZE_MB`, 20 MB), also checked in the browser. */
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** Only `.xlsx` (plan E3-7). The file input also offers only them. */
export const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function isXlsx(file: Pick<File, 'name'>): boolean {
  return file.name.toLowerCase().endsWith('.xlsx');
}

const sizeFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "512 B", "20 KB", "1,2 MB" (base 1024). */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString('pt-BR')} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

/** "1 aba", "3 abas". */
export function sheetCount(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'aba' : 'abas'}`;
}

/** "1 coluna", "12 colunas". */
export function columnCount(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'coluna' : 'colunas'}`;
}

/** What the type inference read of a sheet: "1.000 linhas lidas para inferir os tipos". */
export function sampledRows(total: number): string {
  if (total === 0) return 'Nenhuma linha abaixo do cabeçalho; as colunas ficam como Texto';
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'linha lida' : 'linhas lidas'} para inferir os tipos`;
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14/11/2026 às 09:05", in the user's time zone; empty if the date is invalid (the table shows "—"). */
export function dateTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}
