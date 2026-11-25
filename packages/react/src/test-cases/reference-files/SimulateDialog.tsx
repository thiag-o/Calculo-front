import { useId, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Loading, Notice, Skeleton, Text, type DialogProps } from '../../design-system';
import { ParameterForm, parameterErrorsFrom, useParameterForm, type WorkflowParameter } from '../../executions';
import { isSameSessionData } from '../../session';
import { recordCount } from './format';
import { draftErrorMessage, problemCount, problemsReason, revisionNote, simulateErrorMessage } from './messages';
import { useSavedDraft, useSimulate, type ReferenceFile, type Simulation } from './queries';

const NO_PARAMETERS: readonly WorkflowParameter[] = [];

/** The `409` that say the saved draft is no longer the one on screen (new revision or problems): it is read again. */
const DRAFT_CHANGED_CODES: ReadonlySet<string> = new Set(['draft_conflict', 'draft_has_problems']);

/** The reason beside the disabled "Cancelar" while the simulation is sent (estilos.md §14). */
export const SENDING_REASON = 'Aguarde o envio da simulação';

export interface SimulateDialogProps {
  workflowId: string;
  file: ReferenceFile;
  /** Called on close without simulating (Cancelar, Esc or "Fechar"). Never while the simulation is sent. */
  onClose: () => void;
  /** Called with the new simulation (`pending`): the caller closes the dialog and opens its panel (E7-25). */
  onSimulated: (simulation: Simulation) => void;
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Simular" (E7-25): runs the **saved** draft as a simulation (no delivery) and compares it with the reference file. Reads
 * the saved draft at every opening and says its revision ("Simula o rascunho salvo (revisão N)…"), the parameters form of
 * `executions` (ADR 0062) and, while the draft has problems, the button disabled with the reason. A `422` of a parameter goes
 * to its field; any other error, to a note (the `409 reference_file_mismatch` with the API message). While the simulation is
 * sent the dialog is locked (ADR 0064), so it never goes out twice. Mount it only while open; needs `ApiProvider`,
 * `QueryClientProvider` and `FluxoRoot` (dialog portal).
 */
export function SimulateDialog({ workflowId, file, onClose, onSimulated, focusOnClose }: SimulateDialogProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const draftQuery = useSavedDraft(workflowId);
  const simulate = useSimulate(workflowId, file.id);
  const sending = simulate.isPending;
  const draft = draftQuery.data;
  const form = useParameterForm(draft?.definition.parameters ?? NO_PARAMETERS, { workflowId });
  const problems = draft?.problems.length ?? 0;
  // A parameter error is shown at its field; any other error, in the note.
  const error = simulate.error && parameterErrorsFrom(simulate.error) === null ? simulateErrorMessage(simulate.error) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || problems > 0 || sending) return;
    simulate.reset();
    const reading = form.read();
    if (!reading.ok) return;
    simulate.mutate(
      { revision: draft.revision, parameters: reading.parameters },
      {
        // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) opens nothing (ADR 0015).
        onSuccess: (simulation, _body, mark) => {
          if (isSameSessionData(queryClient, mark)) onSimulated(simulation);
        },
        onError: (failure, _body, mark) => {
          if (!isSameSessionData(queryClient, mark) || form.applyError(failure)) return;
          // The saved draft is no longer the one on screen: read it again (new revision, parameters or problems).
          if (failure instanceof ApiError && DRAFT_CHANGED_CODES.has(failure.code)) void draftQuery.refetch();
        },
      },
    );
  }

  let body;
  if (draftQuery.isPending) {
    body = (
      <Loading label="Carregando o rascunho salvo">
        <div className="fc-reference-simulate-skeleton">
          <Skeleton width="80%" />
          <Skeleton width="40%" />
          <Skeleton width="100%" />
        </div>
      </Loading>
    );
  } else if (!draft) {
    body = (
      <Notice
        type="error"
        title="Não foi possível ler o rascunho salvo"
        actions={
          <Button size="small" loading={draftQuery.isFetching} onClick={() => void draftQuery.refetch()}>
            Tentar de novo
          </Button>
        }
      >
        {draftErrorMessage(draftQuery.error)}
      </Notice>
    );
  } else {
    body = (
      <form id={formId} className="fc-reference-simulate-form" onSubmit={submit} noValidate>
        <Text as="p" variant="label-14" className="fc-reference-simulate-file">
          <span className="fc-reference-simulate-name">{file.name}</span>
          <span className="fc-reference-simulate-records">{` · ${recordCount(file.records)}`}</span>
        </Text>
        {problems > 0 ? (
          <Notice type="warning" title={`O rascunho salvo tem ${problemCount(problems)}`}>
            Corrija-os no editor e salve antes de simular.
          </Notice>
        ) : null}
        <ParameterForm {...form.formProps} disabled={sending} />
        {/* The problems read again are already in the note above. */}
        {error && !(simulate.error instanceof ApiError && simulate.error.code === 'draft_has_problems' && problems > 0) ? (
          <Notice type="error" title={error.title}>
            {error.message}
          </Notice>
        ) : null}
      </form>
    );
  }

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        // Locked while the simulation is sent: closing now would lose it and invite a second one (ADR 0064).
        if (!open && !sending) onClose();
      }}
      title="Simular"
      description={draft ? revisionNote(draft.revision) : undefined}
      actions={
        <>
          <DialogClose>
            <Button disabledReason={sending ? SENDING_REASON : undefined}>Cancelar</Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={sending}
            disabledReason={
              draftQuery.isPending
                ? 'Aguarde a leitura do rascunho salvo'
                : !draft
                  ? 'Não foi possível ler o rascunho salvo'
                  : problems > 0
                    ? problemsReason(problems)
                    : undefined
            }
            showReason="beside"
          >
            Simular
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
