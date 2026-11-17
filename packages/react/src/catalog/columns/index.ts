// Sub-vertical "columns" of the "catalog" vertical (ADR 0003): the columns table with types and the `DataType` labels,
// shared by the datasets (F31), the Excel files (F32) and the variables (F33) (D11).
// This folder's interface; other verticals reach the catalog only through catalog/index.ts (F34).
export { ColumnsTable, UNSUPPORTED_COLUMNS_NOTE } from './ColumnsTable';
export type { ColumnsTableProps } from './ColumnsTable';
export { DATA_TYPE_LABELS, UNSUPPORTED_TYPE_LABEL, columnTypeLabel, dataTypeLabel } from './dataTypes';
export type { Column, DataType } from './dataTypes';
