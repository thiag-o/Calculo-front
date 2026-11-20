// Removing a block with Delete, from the canvas or from the layers: the confirmation that says who uses its output, the
// announcement and where the focus goes afterwards. One hook, so both panels behave the same.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { WORKFLOW_ITEM, useDraftEditor } from '../draft';
import { blockRemovedText } from './messages';
import { readersOf } from './graph';
import { removeBlock } from './blocks';
import { RemoveBlockDialog, type Readers } from './RemoveBlockDialog';

export interface BlockRemovalOptions {
  /** Tells screen readers that the block went away (the panel's `role="status"` region). */
  announce: (text: string) => void;
  /**
   * The element that takes the focus after the removal: the one of the neighbour block (the next in `root.nodes`, or
   * the previous when it was the last), or the panel's own when no block is left (`neighbourId` null).
   */
  focusAfterRemoval: (neighbourId: string | null) => HTMLElement | null;
  /** The element that gets the focus back when the confirmation closes without removing (the block itself). */
  focusOnCancel: (id: string) => HTMLElement | null;
}

export interface BlockRemoval {
  /** Delete on a block: opens the confirmation. Does nothing in read-only. */
  ask: (id: string) => void;
  /** The confirmation, while it is open (render it inside the panel). */
  dialog: ReactNode;
}

/**
 * The Delete of a block. The confirmation says how many blocks read its output, by the `dependencies` of the analysis,
 * but only when the analysis is of the definition on screen: while the analysis of the latest change is on the way
 * (`problemsOutdated`) the count could be wrong, so it says "Conferindo quem usa este bloco…" and waits ("Remover bloco"
 * stays disabled). When that analysis failed, it says the check was not possible and lets the block go (Ctrl Z undoes).
 * After removing, the selection goes back to the workflow, the removal is announced and the focus goes to the neighbour
 * block, or to the panel.
 */
export function useBlockRemoval({ announce, focusAfterRemoval, focusOnCancel }: BlockRemovalOptions): BlockRemoval {
  const { definition, symbols, dependencies, problemsOutdated, analysisFailed, readOnly, change, select } = useDraftEditor();
  const [removing, setRemoving] = useState<string | null>(null);
  // How the confirmation closed: removed (with the neighbour that takes the focus) or not.
  const closing = useRef<{ id: string; removed: boolean; neighbour: string | null } | null>(null);

  const ask = useCallback(
    (id: string) => {
      if (readOnly) return;
      closing.current = { id, removed: false, neighbour: null };
      setRemoving(id);
    },
    [readOnly],
  );

  const block = removing === null ? undefined : definition.root.nodes.find((node) => node.id === removing);
  let readers: Readers = 'checking';
  if (!problemsOutdated) readers = block ? readersOf(block.id, definition, symbols, dependencies) : 0;
  else if (analysisFailed) readers = 'unknown';

  const dialog = block ? (
    <RemoveBlockDialog
      name={block.name}
      readers={readers}
      onClose={() => setRemoving(null)}
      onRemove={() => {
        const nodes = definition.root.nodes;
        const index = nodes.findIndex((node) => node.id === block.id);
        const neighbour = nodes[index + 1] ?? nodes[index - 1] ?? null;
        closing.current = { id: block.id, removed: true, neighbour: neighbour?.id ?? null };
        setRemoving(null);
        change((current) => removeBlock(current, block.id));
        select(WORKFLOW_ITEM);
        announce(blockRemovedText(block.name));
      }}
      focusOnClose={() => {
        const closed = closing.current;
        if (!closed) return null;
        return closed.removed ? focusAfterRemoval(closed.neighbour) : focusOnCancel(closed.id);
      }}
    />
  ) : null;

  return { ask, dialog };
}
