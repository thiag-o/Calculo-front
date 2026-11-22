import { useCallback, useMemo, useRef, useState } from 'react';
import type { ParameterFormProps } from './ParameterForm';
import {
  parameterErrorsFrom,
  readParameters,
  type ParameterErrors,
  type ParameterFormValues,
  type ParametersReading,
  type WorkflowParameter,
} from './values';

export interface ParameterFormController {
  /** Spread into `<ParameterForm>`. */
  formProps: Pick<ParameterFormProps, 'parameters' | 'values' | 'onChange' | 'errors'>;
  /**
   * Reads the form for the `parameters` of a request. When something cannot go, the error is put at its field and nothing is
   * sent (`ok: false`).
   */
  read: () => ParametersReading;
  /**
   * Puts the back's `missing_parameter` and `invalid_parameter` at their fields. Returns `false` for any other error, which
   * the caller shows in its own way.
   */
  applyError: (error: unknown) => boolean;
}

/**
 * The state of the parameters form: what is typed, the errors by parameter, and the two moves of a screen that sends the
 * values (read them, put the back's error at the field). Editing a parameter clears its error. A caller that remembers the
 * last values (E6-22) passes them as `initial`.
 */
export function useParameterForm(parameters: readonly WorkflowParameter[], initial: ParameterFormValues = {}): ParameterFormController {
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

  const read = useCallback((): ParametersReading => {
    const reading = readParameters(parameters, values);
    setErrors(reading.ok ? {} : reading.errors);
    return reading;
  }, [parameters, values]);

  const applyError = useCallback((error: unknown): boolean => {
    const fields = parameterErrorsFrom(error);
    if (fields === null) return false;
    setErrors(fields);
    return true;
  }, []);

  return useMemo(
    () => ({ formProps: { parameters, values, onChange, errors }, read, applyError }),
    [parameters, values, onChange, errors, read, applyError],
  );
}
