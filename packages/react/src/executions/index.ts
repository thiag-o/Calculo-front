// Vertical "executions" (ADR 0003).
// Executions: list, panel, tree of composite executions and debug with trace.
// This file is the vertical's public interface; the rest of the folder is private.

// The form of the parameters of a run (E6-16): the editor's preview and "Calcular" use it too. With the search over the
// values of a query (E7-23) and the schedule mode, Fixo | Relativo (E7-24).
export {
  ParameterForm,
  RELATIVE_LABELS,
  initialFieldState,
  parameterErrorsFrom,
  readParameters,
  readScheduleParameters,
  relativesFor,
  scheduleFormValues,
  useParameterForm,
  useScheduleParameterForm,
} from './parameter-form';
export type {
  ParameterErrors,
  ParameterFieldState,
  ParameterFormController,
  ParameterFormMode,
  ParameterFormOptions,
  ParameterFormProps,
  ParameterFormStateProps,
  ParameterFormValues,
  ParameterValue,
  ParametersReading,
  ScheduleParameter,
  ScheduleParameterFormController,
  ScheduleParametersReading,
  WorkflowParameter,
} from './parameter-form';

// The execution list (E6-20): the tenant one (`/executions`) and the one of a workflow (`workflowId`), the same component.
export { ExecutionList, NO_EXECUTION_LIST_CHOICES } from './list';
export type { ExecutionListChoices, ExecutionListProps } from './list';

// "Executar lote" and its dialog (E6-19), for the editor header and the workflow Overview (F104).
export { TriggerExecution, TriggerExecutionDialog, TRIGGER_PERMISSION as EXECUTIONS_TRIGGER_PERMISSION } from './trigger';
export type { TriggerExecutionProps, TriggerExecutionDialogProps } from './trigger';

// The panel of one execution (E6-21), for `/executions/:id` (F104). The trace of a record comes by `renderRecordTrace`: the
// module passes the trace component of the editor, because executions never imports the editor (ADR 0062).
export { ExecutionPanel, TRACES_PERMISSION as EXECUTIONS_TRACES_PERMISSION } from './detail';
export type { ExecutionPanelProps } from './detail';
export type { RecordTraceRenderProps, RenderRecordTrace } from './records';

// The schedules (E7-24), for the Agendamentos tab of the two Execuções screens and the workflow Overview (F131): the list
// (the workflow one with "Novo agendamento"), the dialog, the recurrence in words and the next run of a workflow
// ("Próxima execução: 01/12 às 02:00 · Fechamento mensal").
export {
  NextScheduledRun,
  ScheduleDialog,
  ScheduleList,
  SCHEDULE_PERMISSION as EXECUTIONS_SCHEDULE_PERMISSION,
  SCHEDULES_KEY,
  recurrenceText,
  scheduleListKey,
} from './schedules';
export type { NextScheduledRunProps, Recurrence, Schedule, ScheduleDialogProps, ScheduleListProps } from './schedules';

// The execution routes and their cache keys (`['executions', 'list', filter]`, `['executions', id]` and, under it, the
// records and the trace of each one).
export {
  EXECUTIONS_KEY,
  EXECUTION_LISTS_KEY,
  executionKey,
  executionListKey,
  executionRecordKey,
  executionRecordListsKey,
  executionRecordsKey,
  useExecution,
  useExecutionList,
  statusPresentation,
  useTriggerExecution,
} from './api';
export type {
  Execution,
  ExecutionListFilter,
  ExecutionRecord,
  ExecutionRecordTrace,
  ExecutionStatus,
  NewExecution,
} from './api';
