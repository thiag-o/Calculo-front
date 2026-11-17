import type { ReactNode } from 'react';
import { Skeleton } from './Loading';
import './loading.css';
import './table.css';

export interface TableColumn<T> {
  /** Stable column identifier. */
  key: string;
  /** Header title (tertiary label-12). */
  title: string;
  /** Cell content for a row. Empty becomes "—" (estilos.md §1.2). */
  cell: (row: T) => ReactNode;
  /** `end` for numbers and actions. Default: `start`. */
  align?: 'start' | 'end';
  /** CSS width of the column ("120px", "20%"). Default: automatic. */
  width?: string;
  /** Hides the title only visually ("…" actions column); the screen reader still reads it. */
  hiddenTitle?: boolean;
  /** Width of this column's bar in the skeleton (px or CSS). Default: 60%. */
  skeletonWidth?: number | string;
}

export interface TableProps<T> {
  /** Table name for the screen reader (`<caption>`, hidden on screen): "Execuções recentes". */
  caption: string;
  columns: readonly TableColumn<T>[];
  /** The rows. `undefined` while they have not arrived. */
  rows: readonly T[] | undefined;
  /** Stable key of each row (the id). */
  rowKey: (row: T) => string;
  /** Shows the skeleton in place of the rows (estilos.md §14). Wins over `error` and `empty`. */
  loading?: boolean;
  /** Skeleton rows. Default: 3. */
  loadingRows?: number;
  /** Error in place of the rows, usually a `Notice type="error"` with the action to fix it. Wins over `empty`. */
  error?: ReactNode;
  /** Empty state, usually an `EmptyState`. Required: every list has its empty state designed (estilos.md §14). */
  empty: ReactNode;
  className?: string;
}

function alignClasses(align: TableColumn<unknown>['align']) {
  return align === 'end' ? 'fc-table-end' : null;
}

function join(...classes: (string | null | undefined | false)[]) {
  return classes.filter(Boolean).join(' ') || undefined;
}

function noContent(value: ReactNode) {
  return value === null || value === undefined || value === false || value === '';
}

/**
 * Simple table (estilos.md §7.6 and §9) inside a card: 32px header in tertiary label-12, rows with a
 * 1px divider and hover. Has the loading (skeleton, `aria-busy`), error and empty states.
 */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  loadingRows = 3,
  error,
  empty,
  className,
}: TableProps<T>) {
  const hasError = !loading && !noContent(error);
  const isEmpty = !loading && !hasError && (rows?.length ?? 0) === 0;
  const columnCount = Math.max(columns.length, 1);

  let body: ReactNode;
  if (loading) {
    body = Array.from({ length: loadingRows }, (_, index) => (
      <tr key={index} className="fc-table-row fc-table-skeleton-row" aria-hidden="true">
        {columns.map((column) => (
          <td key={column.key} className={join('fc-table-cell', alignClasses(column.align))}>
            <Skeleton width={column.skeletonWidth ?? '60%'} />
          </td>
        ))}
      </tr>
    ));
  } else if (hasError || isEmpty) {
    body = (
      <tr className="fc-table-single-row">
        <td className="fc-table-cell fc-table-single-cell" colSpan={columnCount}>
          {hasError ? error : empty}
        </td>
      </tr>
    );
  } else {
    body = (rows ?? []).map((row) => (
      <tr key={rowKey(row)} className="fc-table-row">
        {columns.map((column) => {
          const content = column.cell(row);
          return (
            <td key={column.key} className={join('fc-table-cell', alignClasses(column.align))}>
              {noContent(content) ? <span className="fc-table-no-value">—</span> : content}
            </td>
          );
        })}
      </tr>
    ));
  }

  return (
    <div className={join('fc-table', className)}>
      {/* Always present, so the change from "Carregando" is announced. */}
      <span role="status" className="fc-visually-hidden">
        {loading ? `Carregando ${caption.toLocaleLowerCase('pt-BR')}` : ''}
      </span>
      <table className="fc-table-table" aria-busy={loading || undefined}>
        <caption className="fc-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={join('fc-table-header', alignClasses(column.align))}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.hiddenTitle ? <span className="fc-visually-hidden">{column.title}</span> : column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
