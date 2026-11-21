// A value of the API on screen (estilos.md §3), by its declared type: numbers as `1.500,00`, dates as `20/11/2026`,
// booleans as "verdadeiro" and "falso", null as "—", a list as its size. Only text is handled (E4-4).
import type { Schemas } from '../../api';
import { formatDate, formatDateTime } from './dates';
import { NO_VALUE } from './empty';
import { formatApiNumber } from './numbers';

type DataType = Schemas['DataType'];
type Value = Schemas['Value'];

/** `type` is the variable's declared type, when known; without it, a text goes as it is. Nothing (`undefined`) and `''` are "—". */
export function formatValue(value: Value | undefined, type: DataType | null | undefined): string {
  if (value === null || value === undefined) return NO_VALUE;
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso';
  if (Array.isArray(value)) return value.length === 1 ? 'lista com 1 item' : `lista com ${value.length.toLocaleString('pt-BR')} itens`;
  switch (type) {
    case 'integer':
    case 'decimal':
      return formatApiNumber(value);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    default:
      return value === '' ? NO_VALUE : value;
  }
}
