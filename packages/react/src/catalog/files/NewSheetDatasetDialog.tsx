import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Dialog, DialogClose, Notice, TextField, type DialogProps } from '../../design-system';
import { createDatasetError } from './messages';
import { useCreateSheetDataset, type Dataset, type ExcelFile, type Sheet } from './queries';

const schema = z.object({ name: z.string().trim().min(1, 'Informe o nome do dataset') });
type FormFields = z.infer<typeof schema>;

export interface NewSheetDatasetDialogProps {
  file: ExcelFile;
  sheet: Sheet;
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
  /** Called on close without saving (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called with the dataset just created. */
  onCreated: (dataset: Dataset) => void;
}

/**
 * New dataset from a sheet of an Excel file: only the name, which starts as the sheet name; the columns and the types are
 * the sheet's. Mount it only while open.
 */
export function NewSheetDatasetDialog({ file, sheet, focusOnClose, onClose, onCreated }: NewSheetDatasetDialogProps) {
  const formId = useId();
  const create = useCreateSheetDataset();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(schema), defaultValues: { name: sheet.name } });
  const apiError = create.error ? createDatasetError(create.error) : undefined;

  const submit = handleSubmit((data) =>
    create.mutate({ fileId: file.id, sheet: sheet.name, name: data.name.trim() }, { onSuccess: onCreated }),
  );

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Novo dataset"
      description={`Da aba ${sheet.name} do arquivo ${file.file_name}. As colunas e os tipos são os que aparecem na aba.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-files-form" onSubmit={submit} noValidate>
        <TextField label="Nome" autoComplete="off" error={errors.name?.message ?? apiError?.name} {...register('name')} />
        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
