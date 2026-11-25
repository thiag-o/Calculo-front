// Sub-vertical "parameter-form" of "executions" (E6-16): the form of the parameters of a run, generated from the declaration.
// Used by the trigger dialog (F101), by the editor's preview and "Calcular" (F103), by the schedules (E7-24, schedule mode)
// and by the simulation of the reference file (E7-25). Exported by `executions/index.ts`.
export { ParameterForm } from './ParameterForm';
export type { ParameterFormMode, ParameterFormProps } from './ParameterForm';
export { useParameterForm, useScheduleParameterForm } from './useParameterForm';
export type { ParameterFormController, ParameterFormOptions, ParameterFormStateProps, ScheduleParameterFormController } from './useParameterForm';
export { initialFieldState, parameterErrorsFrom, readParameters, readScheduleParameters, scheduleFormValues } from './values';
export type {
  ParameterErrors,
  ParameterFieldState,
  ParameterFormValues,
  ParameterValue,
  ParametersReading,
  ScheduleParameter,
  ScheduleParametersReading,
  WorkflowParameter,
} from './values';
export { RELATIVE_LABELS, relativesFor } from './labels';
