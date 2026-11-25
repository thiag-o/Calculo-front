import { useCallback, useMemo, useRef, useState } from 'react';
import type { ParameterFormMode, ParameterFormProps } from './ParameterForm';
import {
  parameterErrorsFrom,
  readParameters,
  readScheduleParameters,
  type ParameterErrors,
  type ParameterFormValues,
  type ParametersReading,
  type ScheduleParametersReading,
  type WorkflowParameter,
} from './values';

/** The props of `<ParameterForm>` the controller holds. */
export type ParameterFormStateProps = Pick<ParameterFormProps, 'workflowId' | 'parameters' | 'values' | 'onChange' | 'errors' | 'mode'>;

interface FormController<Reading> {
  /** Spread into `<ParameterForm>`. */
  formProps: ParameterFormStateProps;
  /**
   * Reads the form for the `parameters` of a request. When something cannot go, the error is put at its field and nothing is
   * sent (`ok: false`).
   */
  read: () => Reading;
  /**
   * Puts the back's `missing_parameter` and `invalid_parameter` at their fields (also "não está entre os valores
   * permitidos", of a query). Returns `false` for any other error, which the caller shows in its own way.
   */
  applyError: (error: unknown) => boolean;
}

/** The controller of the run mode: `read()` gives the `parameters` of a trigger, a preview, a "Calcular" or a simulation. */
export type ParameterFormController = FormController<ParametersReading>;

/** The controller of the schedule mode: `read()` gives the `parameters` of a schedule, each as `{kind, value}`. */
export type ScheduleParameterFormController = FormController<ScheduleParametersReading>;

export interface ParameterFormOptions {
  /** The workflow whose saved draft has the queries of `allowed_values`. */
  workflowId: string;
  /** The values to start with (the last ones typed, E6-22, or those of a saved schedule). Default: `{}`. */
  initial?: ParameterFormValues;
}

type Reading = { ok: true } | { ok: false; errors: ParameterErrors };

function useFormController<R extends Reading>(
  parameters: readonly WorkflowParameter[],
  { workflowId, initial = {} }: ParameterFormOptions,
  mode: ParameterFormMode,
  readAll: (parameters: readonly WorkflowParameter[], values: ParameterFormValues) => R,
): FormController<R> {
  const [values, setValues] = useState<ParameterFormValues>(initial);
  const [errors, setErrors] = useState<ParameterErrors>({});
  const latest = useRef(values);
  latest.current = values;

  const onChange = useCallback((next: ParameterFormValues) => {
    const previous = latest.current;
    // The error of a parameter that changed is no longer about what is typed.
    setErrors((current) => {
      const stale = Object.keys(current).filter((name) => previous[name] !== next[name]);
      return stale.length === 0 ? current : Object.fromEntries(Object.entries(current).filter(([name]) => !stale.includes(name)));
    });
    setValues(next);
  }, []);

  const read = useCallback((): R => {
    const reading = readAll(parameters, values);
    setErrors(reading.ok ? {} : reading.errors);
    return reading;
  }, [readAll, parameters, values]);

  const applyError = useCallback((error: unknown): boolean => {
    const fields = parameterErrorsFrom(error);
    if (fields === null) return false;
    setErrors(fields);
    return true;
  }, []);

  return useMemo(
    () => ({ formProps: { workflowId, parameters, values, onChange, errors, mode }, read, applyError }),
    [workflowId, parameters, values, onChange, errors, mode, read, applyError],
  );
}

/**
 * The state of the parameters form of a run: what is typed, the errors by parameter, and the two moves of a screen that
 * sends the values (read them, put the back's error at the field). Editing a parameter clears its error. A caller that
 * remembers the last values (E6-22) passes them as `initial`.
 */
export function useParameterForm(parameters: readonly WorkflowParameter[], options: ParameterFormOptions): ParameterFormController {
  return useFormController(parameters, options, 'run', readParameters);
}

/**
 * The state of the parameters form of a schedule (E7-24): as `useParameterForm`, in the schedule mode. To edit a saved
 * schedule, start it with `scheduleFormValues(parameters, schedule.parameters)` as `initial`.
 */
export function useScheduleParameterForm(parameters: readonly WorkflowParameter[], options: ParameterFormOptions): ScheduleParameterFormController {
  return useFormController(parameters, options, 'schedule', readScheduleParameters);
}
