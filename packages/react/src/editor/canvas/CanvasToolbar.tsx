import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../design-system';
import { GROUP_ACTION } from '../groups';
import type { NewBlockKind } from './graph';
import { BLOCK_KIND_LABELS, SOURCE_TOOL_LABEL } from './messages';

/** The tools in order: the two blocks that start empty and the Fonte, which asks for its dataset first. */
const KINDS: readonly (NewBlockKind | 'source')[] = ['calculation', 'decision_table', 'source'];

export interface CanvasToolbarProps {
  onAdd: (kind: NewBlockKind) => void;
  /** Fonte: the dialog that asks for the dataset opens (the block needs one). */
  onAddSource: () => void;
  /** From 1280px of module width down, only the category squares, with the name in the tooltip (estilos §15). */
  compact: boolean;
  /** Agrupar: the picked blocks (or the selected one) go into a new group. */
  onGroup: () => void;
  /** Why Agrupar is disabled (nothing picked, or blocks of different groups). */
  groupReason?: string;
}

/**
 * The floating toolbar at the bottom center of the canvas (estilos §8): one button per block type (Cálculo, Tabela de Decisão and Fonte), each with its category
 * square (a toolbar in WAI-ARIA: one Tab stop, the arrows go between the buttons), and Agrupar, with the group square.
 */
export function CanvasToolbar({ onAdd, onAddSource, compact, onGroup, groupReason }: CanvasToolbarProps) {
  const [current, setCurrent] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? KINDS.length - 1 : step === 0 ? null : (current + step + KINDS.length) % KINDS.length;
    if (next === null) return;
    event.preventDefault();
    setCurrent(next);
    buttons.current[next]?.focus();
  };

  const groupSquare = <span className="fc-canvas-category" data-kind="group" aria-hidden="true" />;
  const group = {
    variant: 'ghost' as const,
    size: 'small' as const,
    icon: groupSquare,
    disabledReason: groupReason,
    onClick: onGroup,
    className: 'fc-canvas-tool',
  };

  return (
    <div className="fc-canvas-toolbar">
      <div className="fc-canvas-tools" role="toolbar" aria-label="Incluir bloco" aria-orientation="horizontal" onKeyDown={onKeyDown}>
        {KINDS.map((kind, index) => {
          const square = <span className="fc-canvas-category" data-kind={kind} aria-hidden="true" />;
          const common = {
            ref: (element: HTMLButtonElement | null) => {
              buttons.current[index] = element;
            },
            variant: 'ghost' as const,
            size: 'small' as const,
            icon: square,
            tabIndex: index === current ? 0 : -1,
            onFocus: () => setCurrent(index),
            onClick: () => (kind === 'source' ? onAddSource() : onAdd(kind)),
            className: 'fc-canvas-tool',
          };
          const label = kind === 'source' ? SOURCE_TOOL_LABEL : BLOCK_KIND_LABELS[kind];
          return compact ? (
            <Button key={kind} {...common} iconOnly label={label} />
          ) : (
            <Button key={kind} {...common}>
              {label}
            </Button>
          );
        })}
      </div>
      <span className="fc-canvas-toolbar-divider" aria-hidden="true" />
      {compact ? <Button {...group} iconOnly label={GROUP_ACTION} /> : <Button {...group}>{GROUP_ACTION}</Button>}
    </div>
  );
}
