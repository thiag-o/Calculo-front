import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Dialog, DialogClose, Notice, TextField, type DialogProps } from '../../design-system';
import { useCreateWorkflow, type Workflow } from '../queries';
import { saveError } from './messages';
import './workflow-list.css';

/** Limits of the contract (`NewWorkflow`). */
const NAME_MAX = 200;
const OBJECTIVE_MAX = 1000;

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do workflow').max(NAME_MAX, `Use até ${NAME_MAX} caracteres no nome`),
  objective: z.string().trim().max(OBJECTIVE_MAX, `Use até ${OBJECTIVE_MAX} caracteres no objetivo`),
});
type FormFields = z.infer<typeof schema>;

export interface NewWorkflowDialogProps {
  /** Called on close without saving (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called with the new workflow, after saving. The caller closes the dialog and opens the workflow's Overview. */
  onCreated: (workflow: Workflow) => void;
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Novo workflow": name and objective (optional). A repeated name (`workflow_exists`) shows in the name field.
 * The workflow is born with the empty draft. Mount it only while open; needs `ApiProvider`, `QueryClientProvider`
 * and `FluxoRoot` (dialog portal).
 */
export function NewWorkflowDialog({ onClose, onCreated, focusOnClose }: NewWorkflowDialogProps) {
  const formId = useId();
  const create = useCreateWorkflow();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(schema), defaultValues: { name: '', objective: '' } });
  const apiError = create.error ? saveError(create.error) : undefined;
  // The API error is about what was sent: once the person changes a field, it goes away.
  const clearApiError = () => {
    if (create.isError) create.reset();
  };

  const submit = handleSubmit((data) =>
    create.mutate({ name: data.name, objective: data.objective === '' ? null : data.objective }, { onSuccess: onCreated }),
  );

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Novo workflow"
      description="O workflow nasce com o rascunho vazio. Depois de salvar, abra o editor para montar o cálculo."
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
      <form id={formId} className="fc-workflows-form" onSubmit={submit} noValidate>
        <TextField
          label="Nome"
          autoComplete="off"
          maxLength={NAME_MAX}
          error={errors.name?.message ?? apiError?.fields.name}
          {...register('name', { onChange: clearApiError })}
        />
        <TextField
          label="Objetivo"
          tooltip="Opcional. O que o workflow calcula, em uma frase."
          autoComplete="off"
          maxLength={OBJECTIVE_MAX}
          error={errors.objective?.message ?? apiError?.fields.objective}
          {...register('objective', { onChange: clearApiError })}
        />
        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
