import type { Connection, Dataset, ExcelFile } from './queries';

/** Name of each dataset type on screen. */
export const DATASET_TYPE_LABELS: Readonly<Record<Dataset['type'], string>> = {
  table: 'Tabela ou view',
  sql: 'SQL livre',
  excel: 'Excel',
};

/** Where a dataset comes from, in two parts: the source (connection or file) and the object inside it. */
export interface DatasetOrigin {
  /** Name of the connection or of the Excel file; `undefined` while unknown. */
  source?: string;
  /** `schema.table`, the sheet, or nothing for a SQL dataset. */
  object?: string;
  /** Whether `object` is a code name (mono). */
  objectIsCode: boolean;
}

/** The origin of a dataset, with the connection and file names when they are known. */
export function datasetOrigin(
  dataset: Dataset,
  connections: readonly Connection[] | undefined,
  excelFiles: readonly ExcelFile[] | undefined,
): DatasetOrigin {
  switch (dataset.type) {
    case 'table':
      return {
        source: connections?.find((connection) => connection.id === dataset.connection_id)?.name,
        object: dataset.schema_name && dataset.object_name ? `${dataset.schema_name}.${dataset.object_name}` : undefined,
        objectIsCode: true,
      };
    case 'sql':
      return { source: connections?.find((connection) => connection.id === dataset.connection_id)?.name, objectIsCode: false };
    case 'excel':
      return {
        source: excelFiles?.find((file) => file.id === dataset.excel_file_id)?.file_name,
        object: dataset.sheet ? `Aba ${dataset.sheet}` : undefined,
        objectIsCode: false,
      };
  }
}

// Dates in the Brazilian format (estilos.md §3), in the user's time zone.
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "14/11/2026 às 09:05"; empty if the date is invalid (the table shows "—"). */
export function dateTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}
