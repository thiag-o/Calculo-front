import { Loading, Skeleton, Text } from '../../design-system';
import { useSession } from '../../session';
import { scheduleDateTime } from './format';
import { SCHEDULES_VIEW_PERMISSION, useScheduleList, type Schedule } from './queries';
import './schedules.css';

export interface NextScheduledRunProps {
  workflowId: string;
}

/** The active schedule that fires first; `null` without any active one. */
export function nextScheduled(schedules: readonly Schedule[]): Schedule | null {
  let next: Schedule | null = null;
  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.next_run_at === null) continue;
    if (next === null || Date.parse(schedule.next_run_at) < Date.parse(next.next_run_at!)) next = schedule;
  }
  return next;
}

/**
 * "Próxima execução: 01/12 às 02:00 · Fechamento mensal" (E7-24, estilos.md §16), for the Overview of a workflow: the
 * active schedule of the workflow that fires first, in the time zone of the schedules. Without active schedules, "Nenhuma
 * execução agendada". Without `executions.view`, nothing is shown. Needs `ApiProvider` and `QueryClientProvider`.
 */
export function NextScheduledRun({ workflowId }: NextScheduledRunProps) {
  const session = useSession();
  const allowed = session.hasPermission(SCHEDULES_VIEW_PERMISSION);
  // A workflow has at most 20 schedules: the first page has all of them.
  const list = useScheduleList(workflowId, { enabled: allowed });

  if (!allowed) return null;
  if (list.isPending) {
    return (
      <Loading label="Carregando a próxima execução" className="fc-schedules-next">
        <Skeleton width={180} />
      </Loading>
    );
  }
  if (list.isError && list.data === undefined) {
    return (
      <Text as="p" variant="label-14" emphasis="secondary" className="fc-schedules-next">
        Não foi possível ler os agendamentos deste workflow.
      </Text>
    );
  }
  const next = nextScheduled(list.data ?? []);
  if (!next) {
    return (
      <Text as="p" variant="label-14" emphasis="secondary" className="fc-schedules-next">
        Nenhuma execução agendada
      </Text>
    );
  }
  return (
    <Text as="p" variant="label-14" className="fc-schedules-next">
      Próxima execução: {scheduleDateTime(next.next_run_at, next.timezone)} · {next.name}
    </Text>
  );
}
