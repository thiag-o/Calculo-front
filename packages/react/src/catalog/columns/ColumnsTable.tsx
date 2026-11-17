import type { ReactNode } from 'react';
import { Badge, EmptyState, Table, Text, type TableColumn } from '../../design-system';
import { UNSUPPORTED_TYPE_LABEL, columnTypeLabel, type Column } from './dataTypes';
import './columns.css';

/** Note below the table when some column has no supported type. */
export const UNSUPPORTED_COLUMNS_NOTE = 'Colunas sem suporte têm um tipo de origem sem correspondência e não podem virar variável.';

export interface ColumnsTableProps {
  /** Table name for the screen reader: "Colunas do dataset Vendas". */
  caption: string;
  /** The columns, in the source order. `undefined` while they have not arrived. */
  columns: readonly Column[] | undefined;
  /** Shows the skeleton in place of the rows. */
  loading?: boolean;
  /** Error in place of the rows, usually a `Notice type="error"`. */
  error?: ReactNode;
  /** Empty state. Default: "Nenhuma coluna". */
  empty?: ReactNode;
  /** Columns added after the four of the table, like the variable of each column (F33). */
  extraColumns?: readonly TableColumn<Column>[];
}

const BASE_COLUMNS: readonly TableColumn<Column>[] = [
  {
    key: 'name',
    title: 'Nome',
    skeletonWidth: 140,
    cell: (column) => (
      <Text variant="mono-13" medium className="fc-columns-name">
        {column.name}
      </Text>
    ),
  },
  {
    key: 'source-type',
    title: 'Tipo de origem',
    skeletonWidth: 100,
    cell: (column) => (
      <Text variant="mono-12" emphasis="secondary" className="fc-columns-source-type">
        {column.source_type}
      </Text>
    ),
  },
  {
    key: 'type',
    title: 'Tipo',
    skeletonWidth: 80,
    cell: (column) => {
      const label = columnTypeLabel(column);
      return label === undefined ? <Badge tone="amber">{UNSUPPORTED_TYPE_LABEL}</Badge> : <Text variant="label-14">{label}</Text>;
    },
  },
  {
    key: 'nullable',
    title: 'Anulável',
    width: '96px',
    skeletonWidth: 32,
    cell: (column) => <Text variant="label-14">{column.nullable ? 'Sim' : 'Não'}</Text>,
  },
];

/**
 * The columns of a source with their types (estilos.md §7.6 and §9): name, source type, type and nullable. A column whose
 * source type has no `DataType` shows "Sem suporte", with a note below the table. Shared by the datasets (F31),
 * the Excel files (F32) and the variables (F33).
 */
export function ColumnsTable({ caption, columns, loading = false, error, empty, extraColumns = [] }: ColumnsTableProps) {
  const hasUnsupported = !loading && !error && (columns?.some((column) => column.type === null) ?? false);
  // The position makes the key: a SQL dataset may have two columns with the same name.
  const positions = new Map(columns?.map((column, index) => [column, index]));
  return (
    <div className="fc-columns">
      <Table
        caption={caption}
        columns={[...BASE_COLUMNS, ...extraColumns]}
        rows={columns}
        rowKey={(column) => `${positions.get(column) ?? ''}:${column.name}`}
        loading={loading}
        error={error}
        empty={empty ?? <EmptyState title="Nenhuma coluna" description="A origem não tem colunas para mostrar." />}
      />
      {hasUnsupported ? (
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-columns-note">
          {UNSUPPORTED_COLUMNS_NOTE}
        </Text>
      ) : null}
    </div>
  );
}
