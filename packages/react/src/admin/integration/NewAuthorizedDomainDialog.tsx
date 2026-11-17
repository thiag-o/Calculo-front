import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, TextField, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { useCreateAuthorizedDomain } from './queries';
import { newAuthorizedDomainError } from './messages';
import { originProblem } from './origin';

const schema = z.object({
  origin: z
    .string()
    .trim()
    .superRefine((origin, context) => {
      const problem = originProblem(origin);
      if (problem) context.addIssue({ code: 'custom', message: problem });
    }),
});

type NewAuthorizedDomainData = z.infer<typeof schema>;

export interface NewAuthorizedDomainDialogProps {
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Novo domínio": registers the origin from which the embedded module may call the API with the tenant token. The origin is
 * validated on the client (`https?://host[:port]`) and again by the API, which stores it normalized.
 */
export function NewAuthorizedDomainDialog({ onClose, focusOnClose }: NewAuthorizedDomainDialogProps) {
  const formId = useId();
  const create = useCreateAuthorizedDomain();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewAuthorizedDomainData>({ resolver: zodResolver(schema), defaultValues: { origin: '' } });

  const apiError = create.error ? newAuthorizedDomainError(create.error) : undefined;

  const submit = handleSubmit((data) => {
    if (create.isPending) return;
    create.mutate({ origem: data.origin }, { onSuccess: onClose });
  });

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Novo domínio"
      description="Só as origens autorizadas podem usar o módulo incorporado pelo navegador com o token deste tenant."
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
      <form id={formId} className="fc-integration-form" onSubmit={submit} noValidate>
        <TextField
          label="Origem"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://app.exemplo.com.br"
          tooltip="Esquema, host e, se precisar, a porta. Sem caminho no fim."
          error={errors.origin?.message ?? apiError?.field}
          {...register('origin')}
        />
        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
