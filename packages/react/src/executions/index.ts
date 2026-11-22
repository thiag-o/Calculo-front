// Vertical "executions" (ADR 0003).
// Executions: list, panel, tree of composite executions and debug with trace.
// This file is the vertical's public interface; the rest of the folder is private.

// The form of the parameters of a run (E6-16): the editor's preview and "Calcular" use it too.
export { ParameterForm, RELATIVE_LABELS, initialFieldState, parameterErrorsFrom, readParameters, useParameterForm } from './parameter-form';
export type {
  ParameterErrors,
  ParameterFieldState,
  ParameterFormController,
  ParameterFormProps,
  ParameterFormValues,
  ParameterValue,
  ParametersReading,
  WorkflowParameter,
} from './parameter-form';

// The execution list (E6-20): the tenant one (`/executions`) and the one of a workflow (`workflowId`), the same component.
export { ExecutionList } from './list';
export type { ExecutionListProps } from './list';

// "Executar lote" and its dialog (E6-19), for the editor header and the workflow Overview (F104).
export { TriggerExecution, TriggerExecutionDialog, TRIGGER_PERMISSION as EXECUTIONS_TRIGGER_PERMISSION } from './trigger';
export type { TriggerExecutionProps, TriggerExecutionDialogProps } from './trigger';

// The execution routes and their cache keys (`['executions', 'list', filter]` and `['executions', id]`).
export { EXECUTIONS_KEY, EXECUTION_LISTS_KEY, executionKey, executionListKey, useExecutionList, useTriggerExecution } from './api';
export type { Execution, ExecutionListFilter, ExecutionStatus, NewExecution } from './api';
