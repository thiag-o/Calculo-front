import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Menu, Notice, Status, Table, Text, textClasses, type TableColumn } from '../../design-system';
import { isSameSessionData, useSession } from '../../session';
import { useNarrowModule } from '../list/useNarrowModule';
import { DeleteScheduleDialog } from './DeleteScheduleDialog';
import { OUTCOME_PRESENTATION, revisionLine, scheduleDateTime, scheduleParametersSummary } from './format';
import { CalendarClockIcon, MoreActionsIcon } from './icons';
import { changeErrorMessage, listErrorMessage, listSummary } from './messages';
import { SCHEDULE_PERMISSION, scheduleBody, scheduleListKey, useScheduleList, useUpdateSchedule, type Schedule } from './queries';
import { recurrenceText } from './recurrence';
import { ScheduleDialog } from './ScheduleDialog';
import { Switch } from './Switch';
import './schedules.css';

export interface ScheduleListProps {
  /**
   * The schedules of one workflow (`/workflows/:id/executions/schedules`): the workflow filter is fixed and the workflow
   * column goes away; **Novo agendamento** (with `executions.schedule`) creates one. Without it, the schedules of the
   * tenant (`/executions/schedules`), with the workflow of each one.
   */
  workflowId?: string;
  /** Opens the panel of an execution (`/executions/:id` in the module): the last trigger links the execution it created. */
  onOpenExecution?: (id: string) => void;
}

type OpenDialog = { kind: 'new' } | { kind: 'edit'; schedule: Schedule } | { kind: 'delete'; schedule: Schedule };

/**
 * Agendamentos (E7-24): the schedules in name order, in a table (name and frozen revision, workflow in the tenant list,
 * recurrence in words, parameters, next run, last trigger as dot + word with a link to the execution, and "Ativo"), with
 * "Carregar mais agendamentos" by cursor. With `executions.schedule`: the "Ativo" switch, **Novo agendamento** (only in the
 * list of a workflow) and the "…" menu with "Editar agendamento" and "Remover agendamento"; without it, all of them are
 * hidden and "Ativo" is a word. Below 1180px of module width, the parameters column goes away (estilos.md §15). Needs
 * `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ScheduleList({ workflowId, onOpenExecution }: ScheduleListProps = {}) {
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const session = useSession();
  const narrow = useNarrowModule(section);
  const scoped = workflowId !== undefined;
  const canSchedule = session.hasPermission(SCHEDULE_PERMISSION);
  const list = useScheduleList(workflowId);
  const schedules = list.data;
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [changeError, setChangeError] = useState<{ name: string; message: string } | null>(null);
  const noDataError = list.isError && schedules === undefined ? list.error : null;
  const noPermission = noDataError instanceof ApiError && noDataError.code === 'no_permission';
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';
  // Every schedule has the time zone of the system: the first one tells it to the dialog of a new one.
  const timeZone = schedules?.[0]?.timezone;

  // Focus goes back to the "…" of the row; when the row went away (removed), to "Novo agendamento", when there is one.
  const menuButtonOf = (id: string) => () =>
    section.current?.querySelector<HTMLElement>(`[data-schedule-menu="${id}"]`) ?? newButton.current;

  const allColumns: readonly TableColumn<Schedule>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 160,
      cell: (schedule) => (
        <span className="fc-schedules-stack">
          <Text variant="label-14" className="fc-schedules-wrap">
            {schedule.name}
          </Text>
          <Text variant="label-13" emphasis="secondary">
            {revisionLine(schedule)}
          </Text>
        </span>
      ),
    },
    ...(scoped
      ? []
      : [
          {
            key: 'workflow',
            title: 'Workflow',
            skeletonWidth: 140,
            cell: (schedule: Schedule) => (
              <Text variant="label-14" className="fc-schedules-wrap">
                {schedule.workflow_name}
              </Text>
            ),
          },
        ]),
    {
      key: 'recurrence',
      title: 'Recorrência',
      skeletonWidth: 160,
      cell: (schedule) => (
        <Text variant="label-14" className="fc-schedules-wrap">
          {recurrenceText(schedule.recurrence)}
        </Text>
      ),
    },
    {
      key: 'parameters',
      title: 'Parâmetros',
      skeletonWidth: 140,
      cell: (schedule) => {
        const summary = scheduleParametersSummary(schedule.parameters);
        return summary ? (
          <Text variant="label-13" emphasis="secondary" className="fc-schedules-wrap">
            {summary}
          </Text>
        ) : null;
      },
    },
    {
      key: 'next',
      title: 'Próxima execução',
      skeletonWidth: 96,
      cell: (schedule) => {
        const when = scheduleDateTime(schedule.next_run_at, schedule.timezone);
        return when ? (
          <Text variant="label-14" className="fc-schedules-number">
            {when}
          </Text>
        ) : null;
      },
    },
    {
      key: 'last',
      title: 'Último disparo',
      skeletonWidth: 120,
      cell: (schedule) => (schedule.last_run ? <LastRun schedule={schedule} onOpenExecution={onOpenExecution} /> : null),
    },
    {
      key: 'enabled',
      title: 'Ativo',
      skeletonWidth: 32,
      cell: (schedule) =>
        canSchedule ? (
          <ActiveSwitch
            schedule={schedule}
            onError={(error) => setChangeError({ name: schedule.name, message: changeErrorMessage(error) })}
            onChanged={() => setChangeError(null)}
          />
        ) : (
          <Text variant="label-14">{schedule.enabled ? 'Ativo' : 'Desativado'}</Text>
        ),
    },
    ...(canSchedule
      ? [
          {
            key: 'actions',
            title: 'Ações',
            hiddenTitle: true,
            align: 'end' as const,
            skeletonWidth: 24,
            cell: (schedule: Schedule) => (
              <Menu
                trigger={
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    label={`Mais ações para ${schedule.name}`}
                    icon={<MoreActionsIcon />}
                    data-schedule-menu={schedule.id}
                  />
                }
                items={[
                  { label: 'Editar agendamento', onSelect: () => setDialog({ kind: 'edit', schedule }) },
                  { label: 'Remover agendamento', danger: true, onSelect: () => setDialog({ kind: 'delete', schedule }) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];
  // The parameters go away below 1180px (estilos.md §15).
  const columns = narrow ? allColumns.filter((column) => column.key !== 'parameters') : allColumns;

  const canCreate = scoped && canSchedule;

  return (
    <section ref={section} className="fc-schedules" aria-labelledby={titleId}>
      <header className="fc-schedules-top">
        <div className="fc-schedules-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Agendamentos
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {schedules && schedules.length > 0
              ? listSummary(schedules.length, list.hasNextPage)
              : scoped
                ? 'Os agendamentos deste workflow, em ordem de nome'
                : 'Os agendamentos dos workflows do tenant, em ordem de nome'}
          </Text>
        </div>
        {canCreate ? (
          <Button ref={newButton} variant="primary" onClick={() => setDialog({ kind: 'new' })}>
            Novo agendamento
          </Button>
        ) : null}
      </header>

      {changeError ? (
        <Notice type="error" title={`Não foi possível mudar o agendamento ${changeError.name}`}>
          {changeError.message}
        </Notice>
      ) : null}

      <Table
        caption={scoped ? 'Agendamentos do workflow' : 'Agendamentos do tenant'}
        className="fc-schedules-table"
        columns={columns}
        rows={schedules}
        rowKey={(schedule) => schedule.id}
        loading={list.isPending}
        loadingRows={3}
        error={
          noDataError ? (
            <Notice
              type="error"
              title="Não foi possível carregar os agendamentos"
              actions={
                noPermission ? undefined : (
                  <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {listErrorMessage(noDataError)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<CalendarClockIcon />}
            title="Nenhum agendamento"
            description={
              scoped
                ? canSchedule
                  ? 'Crie um agendamento para o lote deste workflow rodar sozinho, no horário marcado.'
                  : 'Quem agenda lotes no tenant ainda não agendou este workflow.'
                : 'Os agendamentos dos workflows do tenant aparecem aqui. Eles são criados na aba Agendamentos de cada workflow.'
            }
            action={
              canCreate ? (
                <Button size="small" onClick={() => setDialog({ kind: 'new' })}>
                  Novo agendamento
                </Button>
              ) : undefined
            }
          />
        }
      />

      {list.isError && schedules !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais agendamentos' : 'Não foi possível atualizar a lista'}
          actions={
            invalidCursor ? (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: scheduleListKey(workflowId), exact: true })}
              >
                Recarregar lista
              </Button>
            ) : (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}
              >
                Tentar de novo
              </Button>
            )
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-schedules-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais agendamentos
          </Button>
        </div>
      ) : null}

      {dialog?.kind === 'new' && workflowId ? (
        <ScheduleDialog
          workflowId={workflowId}
          timeZone={timeZone}
          focusOnClose={() => newButton.current ?? section.current?.querySelector<HTMLElement>('.fc-empty-state button')}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'edit' ? (
        <ScheduleDialog
          workflowId={dialog.schedule.workflow_id}
          schedule={dialog.schedule}
          timeZone={dialog.schedule.timezone}
          focusOnClose={menuButtonOf(dialog.schedule.id)}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <DeleteScheduleDialog
          schedule={dialog.schedule}
          focusOnClose={menuButtonOf(dialog.schedule.id)}
          onClose={() => setDialog(null)}
          onDeleted={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

interface LastRunProps {
  schedule: Schedule;
  onOpenExecution?: (id: string) => void;
}

/** The last trigger: dot + word, when it was marked for and, below, the execution it created or why nothing ran. */
function LastRun({ schedule, onOpenExecution }: LastRunProps) {
  const run = schedule.last_run;
  if (!run) return null;
  const presentation = OUTCOME_PRESENTATION[run.outcome];
  const when = scheduleDateTime(run.scheduled_for, schedule.timezone);
  return (
    <span className="fc-schedules-stack">
      <span className="fc-schedules-line">
        <Status tone={presentation.tone} className="fc-schedules-nowrap">
          {presentation.label}
        </Status>
        <Text variant="label-13" emphasis="secondary" className="fc-schedules-number">
          {when}
        </Text>
      </span>
      {run.execution_id && onOpenExecution ? (
        <button
          type="button"
          className={`fc-schedules-link ${textClasses({ variant: 'label-13' })}`}
          aria-label={`Abrir a execução de ${when}, do agendamento ${schedule.name}`}
          onClick={() => onOpenExecution(run.execution_id!)}
        >
          Abrir execução
        </button>
      ) : run.message ? (
        <Text variant="label-13" emphasis="secondary" className="fc-schedules-wrap">
          {run.message}
        </Text>
      ) : null}
    </span>
  );
}

interface ActiveSwitchProps {
  schedule: Schedule;
  onError: (error: unknown) => void;
  onChanged: () => void;
}

/** "Ativo" of one row: turns the schedule on or off, keeping the rest (the frozen revision included). */
function ActiveSwitch({ schedule, onError, onChanged }: ActiveSwitchProps) {
  const queryClient = useQueryClient();
  const update = useUpdateSchedule();
  return (
    <Switch
      label={`${schedule.name} ativo`}
      checked={schedule.enabled}
      busy={update.isPending}
      onCheckedChange={(enabled) =>
        update.mutate(
          { id: schedule.id, body: scheduleBody(schedule, { enabled }) },
          {
            onSuccess: (_saved, _variables, mark) => {
              if (isSameSessionData(queryClient, mark)) onChanged();
            },
            onError: (error, _variables, mark) => {
              if (isSameSessionData(queryClient, mark)) onError(error);
            },
          },
        )
      }
    />
  );
}
