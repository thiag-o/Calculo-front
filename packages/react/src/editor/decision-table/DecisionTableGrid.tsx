import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Button, EmptyState, Text } from '../../design-system';
import { READ_ONLY_REASON, freeResultName, useDraftEditor } from '../draft';
import { MAX_PASTE_LENGTH, cleanCell, isBlock, parseClipboard } from './clipboard';
import { GridRow, columnHeaderId, type EditMode } from './GridRow';
import { AlertIcon, ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PlusIcon, TableIcon, TrashIcon } from './icons';
import {
  HIT_POLICY_LABELS,
  MAX_CONDITIONS_REASON,
  MAX_RESULTS_REASON,
  MAX_RULES_REASON,
  conditionName,
  gridProblemsText,
  resultName,
  rulesText,
  typeCode,
} from './labels';
import {
  MAX_CONDITIONS,
  MAX_RESULTS,
  MAX_RULES,
  addCondition,
  addResult,
  cellValue,
  columnCount,
  findTable,
  insertRule,
  moveRule,
  removeColumn,
  removeRule,
  setCell,
  setCells,
  updateTable,
  type DecisionTableNode,
} from './tableModel';
import { cellKey, placeOfPath, tableProblems } from './tableProblems';
import './decision-table.css';

/** Rows jumped by Page Up and Page Down. */
const PAGE_ROWS = 10;

export interface DecisionTableGridProps {
  /** The id of the Decision Table block in `root.nodes`. */
  nodeId: string;
  /** "Voltar ao canvas" and Esc (E4-22). */
  onClose: () => void;
}

/**
 * The rules of a Decision Table as a spreadsheet (E4-22), opened in place of the canvas by "Abrir tabela": conditions and
 * results split by a divider, rules numbered from 1, monospaced cells (an empty one shows `-`), keyboard of a spreadsheet
 * and pasting a block copied from Excel, which adds rules when it goes past the end. Each cell with a problem has a red
 * border, and its message shows when the cell gets the focus. Reads and changes the draft with `useDraftEditor`.
 */
export function DecisionTableGrid({ nodeId, onClose }: DecisionTableGridProps) {
  const { definition } = useDraftEditor();
  const found = findTable(definition, nodeId);
  if (!found) {
    return (
      <section className="fc-dt" aria-label="Tabela de Decisão" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
        <div className="fc-dt-bar">
          <BackButton onClose={onClose} />
        </div>
        <EmptyState
          className="fc-dt-empty-state"
          icon={<TableIcon />}
          title="Esta Tabela de Decisão não existe mais"
          description="Ela pode ter sido removida. Volte ao canvas para escolher outro bloco."
        />
      </section>
    );
  }
  return <TableGrid node={found.node} onClose={onClose} />;
}

function BackButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="small" icon={<ArrowLeftIcon size={14} />} onClick={onClose} aria-keyshortcuts="Escape">
      Voltar ao canvas
    </Button>
  );
}

interface Position {
  row: number;
  column: number;
}

interface Editing extends Position {
  mode: EditMode;
  /** The text before the editing, for Esc. */
  original: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function TableGrid({ node, onClose }: { node: DecisionTableNode; onClose: () => void }) {
  const editor = useDraftEditor();
  const { change, readOnly, selection, analyzedDefinition, problemsOutdated } = editor;
  const nodeId = node.id;
  const gridId = `fc-dt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const messageId = `${gridId}-message`;
  const gridRef = useRef<HTMLDivElement>(null);

  const conditions = node.conditions.length;
  const columns = columnCount(node);
  const rows = node.rules.length;

  const [active, setActive] = useState<Position>({ row: 0, column: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const focusPending = useRef(true);

  const activeRow = rows === 0 ? -1 : clamp(active.row, 0, rows - 1);
  const activeColumn = columns === 0 ? -1 : clamp(active.column, 0, columns - 1);
  const editingNow = editing && editing.row === activeRow && editing.column === activeColumn && !readOnly ? editing : null;

  // The latest values for the callbacks given to the rows (stable, so the memoized rows are not drawn again).
  const live = useRef({ node, activeRow, activeColumn, editing: editingNow });
  live.current = { node, activeRow, activeColumn, editing: editingNow };

  const editTable = useCallback(
    (update: (table: DecisionTableNode) => DecisionTableNode, mergeKey?: string) =>
      change((current) => updateTable(current, nodeId, update), mergeKey ? { mergeKey } : undefined),
    [change, nodeId],
  );

  const problems = useMemo(() => tableProblems(editor.problems, analyzedDefinition, node), [editor.problems, analyzedDefinition, node]);
  const invalidByRow = useMemo(() => {
    const byRow = new Map<number, string>();
    for (const key of problems.cells.keys()) {
      const [row, column] = key.split(':').map(Number) as [number, number];
      byRow.set(row, `${byRow.get(row) ?? '|'}${column}|`);
    }
    return byRow;
  }, [problems]);

  const columnNames = useMemo(
    () => [...node.conditions.map((condition, index) => conditionName(index, condition.expression)), ...node.results.map((result, index) => resultName(index, result.name))],
    [node.conditions, node.results],
  );

  const activeProblems = [
    ...(problems.rules.get(activeRow) ?? []),
    ...(problems.cells.get(cellKey(activeRow, activeColumn)) ?? []),
  ];

  // Focus: after a move, an edit or the opening, the active cell (or its field) takes the focus.
  useLayoutEffect(() => {
    if (!focusPending.current) return;
    const grid = gridRef.current;
    if (!grid) return;
    focusPending.current = false;
    const input = grid.querySelector<HTMLInputElement>('input[data-cell-input]');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    grid.querySelector<HTMLElement>(`[data-cell="${activeRow}:${activeColumn}"]`)?.focus();
  });

  // A problem chosen in the Problems tab (or a field of the selection) puts the active cell on it.
  const selectedField = selection.item.type === 'node' && selection.item.id === nodeId ? selection.field : null;
  useEffect(() => {
    if (!selectedField) return;
    const place = placeOfPath(selectedField, nodeId, analyzedDefinition, live.current.node, nodeId);
    if (place?.kind === 'cell' || place?.kind === 'rule') {
      setEditing(null);
      setActive({ row: place.row, column: place.kind === 'cell' ? place.column : 0 });
      focusPending.current = true;
    }
    // Only when the selection changes (a new click picks the same field again with a new selection).
    // The other values it reads (field, node, definition) are the ones of that same render; listing them would move the active cell again on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const moveTo = useCallback((row: number, column: number) => {
    setEditing(null);
    setActive({ row, column });
    focusPending.current = true;
  }, []);

  const cellMergeKey = (row: number, column: number) => `decision-table:${nodeId}:cell:${row}:${column}`;

  const onCellInput = useCallback(
    // Typed or pasted into the field: control characters never reach the draft.
    (row: number, column: number, value: string) =>
      editTable((table) => setCell(table, row, column, cleanCell(value)), `decision-table:${nodeId}:cell:${row}:${column}`),
    [editTable, nodeId],
  );

  const onEditEnd = useCallback(() => setEditing(null), []);

  function startEditing(mode: EditMode, typed?: string) {
    if (readOnly || activeRow < 0 || activeColumn < 0) return;
    const original = cellValue(node, node.rules[activeRow]!, activeColumn);
    if (typed !== undefined) editTable((table) => setCell(table, activeRow, activeColumn, cleanCell(typed)), cellMergeKey(activeRow, activeColumn));
    setEditing({ row: activeRow, column: activeColumn, mode, original });
    focusPending.current = true;
  }

  // Rules

  function includeRule() {
    if (readOnly || rows >= MAX_RULES) return;
    const at = rows === 0 ? 0 : activeRow + 1;
    editTable((table) => insertRule(table, at));
    moveTo(at, Math.max(activeColumn, 0));
    setAnnouncement(`Regra ${at + 1} incluída`);
  }

  function removeActiveRule() {
    if (readOnly || activeRow < 0) return;
    const row = activeRow;
    editTable((table) => removeRule(table, row));
    setEditing(null);
    setAnnouncement(`Regra ${row + 1} removida`);
  }

  function moveActiveRule(direction: -1 | 1, takeFocus: boolean) {
    const target = activeRow + direction;
    if (readOnly || activeRow < 0 || target < 0 || target >= rows) return;
    const row = activeRow;
    editTable((table) => moveRule(table, row, direction));
    setEditing(null);
    setActive({ row: target, column: activeColumn });
    if (takeFocus) focusPending.current = true;
    setAnnouncement(`Regra ${row + 1} movida para a posição ${target + 1}`);
  }

  // Columns

  function includeCondition() {
    if (readOnly || conditions >= MAX_CONDITIONS) return;
    editTable((table) => addCondition(table));
    setEditing(null);
    setActive({ row: activeRow, column: conditions });
    setAnnouncement(`Condição ${conditions + 1} incluída. Escreva a fórmula dela nas propriedades.`);
  }

  function includeResult() {
    if (readOnly || node.results.length >= MAX_RESULTS) return;
    const scale = editor.definition.settings.rounding.scale;
    const name = freeResultName(editor.definition);
    editTable((table) => addResult(table, { name, type: 'decimal', scale, default_value: null }));
    setEditing(null);
    setActive({ row: activeRow, column: columns });
    setAnnouncement(`Resultado ${name} incluído`);
  }

  function removeActiveColumn() {
    if (readOnly || activeColumn < 0) return;
    const column = activeColumn;
    const removed = column < conditions ? `Condição ${column + 1} removida` : `Resultado ${node.results[column - conditions]?.name ?? ''} removido`;
    editTable((table) => removeColumn(table, column));
    setEditing(null);
    setAnnouncement(removed);
  }

  // Keyboard

  function onCellKeyDown(event: KeyboardEvent<HTMLElement>) {
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
    const control = ctrlKey || metaKey;
    const lastRow = rows - 1;
    const lastColumn = columns - 1;

    if (altKey && !control && (key === 'ArrowUp' || key === 'ArrowDown')) {
      event.preventDefault();
      moveActiveRule(key === 'ArrowUp' ? -1 : 1, true);
      return;
    }
    if (altKey) return;

    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        moveTo(Math.max(activeRow - 1, 0), activeColumn);
        return;
      case 'ArrowDown':
        event.preventDefault();
        moveTo(Math.min(activeRow + 1, lastRow), activeColumn);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        moveTo(activeRow, Math.max(activeColumn - 1, 0));
        return;
      case 'ArrowRight':
        event.preventDefault();
        moveTo(activeRow, Math.min(activeColumn + 1, lastColumn));
        return;
      case 'Home':
        event.preventDefault();
        moveTo(control ? 0 : activeRow, 0);
        return;
      case 'End':
        event.preventDefault();
        moveTo(control ? lastRow : activeRow, lastColumn);
        return;
      case 'PageUp':
        event.preventDefault();
        moveTo(Math.max(activeRow - PAGE_ROWS, 0), activeColumn);
        return;
      case 'PageDown':
        event.preventDefault();
        moveTo(Math.min(activeRow + PAGE_ROWS, lastRow), activeColumn);
        return;
      case 'Tab': {
        const next = nextCell(activeRow, activeColumn, shiftKey ? -1 : 1);
        // Past the first or the last cell, Tab leaves the grid.
        if (!next) return;
        event.preventDefault();
        moveTo(next.row, next.column);
        return;
      }
      case 'Enter':
      case 'F2':
        event.preventDefault();
        startEditing('edit');
        return;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        if (!readOnly) editTable((table) => setCell(table, activeRow, activeColumn, ''));
        return;
      default:
        if (!control && key.length === 1 && !readOnly) {
          event.preventDefault();
          startEditing('replace', key);
        }
    }
  }

  function nextCell(row: number, column: number, step: -1 | 1): Position | null {
    let nextRow = row;
    let nextColumn = column + step;
    if (nextColumn >= columns) {
      nextRow += 1;
      nextColumn = 0;
    } else if (nextColumn < 0) {
      nextRow -= 1;
      nextColumn = columns - 1;
    }
    return nextRow < 0 || nextRow >= rows ? null : { row: nextRow, column: nextColumn };
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLElement>) {
    const current = editingNow;
    if (!current) return;
    const { key, shiftKey, altKey, ctrlKey, metaKey } = event;
    const plain = !altKey && !ctrlKey && !metaKey;
    switch (key) {
      case 'Enter':
        event.preventDefault();
        moveTo(clamp(activeRow + (shiftKey ? -1 : 1), 0, rows - 1), activeColumn);
        return;
      case 'Tab': {
        const next = nextCell(activeRow, activeColumn, shiftKey ? -1 : 1);
        // Past the first or the last cell, Tab leaves the grid (the text is already in the draft; the blur ends the editing).
        if (!next) return;
        event.preventDefault();
        moveTo(next.row, next.column);
        return;
      }
      case 'Escape': {
        event.preventDefault();
        event.stopPropagation();
        const { row, column, original } = current;
        // Nothing typed: no step in the history.
        if (cellValue(node, node.rules[row]!, column) !== original) {
          editTable((table) => setCell(table, row, column, original), cellMergeKey(row, column));
        }
        moveTo(row, column);
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // Typing that started on the cell: the arrows leave it, like in a spreadsheet. With Enter or F2 they move the caret.
        if (current.mode === 'replace' && plain) {
          event.preventDefault();
          const row = clamp(activeRow + (key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0), 0, rows - 1);
          const column = clamp(activeColumn + (key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0), 0, columns - 1);
          moveTo(row, column);
        }
        return;
      default:
    }
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.matches('input[data-cell-input]')) onInputKeyDown(event);
    else if (target.matches('[data-cell]')) onCellKeyDown(event);
  }

  function cellOf(target: EventTarget | null): Position | null {
    const cell = (target as HTMLElement | null)?.closest?.('[data-cell]');
    if (!cell || !gridRef.current?.contains(cell)) return null;
    const [row, column] = (cell.getAttribute('data-cell') ?? '').split(':').map(Number) as [number, number];
    return { row, column };
  }

  function onGridMouseDown(event: MouseEvent<HTMLDivElement>) {
    const cell = cellOf(event.target);
    if (!cell || (editingNow && cell.row === editingNow.row && cell.column === editingNow.column)) return;
    moveTo(cell.row, cell.column);
  }

  function onGridDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const cell = cellOf(event.target);
    if (!cell || readOnly) return;
    if (cell.row === activeRow && cell.column === activeColumn) startEditing('edit');
  }

  // Pasting a block copied from Excel: from the active cell, adding rules past the end (up to 500); columns past the last
  // one are left out. Text without tabs or line breaks, while typing in a cell, goes into the cell as usual (the field
  // cleans it, see onCellInput). The clipboard is data from outside: a text over 2 MB is refused with a message, and only
  // the cells that fit are kept, cleaned of line breaks and control characters.
  function onGridPaste(event: ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData('text/plain');
    const inInput = (event.target as HTMLElement).matches('input[data-cell-input]');
    const tooBig = text.length > MAX_PASTE_LENGTH;
    const block = !tooBig && isBlock(text);
    if (inInput && !tooBig && !block) return;
    event.preventDefault();
    if (readOnly || activeRow < 0 || activeColumn < 0) return;
    if (tooBig) {
      setAnnouncement('Colagem grande demais: o limite é de 2 MB de texto. Cole um bloco menor.');
      return;
    }
    const row = activeRow;
    const column = activeColumn;
    const parsed = block
      ? parseClipboard(text, { rows: MAX_RULES - row, columns: columns - column })
      : parseClipboard(text, { rows: 1, columns: 1 });
    if (parsed.rows === 0) return;
    const cells = block ? parsed.cells : [[parsed.cells[0]?.[0] ?? '']];
    const total = block ? parsed.rows : 1;
    const width = block ? parsed.width : 1;
    const fitRows = Math.min(total, MAX_RULES - row);
    const fitColumns = Math.min(width, columns - column);
    editTable((table) => setCells(table, row, column, cells));
    setEditing(null);
    focusPending.current = true;

    const added = Math.max(0, row + fitRows - rows);
    const parts = [`${fitRows} × ${fitColumns} ${fitRows * fitColumns === 1 ? 'célula colada' : 'células coladas'}`];
    if (added > 0) parts.push(`${rulesText(added)} ${added === 1 ? 'incluída' : 'incluídas'}`);
    if (total > fitRows) parts.push(`${total - fitRows} ${total - fitRows === 1 ? 'linha ficou' : 'linhas ficaram'} de fora: o limite é de 500 regras`);
    if (width > fitColumns) parts.push(`${width - fitColumns} ${width - fitColumns === 1 ? 'coluna ficou' : 'colunas ficaram'} de fora: a tabela não tem mais colunas à direita`);
    setAnnouncement(`${parts.join('. ')}.`);
  }

  // Copying the active cell (not while typing in it: the field copies its own selection).
  function onGridCopy(event: ClipboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).matches('input[data-cell-input]') || activeRow < 0 || activeColumn < 0) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', cellValue(node, node.rules[activeRow]!, activeColumn));
  }

  function onSectionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }

  const template = `48px repeat(${columns}, minmax(160px, 1fr))`;
  const minWidth = 48 + columns * 160;
  const noRuleReason = rows === 0 ? 'A tabela não tem regras' : undefined;

  return (
    <section className="fc-dt" aria-label={`Tabela de Decisão ${node.name}`} onKeyDown={onSectionKeyDown}>
      <div className="fc-dt-bar">
        <BackButton onClose={onClose} />
        <span className="fc-dt-title">
          <span className="fc-dt-category" aria-hidden="true" />
          <Text as="span" variant="mono-13" medium className="fc-dt-name">
            {node.name}
          </Text>
          <span className="fc-dt-kind">Tabela de Decisão</span>
        </span>
        <Text as="span" variant="label-13" emphasis="secondary">
          {HIT_POLICY_LABELS[node.hit_policy]} · {rulesText(rows)}
          {problems.inGrid > 0 ? ` · ${gridProblemsText(problems.inGrid)}` : ''}
        </Text>
      </div>

      {readOnly ? (
        <p className="fc-dt-read-only">
          <Text as="span" variant="label-12" emphasis="tertiary">
            Só leitura. {READ_ONLY_REASON}.
          </Text>
        </p>
      ) : (
        <div className="fc-dt-tools" role="toolbar" aria-label="Regras e colunas">
          <Button size="small" icon={<PlusIcon size={14} />} onClick={includeRule} disabledReason={rows >= MAX_RULES ? MAX_RULES_REASON : undefined}>
            Incluir regra
          </Button>
          <Button size="small" icon={<TrashIcon size={14} />} onClick={removeActiveRule} disabledReason={noRuleReason}>
            Remover regra
          </Button>
          <Button
            size="small"
            iconOnly
            icon={<ArrowUpIcon size={14} />}
            label="Mover regra para cima"
            aria-keyshortcuts="Alt+ArrowUp"
            onClick={() => moveActiveRule(-1, false)}
            disabledReason={noRuleReason ?? (activeRow === 0 ? 'Esta já é a primeira regra' : undefined)}
          />
          <Button
            size="small"
            iconOnly
            icon={<ArrowDownIcon size={14} />}
            label="Mover regra para baixo"
            aria-keyshortcuts="Alt+ArrowDown"
            onClick={() => moveActiveRule(1, false)}
            disabledReason={noRuleReason ?? (activeRow === rows - 1 ? 'Esta já é a última regra' : undefined)}
          />
          <span className="fc-dt-tools-divider" aria-hidden="true" />
          <Button
            size="small"
            icon={<PlusIcon size={14} />}
            onClick={includeCondition}
            disabledReason={conditions >= MAX_CONDITIONS ? MAX_CONDITIONS_REASON : undefined}
          >
            Incluir condição
          </Button>
          <Button
            size="small"
            icon={<PlusIcon size={14} />}
            onClick={includeResult}
            disabledReason={node.results.length >= MAX_RESULTS ? MAX_RESULTS_REASON : undefined}
          >
            Incluir resultado
          </Button>
          <Button
            size="small"
            icon={<TrashIcon size={14} />}
            onClick={removeActiveColumn}
            disabledReason={columns === 0 ? 'A tabela não tem colunas' : undefined}
          >
            Remover coluna
          </Button>
        </div>
      )}

      {columns === 0 ? (
        <EmptyState
          className="fc-dt-empty-state"
          icon={<TableIcon />}
          title="Nenhuma coluna ainda"
          description={readOnly ? 'Esta tabela não tem condições nem resultados.' : 'Inclua uma condição e um resultado para escrever as regras.'}
        />
      ) : (
        <div className="fc-dt-scroll">
          <div
            ref={gridRef}
            role="grid"
            id={gridId}
            className="fc-dt-grid"
            aria-label={`Regras de ${node.name}`}
            aria-rowcount={rows + 2}
            aria-colcount={columns + 1}
            aria-readonly={readOnly || undefined}
            style={{ minWidth }}
            onKeyDown={onGridKeyDown}
            onMouseDown={onGridMouseDown}
            onDoubleClick={onGridDoubleClick}
            onPaste={onGridPaste}
            onCopy={onGridCopy}
          >
            <div role="rowgroup" className="fc-dt-head">
              <div role="row" className="fc-dt-row fc-dt-groups" aria-rowindex={1} style={{ gridTemplateColumns: template }}>
                <div role="columnheader" className="fc-dt-corner" aria-colindex={1} aria-label="Regra" />
                {conditions > 0 ? (
                  <div role="columnheader" className="fc-dt-group" aria-colindex={2} aria-colspan={conditions} style={{ gridColumn: `2 / span ${conditions}` }}>
                    Condições
                  </div>
                ) : null}
                {node.results.length > 0 ? (
                  <div
                    role="columnheader"
                    className="fc-dt-group fc-dt-divider"
                    aria-colindex={conditions + 2}
                    aria-colspan={node.results.length}
                    style={{ gridColumn: `${conditions + 2} / span ${node.results.length}` }}
                  >
                    Resultados
                  </div>
                ) : null}
              </div>
              <div role="row" className="fc-dt-row fc-dt-columns" aria-rowindex={2} style={{ gridTemplateColumns: template }}>
                <div role="columnheader" className="fc-dt-corner" aria-colindex={1}>
                  <span aria-hidden="true">#</span>
                  <span className="fc-dt-visually-hidden">Regra</span>
                </div>
                {node.conditions.map((condition, index) => {
                  const invalid = (problems.fields.get(`condition:${index}`)?.length ?? 0) > 0;
                  return (
                    <div
                      key={`condition-${index}`}
                      role="columnheader"
                      id={columnHeaderId(gridId, index)}
                      className={['fc-dt-header', invalid ? 'fc-dt-invalid' : null].filter(Boolean).join(' ')}
                      aria-colindex={index + 2}
                      aria-label={columnNames[index]}
                      title={condition.expression || undefined}
                    >
                      {condition.expression.trim() ? (
                        <span className="fc-dt-header-formula">{condition.expression}</span>
                      ) : (
                        <span className="fc-dt-empty">sem fórmula</span>
                      )}
                    </div>
                  );
                })}
                {node.results.map((result, index) => {
                  const column = conditions + index;
                  const invalid = [...problems.fields.keys()].some((key) => key.startsWith(`result:${index}:`));
                  return (
                    <div
                      key={`result-${index}`}
                      role="columnheader"
                      id={columnHeaderId(gridId, column)}
                      className={['fc-dt-header', index === 0 ? 'fc-dt-divider' : null, invalid ? 'fc-dt-invalid' : null].filter(Boolean).join(' ')}
                      aria-colindex={column + 2}
                      aria-label={`${columnNames[column]}, ${typeCode(result.type, result.scale)}`}
                    >
                      <span className="fc-dt-header-formula">{result.name}</span>
                      <span className="fc-dt-header-type">{typeCode(result.type, result.scale)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div role="rowgroup" className="fc-dt-body">
              {/* key={row} by index on purpose: a row is a position in the grid (its number, its cells, the active cell), and
                  the rules have no id. Moving a rule draws again only the two rows that swapped (GridRow is memoized). */}
              {node.rules.map((rule, row) => {
                const isActive = row === activeRow;
                const hasMessage = isActive && activeProblems.length > 0;
                return (
                  <GridRow
                    key={row}
                    template={template}
                    conditions={node.conditions}
                    results={node.results}
                    rule={rule}
                    row={row}
                    activeColumn={isActive ? activeColumn : -1}
                    editingColumn={isActive && editingNow ? activeColumn : -1}
                    editMode={isActive && editingNow ? editingNow.mode : 'edit'}
                    invalidColumns={invalidByRow.get(row) ?? ''}
                    ruleInvalid={problems.rules.has(row)}
                    describedBy={hasMessage ? messageId : undefined}
                    columnNames={columnNames}
                    readOnly={readOnly}
                    onCellInput={onCellInput}
                    onEditEnd={onEditEnd}
                  />
                );
              })}
            </div>
          </div>
          {rows === 0 ? (
            <EmptyState
              className="fc-dt-empty-state"
              icon={<TableIcon />}
              title="Nenhuma regra ainda"
              description={readOnly ? 'Esta tabela não tem regras.' : 'Inclua a primeira regra da tabela.'}
              action={
                readOnly ? undefined : (
                  <Button size="small" icon={<PlusIcon size={14} />} onClick={includeRule}>
                    Incluir regra
                  </Button>
                )
              }
            />
          ) : null}
        </div>
      )}

      <div className="fc-dt-footer">
        {/* While the analysis of the latest change has not come back, the messages are older: dimmed and busy. */}
        <div
          id={messageId}
          className={['fc-dt-message', problemsOutdated ? 'fc-dt-outdated' : null].filter(Boolean).join(' ')}
        >
          {activeProblems.map((problem, index) => (
            <p key={index} className="fc-dt-message-line">
              <AlertIcon size={12} />
              <span>{problem.message}</span>
            </p>
          ))}
        </div>
        <p className="fc-dt-status" role="status" aria-busy={problemsOutdated || undefined}>
          {announcement}
        </p>
      </div>
    </section>
  );
}
