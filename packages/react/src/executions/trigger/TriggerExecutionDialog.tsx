import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Button, Dialog, DialogClose, Loading, Notice, Skeleton, type DialogProps } from '../../design-system';
import { ApiError } from '../../api';
import { isSameSessionData } from '../../session';
import { useTriggerExecution, type Execution } from '../api';
import { ParameterForm, parameterErrorsFrom, useParameterForm, type WorkflowParameter } from '../parameter-form';
import {
  draftErrorMessage,
  overlappingFrom,
  problemCount,
  problemsReason,
  revisionNote,
  triggerErrorMessage,
  type OverlappingExecution,
} from './messages';
import { OverlapNote } from './OverlapNote';
import { useSavedDraft } from './queries';
import './trigger.css';

const NO_PARAMETERS: readonly WorkflowParameter[] = [];

/** The `409` that say the saved draft is no longer the one on screen (new revision or problems): it is read again. */
const DRAFT_CHANGED_CODES: ReadonlySet<string> = new Set(['draft_conflict', 'draft_has_problems']);

/** The reason beside the disabled "Cancelar" while the trigger is in flight (estilos.md §14). */
export const SENDING_REASON = 'Aguarde o envio do lote';

export interface TriggerExecutionDialogProps {
  workflowId: string;
  /** Called on close without triggering (Cancelar, Esc or "Fechar"). Never while the trigger is in flight. */
  onClose: () => void;
  /** Called with the new execution (`pending`). The caller closes the dialog and opens the execution panel (E6-19). */
  onTriggered: (execution: Execution) => void;
  /**
   * Opens the Problemas tab of the editor. With it, the dialog offers "Ver problemas" when the saved draft has problems;
   * the dialog closes before calling it.
   */
  onOpenProblems?: () => void;
  /**
   * Opens the panel of an execution. With it, the note of a scope already delivered (E7-22) links each execution of that
   * scope; the dialog closes before calling it. Without it, the note lists them as text.
   */
  onOpenExecution?: (id: string) => void;
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Executar lote" (E6-19): runs the **saved** draft in batch, with the parameters form. The `409` of the trigger are explained
 * in a note and the `422` of a parameter goes to its field; `scope_already_delivered` (E7-22) asks to confirm, until a
 * parameter changes. Locked while the trigger is in flight (ADR 0064). Mount it only while open.
 */
export function TriggerExecutionDialog({
  workflowId,
  onClose,
  onTriggered,
  onOpenProblems,
  onOpenExecution,
  focusOnClose,
}: TriggerExecutionDialogProps) {
  const formId = useId();
  const draftQuery = useSavedDraft(workflowId);
  const trigger = useTriggerExecution(workflowId);
  const queryClient = useQueryClient();
  const sending = trigger.isPending;
  const draft = draftQuery.data;
  const form = useParameterForm(draft?.definition.parameters ?? NO_PARAMETERS, { workflowId });

  const problems = draft?.problems.length ?? 0;
  // A parameter error is shown at its field; any other error, in the note.
  const triggerError =
    trigger.error && parameterErrorsFrom(trigger.error) === null && overlappingFrom(trigger.error) === null
      ? triggerErrorMessage(trigger.error)
      : null;
  // The scope already delivered, tied to the values it was asked with: any change to a parameter drops the note (E7-22).
  const [overlap, setOverlap] = useState<OverlappingExecution[] | null>(null);
  const overlapNote = overlap;
  // The form says explicitly that a parameter changed: that is what takes the note away, not the identity of its values.
  const formProps = {
    ...form.formProps,
    onChange: (values: Parameters<typeof form.formProps.onChange>[0]) => {
      setOverlap(null);
      form.formProps.onChange(values);
    },
  };

  function openProblems() {
    onClose();
    onOpenProblems?.();
  }

  function openExecution(id: string) {
    onClose();
    onOpenExecution?.(id);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || problems > 0 || sending) return;
    trigger.reset();
    const reading = form.read();
    if (!reading.ok) return;
    trigger.mutate(
      { revision: draft.revision, parameters: reading.parameters, confirm_overlap: overlapNote !== null },
      {
        // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) opens nothing (ADR 0015).
        onSuccess: (execution, _body, mark) => {
          if (isSameSessionData(queryClient, mark)) onTriggered(execution);
        },
        onError: (error, _body, mark) => {
          if (!isSameSessionData(queryClient, mark) || form.applyError(error)) return;
          const overlapping = overlappingFrom(error);
          if (overlapping) {
            setOverlap(overlapping);
            return;
          }
          // The saved draft is no longer the one on screen: read it again (new revision, parameters or problems).
          if (error instanceof ApiError && DRAFT_CHANGED_CODES.has(error.code)) void draftQuery.refetch();
        },
      },
    );
  }

  const problemsButton = onOpenProblems ? (
    <Button size="small" onClick={openProblems}>
      Ver problemas
    </Button>
  ) : undefined;

  let body;
  if (draftQuery.isPending) {
    body = (
      <Loading label="Carregando o rascunho salvo">
        <div className="fc-trigger-skeleton">
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
      <form id={formId} className="fc-trigger-form" onSubmit={submit} noValidate>
        {problems > 0 ? (
          <Notice type="warning" title={`O rascunho salvo tem ${problemCount(problems)}`} actions={problemsButton}>
            Corrija-os no editor e salve antes de executar o lote.
          </Notice>
        ) : null}
        <ParameterForm {...formProps} disabled={sending} />
        {overlapNote ? <OverlapNote executions={overlapNote} onOpenExecution={onOpenExecution ? openExecution : undefined} /> : null}
        {/* The problems read again are already in the note above. */}
        {triggerError && !(triggerError.showProblems && problems > 0) ? (
          <Notice type="error" title={triggerError.title} actions={triggerError.showProblems ? problemsButton : undefined}>
            {triggerError.message}
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
        // Locked while the trigger is in flight: closing now would lose the new execution and invite a second trigger.
        if (!open && !sending) onClose();
      }}
      title="Executar lote"
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
            Executar lote
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
