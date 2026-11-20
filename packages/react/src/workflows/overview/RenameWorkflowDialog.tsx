import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Notice, TextField, type DialogProps } from '../../design-system';
import { useUpdateWorkflow, type Workflow } from '../queries';
import { GONE_REASON, renameError } from './messages';
import './overview.css';

/** Limits of the contract (`WorkflowUpdate`, the same as `NewWorkflow`). */
const NAME_MAX = 200;
const OBJECTIVE_MAX = 1000;

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do workflow').max(NAME_MAX, `Use até ${NAME_MAX} caracteres no nome`),
  objective: z.string().trim().max(OBJECTIVE_MAX, `Use até ${OBJECTIVE_MAX} caracteres no objetivo`),
});
type FormFields = z.infer<typeof schema>;

export interface RenameWorkflowDialogProps {
  workflow: Workflow;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
  /** Who gets focus on close (the "…" button that opened the menu). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Renomear": the workflow name and objective (`PUT /v1/workflows/{id}`). The draft does not change. A repeated name
 * (`workflow_exists`) shows in the name field. Mount it only while open.
 */
export function RenameWorkflowDialog({ workflow, onClose, focusOnClose }: RenameWorkflowDialogProps) {
  const formId = useId();
  const update = useUpdateWorkflow();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
    defaultValues: { name: workflow.name, objective: workflow.objective ?? '' },
  });
  const apiError = update.error ? renameError(update.error) : undefined;
  const gone = update.error instanceof ApiError && update.error.code === 'not_found';
  // The API error is about what was sent: once the person changes a field, it goes away (except "gone", which stays).
  const clearApiError = () => {
    if (update.isError && !gone) update.reset();
  };

  const submit = handleSubmit((data) =>
    update.mutate(
      { id: workflow.id, body: { name: data.name, objective: data.objective === '' ? null : data.objective } },
      { onSuccess: onClose },
    ),
  );

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Renomear workflow"
      description="Muda o nome e o objetivo. O rascunho continua como está."
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={update.isPending}
            disabledReason={gone ? GONE_REASON : undefined}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-workflow-overview-form" onSubmit={submit} noValidate>
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
