import { Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { readersText } from './messages';

export interface RemoveBlockDialogProps {
  /** The block name. */
  name: string;
  /** How many other blocks read its output (from the `dependencies` of the analysis). */
  readers: number;
  onRemove: () => void;
  /** Closed without removing (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  focusOnClose: DialogProps['focusOnClose'];
}

/** The confirmation of Delete on a block: says how many blocks use its output. The dangerous action is red (§7.7). */
export function RemoveBlockDialog({ name, readers, onRemove, onClose, focusOnClose }: RemoveBlockDialogProps) {
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
          <Button variant="danger" onClick={onRemove}>
            Remover bloco
          </Button>
        </>
      }
    />
  );
}
