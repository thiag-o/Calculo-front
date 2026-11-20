import { memo, type ChangeEvent } from 'react';
import { MAX_CELL_LENGTH, cellValue, type DecisionTableNode, type DecisionRule } from './tableModel';

/** How a cell is being typed in: `replace` (typing started on it, arrows leave) or `edit` (Enter, F2 or double click). */
export type EditMode = 'replace' | 'edit';

export interface GridRowProps {
  /** The `grid-template-columns` of the grid (the same in every row, so the columns line up). */
  template: string;
  /** The table, for the cell values (only the columns are read: a row changes only when its rule or the columns do). */
  conditions: DecisionTableNode['conditions'];
  results: DecisionTableNode['results'];
  rule: DecisionRule;
  /** The rule index (shown from 1). */
  row: number;
  /** The column of the active cell when it is in this row, or -1. */
  activeColumn: number;
  /** The column being typed in when it is in this row, or -1. */
  editingColumn: number;
  editMode: EditMode;
  /** The columns with a problem, as `|0|2|` (a string, so an unchanged row is not drawn again). */
  invalidColumns: string;
  ruleInvalid: boolean;
  /** The id of the message of the active cell's problems, when it has any. */
  describedBy: string | undefined;
  /** The name of each column, for the field being typed in. */
  columnNames: readonly string[];
  readOnly: boolean;
  onCellInput: (row: number, column: number, value: string) => void;
  onEditEnd: () => void;
}

/** The DOM id of a column header (the cells of the column are under it). */
export function columnHeaderId(gridId: string, column: number): string {
  return `${gridId}-column-${column}`;
}

/** One rule of the grid: the number and one cell per column. Drawn again only when its own props change. */
export const GridRow = memo(function GridRow({
  template,
  conditions,
  results,
  rule,
  row,
  activeColumn,
  editingColumn,
  editMode,
  invalidColumns,
  ruleInvalid,
  describedBy,
  columnNames,
  readOnly,
  onCellInput,
  onEditEnd,
}: GridRowProps) {
  const node = { conditions, results } as DecisionTableNode;
  const columns = conditions.length + results.length;
  const cells = [];
  for (let column = 0; column < columns; column++) {
    const value = cellValue(node, rule, column);
    const active = column === activeColumn;
    const editing = column === editingColumn;
    const invalid = invalidColumns.includes(`|${column}|`);
    const classes = ['fc-dt-cell', column === conditions.length ? 'fc-dt-divider' : null, invalid ? 'fc-dt-invalid' : null, editing ? 'fc-dt-editing' : null]
      .filter(Boolean)
      .join(' ');
    cells.push(
      <div
        key={column}
        role="gridcell"
        className={classes}
        aria-colindex={column + 2}
        aria-invalid={invalid || undefined}
        aria-describedby={active && describedBy ? describedBy : undefined}
        aria-readonly={readOnly || undefined}
        data-cell={`${row}:${column}`}
        tabIndex={active && !editing ? 0 : -1}
      >
        {editing ? (
          <input
            className="fc-dt-input"
            data-cell-input={editMode}
            value={value}
            maxLength={MAX_CELL_LENGTH}
            aria-label={`Regra ${row + 1}, ${columnNames[column] ?? ''}`}
            spellCheck={false}
            autoComplete="off"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onCellInput(row, column, event.target.value)}
            onBlur={onEditEnd}
          />
        ) : value === '' ? (
          <>
            <span className="fc-dt-empty" aria-hidden="true">
              -
            </span>
            <span className="fc-dt-visually-hidden">vazia</span>
          </>
        ) : (
          <span className="fc-dt-value">{value}</span>
        )}
      </div>,
    );
  }

  return (
    <div role="row" className="fc-dt-row fc-dt-rule" aria-rowindex={row + 3} style={{ gridTemplateColumns: template }}>
      <div
        role="rowheader"
        className={['fc-dt-number', ruleInvalid ? 'fc-dt-invalid' : null].filter(Boolean).join(' ')}
        aria-colindex={1}
        aria-invalid={ruleInvalid || undefined}
      >
        <span className="fc-dt-visually-hidden">Regra </span>
        {row + 1}
      </div>
      {cells}
    </div>
  );
});
