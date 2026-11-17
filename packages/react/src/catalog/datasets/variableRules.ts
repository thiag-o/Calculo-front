import type { Column, DataType } from '../columns';

/** The variable name rule (E3-10), checked as typed: no trimming, like the API. */
export const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** Decimal places a `decimal` variable accepts (D36). */
export const SCALE_MIN = 0;
export const SCALE_MAX = 38;

/**
 * The variable types each column type accepts (E3-10): the same type, `integer` → `decimal`, `date` → `datetime` and any
 * type → `text`. In the order of the type picker: the column's own type first, `text` last.
 */
const CONVERSIONS: Readonly<Record<DataType, readonly DataType[]>> = {
  text: ['text'],
  integer: ['integer', 'decimal', 'text'],
  decimal: ['decimal', 'text'],
  date: ['date', 'datetime', 'text'],
  datetime: ['datetime', 'text'],
  boolean: ['boolean', 'text'],
};

/** The types a variable over `column` may have. A column without a supported type accepts none. */
export function acceptedTypes(column: Pick<Column, 'type'>): readonly DataType[] {
  return column.type === null ? [] : CONVERSIONS[column.type];
}

/** Whether the column can become a variable (it has a supported type). */
export function canBecomeVariable(column: Pick<Column, 'type'>): boolean {
  return column.type !== null;
}

/**
 * The fewest decimal places a `decimal` variable over `column` may have: the column's own, when it is a `decimal` with
 * defined places (fewer would round the values, D36); otherwise the minimum.
 */
export function minimumScale(column: Pick<Column, 'type' | 'scale'> | undefined): number {
  return column?.type === 'decimal' && column.scale !== null ? column.scale : SCALE_MIN;
}
