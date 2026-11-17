import { Button, Dialog, DialogClose, Notice, type DialogProps } from '../../design-system';
import { deleteErrorMessage } from './messages';
import { errorWithCode, useDeleteExcelFile, type ExcelFile } from './queries';

export const IN_USE_REASON = 'O arquivo é usado por datasets';
export const NOT_FOUND_REASON = 'O arquivo já foi removido';

export interface DeleteExcelFileDialogProps {
  file: ExcelFile;
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
  /** Called on close without deleting (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after deleting. */
  onDeleted: () => void;
}

/**
 * Confirmation to delete an Excel file and the stored copy. The dangerous action is red (estilos.md §7.7). A file used by a
 * dataset is not deleted (`excel_file_in_use`): the dialog says what to do and the button stays disabled with the reason.
 */
export function DeleteExcelFileDialog({ file, focusOnClose, onClose, onDeleted }: DeleteExcelFileDialogProps) {
  const deletion = useDeleteExcelFile();
  const error = deletion.error;
  const disabledReason = errorWithCode(error, ['excel_file_in_use'])
    ? IN_USE_REASON
    : errorWithCode(error, ['not_found'])
      ? NOT_FOUND_REASON
      : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover arquivo"
      description={`${file.file_name} sai do catálogo e a cópia guardada é apagada. Não é possível desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deletion.isPending}
            disabledReason={disabledReason}
            onClick={() => deletion.mutate(file.id, { onSuccess: onDeleted })}
          >
            Remover arquivo
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
