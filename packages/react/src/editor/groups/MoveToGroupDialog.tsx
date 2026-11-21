import { useState } from 'react';
import { Button, Dialog, DialogClose, Select } from '../../design-system';

export interface MoveToGroupDialogProps {
  /** The block or group being moved. */
  name: string;
  /** The groups it can go into (`moveTargets`), with the path of each one ("Pontuação › Bônus"). */
  targets: readonly { id: string; label: string }[];
  onMove: (groupId: string) => void;
  onClose: () => void;
  /** Who gets the focus back when the dialog closes (the node, on the canvas). */
  focusOnClose?: () => HTMLElement | null | undefined;
}

/**
 * "Mover para o grupo…" (E5-19): the only way a block goes into another group, never by dragging, because the group
 * decides what its formulas see. The group is chosen from a list; "Mover" moves it.
 */
export function MoveToGroupDialog({ name, targets, onMove, onClose, focusOnClose }: MoveToGroupDialogProps) {
  const [target, setTarget] = useState(targets[0]?.id ?? '');
  return (
    <Dialog
      open
      title="Mover para o grupo"
      description={`${name} passa a ver as variáveis do grupo escolhido, e só o Output do grupo o deixa ser visto de fora.`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      focusOnClose={focusOnClose}
      actions={
        <>
          <DialogClose>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="primary" disabledReason={target ? undefined : 'Escolha o grupo'} onClick={() => onMove(target)}>
            Mover
          </Button>
        </>
      }
    >
      <Select label="Grupo" value={target} options={targets.map((option) => ({ value: option.id, label: option.label }))} onValueChange={setTarget} />
    </Dialog>
  );
}
