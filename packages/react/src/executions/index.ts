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
