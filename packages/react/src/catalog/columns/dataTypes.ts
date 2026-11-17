import type { Schemas } from '../../api';

/** A column of a source: table, view, SQL or Excel sheet (generated from the contract). */
export type Column = Schemas['Column'];
/** Data type of a column or variable (generated from the contract). */
export type DataType = Schemas['DataType'];

/** Name of each `DataType` on screen (pt-BR), in the order the API declares them. */
export const DATA_TYPE_LABELS: Readonly<Record<DataType, string>> = {
  text: 'Texto',
  integer: 'Inteiro',
  decimal: 'Decimal',
  date: 'Data',
  datetime: 'Data e hora',
  boolean: 'Booleano',
};

/** What a column whose source type has no `DataType` shows (`type: null`): it cannot become a variable. */
export const UNSUPPORTED_TYPE_LABEL = 'Sem suporte';

/** "Decimal (2 casas)", "Decimal (1 casa)" or just the type name. `scale` only counts for `decimal`. */
export function dataTypeLabel(type: DataType, scale?: number | null): string {
  const label = DATA_TYPE_LABELS[type];
  if (type !== 'decimal' || scale === null || scale === undefined) return label;
  return `${label} (${scale.toLocaleString('pt-BR')} ${scale === 1 ? 'casa' : 'casas'})`;
}

/** The type of a column on screen, or `undefined` when the source type has no correspondence. */
export function columnTypeLabel(column: Pick<Column, 'type' | 'scale'>): string | undefined {
  return column.type === null ? undefined : dataTypeLabel(column.type, column.scale);
}
