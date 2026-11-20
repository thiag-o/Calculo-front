import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../design-system';
import type { BlockKind } from './graph';
import { BLOCK_KIND_LABELS } from './messages';

const KINDS: readonly BlockKind[] = ['calculation', 'decision_table'];

export interface CanvasToolbarProps {
  onAdd: (kind: BlockKind) => void;
  /** From 1280px of module width down, only the category squares, with the name in the tooltip (estilos §15). */
  compact: boolean;
}

/**
 * The floating toolbar at the bottom center of the canvas (estilos §8): one button per block type, each with its category
 * square. A toolbar (WAI-ARIA): one Tab stop, the arrows go between the buttons.
 */
export function CanvasToolbar({ onAdd, compact }: CanvasToolbarProps) {
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

  return (
    <div className="fc-canvas-toolbar" role="toolbar" aria-label="Incluir bloco" aria-orientation="horizontal" onKeyDown={onKeyDown}>
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
          onClick: () => onAdd(kind),
          className: 'fc-canvas-tool',
        };
        return compact ? (
          <Button key={kind} {...common} iconOnly label={BLOCK_KIND_LABELS[kind]} />
        ) : (
          <Button key={kind} {...common}>
            {BLOCK_KIND_LABELS[kind]}
          </Button>
        );
      })}
    </div>
  );
}
