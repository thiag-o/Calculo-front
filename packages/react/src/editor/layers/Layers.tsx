import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { textClasses } from '../../design-system';
import { useBlockRemoval } from '../canvas';
import { useAnnouncement } from '../canvas/announcement';
import { WORKFLOW_ITEM, sameItem, useDraftEditor, type EditorItem, type WorkflowDefinition } from '../draft';
import { useProblemCounts, type ProblemCounts } from '../problems';
import { AlertIcon, ChevronDownIcon, ChevronRightIcon } from './icons';
import './layers.css';

type RowKind = 'inputs' | 'input' | 'field' | 'calculation' | 'decision_table' | 'source' | 'group' | 'output' | 'output-field';

/** One item of the tree. */
interface Row {
  key: string;
  /** 1 for Entradas, the blocks and Saída; deeper for what is inside them. */
  level: number;
  /** The row this one is inside (`null` on the first level). */
  parent: string | null;
  kind: RowKind;
  label: string;
  /** What a click or Enter selects: the row's own item, or the item of the bar it belongs to. */
  item: EditorItem;
  /** The row is that item (Entradas, a block, Saída), not a part of it. */
  own: boolean;
  problems: number;
  hasChildren: boolean;
  /** Position among its siblings (1…), for `aria-posinset` and `aria-setsize`. */
  position: number;
  siblings: number;
}

const KIND_TEXT: Partial<Record<RowKind, string>> = {
  calculation: 'Cálculo',
  decision_table: 'Tabela de Decisão',
};

function problemsText(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The tree: Entradas (inputs, a multiple one with its fields) › the blocks in the order of `root.nodes` › Saída (fields). */
function treeRows(definition: WorkflowDefinition, counts: ProblemCounts): Row[] {
  const rows: Row[] = [];
  const { inputs, nodes, output } = definition.root;
  const top = 2 + nodes.length;
  const inputsItem: EditorItem = { type: 'inputs' };
  const outputItem: EditorItem = { type: 'output' };

  rows.push({
    key: 'inputs',
    level: 1,
    parent: null,
    kind: 'inputs',
    label: 'Entradas',
    item: inputsItem,
    own: true,
    problems: counts.inputs,
    hasChildren: inputs.length > 0,
    position: 1,
    siblings: top,
  });
  inputs.forEach((input, index) => {
    const key = `input:${index}`;
    rows.push({
      key,
      level: 2,
      parent: 'inputs',
      kind: 'input',
      label: input.cardinality === 'multiple' ? `${input.name}[]` : input.name,
      item: inputsItem,
      own: false,
      problems: 0,
      hasChildren: input.cardinality === 'multiple' && input.fields.length > 0,
      position: index + 1,
      siblings: inputs.length,
    });
    if (input.cardinality === 'multiple') {
      input.fields.forEach((field, fieldIndex) =>
        rows.push({
          key: `${key}:field:${fieldIndex}`,
          level: 3,
          parent: key,
          kind: 'field',
          label: field.name,
          item: inputsItem,
          own: false,
          problems: 0,
          hasChildren: false,
          position: fieldIndex + 1,
          siblings: input.fields.length,
        }),
      );
    }
  });
  nodes.forEach((node, index) =>
    rows.push({
      key: `node:${node.id}`,
      level: 1,
      parent: null,
      kind: node.type,
      label: node.name || node.id,
      item: { type: 'node', id: node.id },
      own: true,
      problems: counts.byNode.get(node.id) ?? 0,
      hasChildren: false,
      position: index + 2,
      siblings: top,
    }),
  );
  rows.push({
    key: 'output',
    level: 1,
    parent: null,
    kind: 'output',
    label: 'Saída',
    item: outputItem,
    own: true,
    problems: counts.output,
    hasChildren: output.fields.length > 0,
    position: top,
    siblings: top,
  });
  output.fields.forEach((field, index) =>
    rows.push({
      key: `output:${index}`,
      level: 2,
      parent: 'output',
      kind: 'output-field',
      label: field.name,
      item: outputItem,
      own: false,
      problems: 0,
      hasChildren: false,
      position: index + 1,
      siblings: output.fields.length,
    }),
  );
  return rows;
}

/**
 * The Camadas panel (estilos.md §8, §9 and §14): the tree Entradas › blocks (in the order of `root.nodes`) › Saída, in
 * mono-13, with the red problem icon on the items that have problems. The selection is the editor's (`useDraftEditor`),
 * the same as the canvas and the properties: a click, Enter or Space selects the item (a part of Entradas or Saída
 * selects the bar). Keyboard of a WAI-ARIA tree: up and down arrows, right and left open, close and go in and out,
 * Home and End. As on the canvas, Esc clears the selection and Delete removes a block (with the same confirmation, the
 * announcement and the focus on the neighbour block afterwards).
 */
export function Layers() {
  const { definition, selection, select, readOnly } = useDraftEditor();
  const counts = useProblemCounts();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  // The row last focused here, with the selection it had then: once the selection changes in another panel, the Tab
  // stop follows the selection instead.
  const [focused, setFocused] = useState<{ key: string; item: EditorItem } | null>(null);
  const [announcement, setAnnouncement] = useAnnouncement();
  const tree = useRef<HTMLUListElement>(null);
  const rowElement = (key: string) => tree.current?.querySelector<HTMLElement>(`[data-key="${key}"]`) ?? null;
  const removal = useBlockRemoval({
    announce: setAnnouncement,
    focusAfterRemoval: (neighbour) => (neighbour === null ? null : rowElement(`node:${neighbour}`)) ?? rowElement('inputs'),
    focusOnCancel: (id) => rowElement(`node:${id}`),
  });

  const rows = useMemo(() => treeRows(definition, counts), [definition, counts]);
  const visible = useMemo(() => {
    const hidden = new Set<string>();
    return rows.filter((row) => {
      if (row.parent !== null && (hidden.has(row.parent) || collapsed.has(row.parent))) {
        hidden.add(row.key);
        return false;
      }
      return true;
    });
  }, [rows, collapsed]);

  const isSelected = (row: Row) => row.own && sameItem(row.item, selection.item);
  // One Tab stop: the row last focused (while the selection is still the one it had), or the selected one, or the first.
  const lastFocused = focused && sameItem(focused.item, selection.item) ? visible.find((row) => row.key === focused.key) : undefined;
  const current = lastFocused ?? visible.find(isSelected) ?? visible[0];

  const focusRow = (key: string) => {
    setFocused({ key, item: selection.item });
    rowElement(key)?.focus();
  };

  const toggle = (key: string, open: boolean) =>
    setCollapsed((keys) => {
      const next = new Set(keys);
      if (open) next.delete(key);
      else next.add(key);
      return next;
    });

  const choose = (row: Row) => {
    setFocused({ key: row.key, item: row.item });
    if (!sameItem(row.item, selection.item)) select(row.item);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, row: Row) => {
    const index = visible.indexOf(row);
    const expanded = row.hasChildren && !collapsed.has(row.key);
    let next: Row | undefined;
    switch (event.key) {
      case 'ArrowDown':
        next = visible[index + 1];
        break;
      case 'ArrowUp':
        next = visible[index - 1];
        break;
      case 'Home':
        next = visible[0];
        break;
      case 'End':
        next = visible[visible.length - 1];
        break;
      case 'ArrowRight':
        if (row.hasChildren && !expanded) toggle(row.key, true);
        else if (expanded) next = visible[index + 1];
        break;
      case 'ArrowLeft':
        if (expanded) toggle(row.key, false);
        else if (row.parent !== null) next = visible.find((candidate) => candidate.key === row.parent);
        break;
      case 'Enter':
      case ' ':
        choose(row);
        break;
      case 'Escape':
        // Nothing selected: Esc goes on to whoever closes the panel or the menu.
        if (sameItem(selection.item, WORKFLOW_ITEM)) return;
        setFocused({ key: row.key, item: WORKFLOW_ITEM });
        select(WORKFLOW_ITEM);
        break;
      case 'Delete':
        if (!row.own || row.item.type !== 'node' || readOnly) return;
        choose(row);
        removal.ask(row.item.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next) focusRow(next.key);
  };

  return (
    <div className="fc-layers">
      <ul ref={tree} className="fc-layers-tree" role="tree" aria-label="Camadas">
        {visible.map((row) => {
          const expanded = row.hasChildren ? !collapsed.has(row.key) : undefined;
          const selected = isSelected(row);
          return (
            <li
              key={row.key}
              data-key={row.key}
              className="fc-layers-item"
              role="treeitem"
              aria-level={row.level}
              aria-posinset={row.position}
              aria-setsize={row.siblings}
              aria-expanded={expanded}
              aria-selected={selected}
              data-selected={selected ? 'true' : undefined}
              data-own={row.own ? 'true' : undefined}
              tabIndex={row === current ? 0 : -1}
              style={{ paddingLeft: `calc(var(--fc-space-8) + ${row.level - 1} * 20px)` }}
              onClick={() => choose(row)}
              onFocus={() => setFocused({ key: row.key, item: selection.item })}
              onKeyDown={(event) => onKeyDown(event, row)}
            >
              {row.hasChildren ? (
                <span
                  className="fc-layers-toggle"
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFocused({ key: row.key, item: selection.item });
                    toggle(row.key, collapsed.has(row.key));
                  }}
                >
                  {expanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                </span>
              ) : (
                <span className="fc-layers-toggle" aria-hidden="true" />
              )}
              {row.own ? <span className="fc-layers-category" data-kind={row.kind} aria-hidden="true" /> : null}
              <span className={`fc-layers-label ${textClasses({ variant: 'mono-13' })}`}>{row.label}</span>
              {KIND_TEXT[row.kind] ? <span className="fc-layers-visually-hidden">, {KIND_TEXT[row.kind]}</span> : null}
              {row.problems > 0 ? (
                <span className="fc-layers-problem" role="img" aria-label={problemsText(row.problems)}>
                  <AlertIcon size={14} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="fc-layers-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      {removal.dialog}
    </div>
  );
}
