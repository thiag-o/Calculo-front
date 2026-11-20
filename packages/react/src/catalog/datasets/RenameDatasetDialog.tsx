import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, TextField, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { ReloadNotice } from '../errors';
import { useReloadDataset, useRenameDataset, type Dataset } from './queries';
import { renameError } from './messages';

const schema = z.object({ name: z.string().trim().min(1, 'Informe o nome do dataset') });
type FormFields = z.infer<typeof schema>;

export interface RenameDatasetDialogProps {
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
  dataset: Dataset;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
}

/** Renames a dataset. The columns, the origin and the variables stay as they are. Mount it only while open. */
export function RenameDatasetDialog({ dataset, onClose, focusOnClose }: RenameDatasetDialogProps) {
  const formId = useId();
  const rename = useRenameDataset();
  const reloadDataset = useReloadDataset(dataset.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(schema), defaultValues: { name: dataset.name } });
  const apiError = rename.error ? renameError(rename.error) : undefined;

  const submit = handleSubmit((data) => rename.mutate({ id: dataset.id, name: data.name }, { onSuccess: onClose }));

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Renomear dataset"
      description="O nome muda só aqui; as colunas, a origem e as variáveis continuam as mesmas."
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={rename.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-datasets-form" onSubmit={submit} noValidate>
        <TextField label="Nome" autoComplete="off" error={errors.name?.message ?? apiError?.fields.name} {...register('name')} />
        {apiError?.message && apiError.conflict ? (
          // The dialog closes only after the fetch works, so what was typed stays when it fails.
          <ReloadNotice
            message={apiError.message}
            onReload={async () => {
              await reloadDataset();
              onClose();
            }}
          />
        ) : apiError?.message ? (
          <Notice type="error">{apiError.message}</Notice>
        ) : null}
      </form>
    </Dialog>
  );
}
