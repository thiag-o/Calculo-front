import { useState } from 'react';
import { Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { CHECKING_READERS_REASON, readersText } from './messages';

/**
 * Who reads the block's output: how many blocks (from the `dependencies` of an analysis of the definition on screen),
 * `checking` while that analysis is on the way, or `unknown` when it failed.
 */
export type Readers = number | 'checking' | 'unknown';

export interface RemoveBlockDialogProps {
  /** The block name. */
  name: string;
  readers: Readers;
  onRemove: () => void;
  /** Closed without removing (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  focusOnClose: DialogProps['focusOnClose'];
}

/**
 * The confirmation of Delete on a block: says how many blocks use its output. The dangerous action is red (§7.7). While
 * the count is being checked, "Remover bloco" waits for it (disabled, with the reason).
 */
export function RemoveBlockDialog({ name, readers, onRemove, onClose, focusOnClose }: RemoveBlockDialogProps) {
  const checking = readers === 'checking';
  // The description does not speak when it changes: the count that replaces "Conferindo…" is announced by a status region.
  const [waited, setWaited] = useState(false);
  if (checking && !waited) setWaited(true);
  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover bloco"
      description={`${name} sai do rascunho. ${readersText(readers)} Ctrl Z desfaz.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button variant="danger" onClick={onRemove} disabledReason={checking ? CHECKING_READERS_REASON : undefined}>
            Remover bloco
          </Button>
        </>
      }
    >
      <p className="fc-canvas-visually-hidden" role="status">
        {waited && !checking ? readersText(readers) : ''}
      </p>
    </Dialog>
  );
}
