import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { ApiError, type Schemas } from '../../api';
import { Button, Dialog, DialogClose, Loading, Notice, Skeleton, Text, TextField, type DialogProps } from '../../design-system';
import { isSameSessionData } from '../../session';
import { ParameterForm, scheduleFormValues, useScheduleParameterForm } from '../parameter-form';
import { draftMovedNote, runsRevisionNote, timeZoneNote } from './format';
import { NAME_TAKEN_MESSAGE, draftErrorMessage, problemCount, problemsReason, saveErrorMessage } from './messages';
import { useCreateSchedule, useScheduleDraft, useUpdateSchedule, type Schedule, type ScheduleData } from './queries';
import { NEW_RECURRENCE, readRecurrence, recurrenceFields, type RecurrenceErrors, type RecurrenceFields } from './recurrence';
import { RecurrenceFieldset } from './RecurrenceFieldset';
import { Switch } from './Switch';

/** The longest name the API takes. */
const NAME_LIMIT = 100;

/** The reason beside the disabled "Cancelar" while the schedule is on its way (ADR 0064). */
export const SENDING_REASON = 'Aguarde o envio do agendamento';

/** The `409` that say the saved draft is no longer the one on screen (new revision or problems): it is read again. */
const DRAFT_CHANGED_CODES: ReadonlySet<string> = new Set(['draft_conflict', 'draft_has_problems']);

type SavedDraft = Schemas['Draft'];

export interface ScheduleDialogProps {
  workflowId: string;
  /** The schedule to change. Without it, a new schedule of the workflow. */
  schedule?: Schedule;
  /** The time zone of the hours, when known (a schedule already loaded tells it): "Horário de America/Sao_Paulo". */
  timeZone?: string;
  /** Called on close without saving (Cancelar, Esc or "Fechar"). Never while the schedule is on its way. */
  onClose: () => void;
  /** Called with the schedule as the API saved it. The caller closes the dialog. */
  onSaved: (schedule: Schedule) => void;
  /** Who gets focus on close (the button or the "…" that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Novo agendamento" and the change of a schedule (E7-24), in a dialog: the name, the recurrence, the time zone as text,
 * the parameters form in the schedule mode (each parameter Fixo or Relativo) and "Ativo". The schedule freezes the **saved**
 * draft: the dialog reads it at every opening and says which revision runs ("Roda a revisão 42 do rascunho salvo."). When
 * the draft moved after the schedule froze it, "O rascunho está na revisão 57." and **Usar a revisão atual**, which makes
 * "Salvar" freeze the current revision. Errors go where they belong: the name taken to the name, a parameter to its field,
 * the rest in a note. While the schedule is on its way the dialog is locked (ADR 0064). Mount it only while open; needs
 * `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (dialog portal).
 */
export function ScheduleDialog({ workflowId, schedule, timeZone, onClose, onSaved, focusOnClose }: ScheduleDialogProps) {
  const formId = useId();
  const draftQuery = useScheduleDraft(workflowId);
  const create = useCreateSchedule(workflowId);
  const update = useUpdateSchedule();
  const sending = create.isPending || update.isPending;
  const draft = draftQuery.data;
  // "Usar a revisão atual": the change freezes the current revision of the saved draft, not the one the schedule had.
  const [useCurrent, setUseCurrent] = useState(false);

  const problems = draft?.problems.length ?? 0;
  const freezesCurrent = !schedule || useCurrent;
  const blockedByProblems = freezesCurrent && problems > 0;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        // Locked while the schedule is on its way: closing now would lose the answer and invite a second schedule.
        if (!open && !sending) onClose();
      }}
      title={schedule ? 'Editar agendamento' : 'Novo agendamento'}
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
                  : blockedByProblems
                    ? problemsReason(problems)
                    : undefined
            }
            showReason="beside"
          >
            Salvar
          </Button>
        </>
      }
    >
      {draftQuery.isPending ? (
        <Loading label="Carregando o rascunho salvo">
          <div className="fc-schedules-skeleton">
            <Skeleton width="60%" />
            <Skeleton width="100%" />
            <Skeleton width="40%" />
          </div>
        </Loading>
      ) : !draft ? (
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
      ) : (
        <ScheduleForm
          formId={formId}
          workflowId={workflowId}
          schedule={schedule}
          timeZone={timeZone ?? schedule?.timezone}
          draft={draft}
          useCurrent={useCurrent}
          onUseCurrent={() => setUseCurrent(true)}
          blockedByProblems={blockedByProblems}
          sending={sending}
          error={schedule ? update.error : create.error}
          onSubmit={(body, handlers) => {
            create.reset();
            update.reset();
            if (schedule) update.mutate({ id: schedule.id, body }, handlers);
            else create.mutate(body, handlers);
          }}
          onDraftChanged={() => void draftQuery.refetch()}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

interface SubmitHandlers {
  onSuccess: (schedule: Schedule, variables: unknown, mark: number | undefined) => void;
  onError: (error: Error, variables: unknown, mark: number | undefined) => void;
}

interface ScheduleFormProps {
  formId: string;
  workflowId: string;
  schedule: Schedule | undefined;
  timeZone: string | undefined;
  draft: SavedDraft;
  useCurrent: boolean;
  onUseCurrent: () => void;
  blockedByProblems: boolean;
  sending: boolean;
  error: Error | null;
  onSubmit: (body: ScheduleData, handlers: SubmitHandlers) => void;
  onDraftChanged: () => void;
  onSaved: (schedule: Schedule) => void;
}

/** The errors the API gives by field (`invalid_data`) that have a field on screen. */
function fieldErrors(error: unknown): { name?: string; recurrence: RecurrenceErrors } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'schedule_name_taken') return { name: NAME_TAKEN_MESSAGE, recurrence: {} };
  if (error.code !== 'invalid_data') return null;
  const recurrence: RecurrenceErrors = {};
  let name: string | undefined;
  for (const [field, message] of Object.entries(error.fields)) {
    if (field === 'name') name = message;
    else if (field.startsWith('recurrence') && field.includes('weekdays')) recurrence.weekdays = message;
    else if (/^recurrence\.(?:\w+\.)?day$/.test(field)) recurrence.day = message;
    else if (field.startsWith('recurrence')) recurrence.time = message;
    else return null;
  }
  return name || recurrence.time || recurrence.weekdays || recurrence.day ? { name, recurrence } : null;
}

/** The body of the dialog once the saved draft is read: it owns what is typed (the parameters start from the declaration). */
function ScheduleForm({
  formId,
  workflowId,
  schedule,
  timeZone,
  draft,
  useCurrent,
  onUseCurrent,
  blockedByProblems,
  sending,
  error,
  onSubmit,
  onDraftChanged,
  onSaved,
}: ScheduleFormProps) {
  const queryClient = useQueryClient();
  const parameters = draft.definition.parameters;
  const form = useScheduleParameterForm(parameters, {
    workflowId,
    initial: schedule ? scheduleFormValues(parameters, schedule.parameters) : {},
  });
  const [name, setName] = useState(schedule?.name ?? '');
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [recurrence, setRecurrence] = useState<RecurrenceFields>(schedule ? recurrenceFields(schedule.recurrence) : NEW_RECURRENCE);
  const [nameError, setNameError] = useState<string | undefined>();
  const [recurrenceErrors, setRecurrenceErrors] = useState<RecurrenceErrors>({});
  // The errors the API gave by field stay until the field changes.
  const [apiFieldErrors, setApiFieldErrors] = useState<ReturnType<typeof fieldErrors>>(null);

  const frozen = schedule?.draft_revision;
  const moved = schedule !== undefined && draft.revision !== frozen;
  const revision = schedule && !useCurrent ? schedule.draft_revision : draft.revision;
  const problems = draft.problems.length;
  const noteError = error && fieldErrors(error) === null && !isParameterError(error) ? saveErrorMessage(error, schedule !== undefined) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || blockedByProblems) return;
    const trimmed = name.trim();
    const localNameError =
      trimmed === '' ? 'Dê um nome ao agendamento.' : trimmed.length > NAME_LIMIT ? `Use no máximo ${NAME_LIMIT} caracteres.` : undefined;
    const recurrenceReading = readRecurrence(recurrence);
    const parametersReading = form.read();
    setNameError(localNameError);
    setRecurrenceErrors(recurrenceReading.ok ? {} : recurrenceReading.errors);
    setApiFieldErrors(null);
    if (localNameError || !recurrenceReading.ok || !parametersReading.ok) return;
    onSubmit(
      { revision, name: trimmed, enabled, recurrence: recurrenceReading.recurrence, parameters: parametersReading.parameters },
      {
        onSuccess: (saved, _variables, mark) => {
          // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) opens nothing (ADR 0015).
          if (isSameSessionData(queryClient, mark)) onSaved(saved);
        },
        onError: (failure, _variables, mark) => {
          if (!isSameSessionData(queryClient, mark) || form.applyError(failure)) return;
          const byField = fieldErrors(failure);
          if (byField) {
            setApiFieldErrors(byField);
            return;
          }
          // The saved draft is no longer the one on screen: read it again (new revision, parameters or problems).
          if (failure instanceof ApiError && DRAFT_CHANGED_CODES.has(failure.code)) onDraftChanged();
        },
      },
    );
  }

  const shownNameError = nameError ?? apiFieldErrors?.name;
  const shownRecurrenceErrors: RecurrenceErrors = {
    time: recurrenceErrors.time ?? apiFieldErrors?.recurrence.time,
    weekdays: recurrenceErrors.weekdays ?? apiFieldErrors?.recurrence.weekdays,
    day: apiFieldErrors?.recurrence.day,
  };

  return (
    <form id={formId} className="fc-schedules-form" onSubmit={submit} noValidate>
      <div className="fc-schedules-revision" role="group" aria-label="Revisão do rascunho">
        <Text as="p" variant="label-14">
          {runsRevisionNote(revision)}
        </Text>
        {moved && !useCurrent ? (
          <div className="fc-schedules-revision-moved">
            <Text as="p" variant="label-14" emphasis="secondary">
              {draftMovedNote(draft.revision)}
            </Text>
            <Button
              size="small"
              disabledReason={
                problems > 0 ? `Resolva ${problemCount(problems)} do rascunho para usar a revisão atual` : sending ? SENDING_REASON : undefined
              }
              showReason="beside"
              onClick={onUseCurrent}
            >
              Usar a revisão atual
            </Button>
          </div>
        ) : null}
        {moved && useCurrent ? (
          <Text as="p" variant="label-13" emphasis="secondary">
            Ao salvar, o agendamento passa a rodar esta revisão.
          </Text>
        ) : null}
      </div>

      {blockedByProblems ? (
        <Notice type="warning" title={`O rascunho salvo tem ${problemCount(problems)}`}>
          Corrija-os no editor e salve antes de agendar.
        </Notice>
      ) : null}

      <TextField
        label="Nome"
        placeholder="Fechamento mensal"
        autoComplete="off"
        maxLength={NAME_LIMIT}
        value={name}
        error={shownNameError}
        disabled={sending}
        onChange={(event) => {
          setName(event.target.value);
          setNameError(undefined);
          setApiFieldErrors((current) => (current ? { ...current, name: undefined } : current));
        }}
      />

      <RecurrenceFieldset
        fields={recurrence}
        errors={shownRecurrenceErrors}
        timeZoneNote={timeZoneNote(timeZone)}
        disabled={sending}
        onChange={(next) => {
          setRecurrence(next);
          setRecurrenceErrors({});
          setApiFieldErrors((current) => (current ? { ...current, recurrence: {} } : current));
        }}
      />

      <ParameterForm {...form.formProps} disabled={sending} />

      <Switch label="Ativo" showLabel checked={enabled} disabled={sending} onCheckedChange={setEnabled} />

      {/* The problems read again are already in the note above. */}
      {noteError && !(blockedByProblems && error instanceof ApiError && error.code === 'draft_has_problems') ? (
        <Notice type="error" title={noteError.title}>
          {noteError.message}
        </Notice>
      ) : null}
    </form>
  );
}

function isParameterError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'missing_parameter' || error.code === 'invalid_parameter');
}
