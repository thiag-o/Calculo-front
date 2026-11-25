import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { readParameters, useParameterForm, type ParameterFormController, type ParameterFormValues, type ParameterValue, type WorkflowParameter } from '../../executions';
import { onSessionDataCleared, useSession } from '../../session';

/**
 * The last values typed in the parameters form (E6-22), only in memory (design §1, principle 3: nothing in `localStorage`).
 * They live with the module's QueryClient, under the person, the tenant and the workflow, and are forgotten when the
 * session data leaves the module (`onSessionDataCleared`). The "Prévia" and "Calcular" tabs share them: they are the
 * parameters of the same workflow, so what was typed in one is there in the other and when a tab opens again.
 */
const remembered = new WeakMap<QueryClient, Map<string, ParameterFormValues>>();

function storeOf(queryClient: QueryClient): Map<string, ParameterFormValues> {
  let store = remembered.get(queryClient);
  if (!store) {
    const created = new Map<string, ParameterFormValues>();
    remembered.set(queryClient, created);
    onSessionDataCleared(queryClient, () => created.clear());
    store = created;
  }
  return store;
}

/**
 * The parameters form of a run (preview or "Calcular") with the last values of the workflow already in it, and kept again
 * on each edit. Spread `formProps` into `<ParameterForm>`; `read()` gives the `parameters` of the request and
 * `applyError(error)` puts the back's `422` at its field.
 */
export function useRunParameters(workflowId: string, parameters: readonly WorkflowParameter[]): ParameterFormController {
  const queryClient = useQueryClient();
  const session = useSession();
  const key = `${session.data?.user.id ?? ''}:${session.data?.current_tenant?.id ?? ''}:${workflowId}`;
  const store = storeOf(queryClient);
  // Read once, when the tab opens: from then on the form holds what is typed.
  const form = useParameterForm(parameters, { workflowId, initial: store.get(key) ?? {} });
  const { onChange } = form.formProps;
  const remember = useCallback(
    (next: ParameterFormValues) => {
      store.set(key, next);
      onChange(next);
    },
    [store, key, onChange],
  );
  return useMemo(() => ({ ...form, formProps: { ...form.formProps, onChange: remember } }), [form, remember]);
}

/**
 * D42: the result on screen is of the parameter values used to run it. `true` when the form now holds other values (or
 * values that cannot be read), so the result is of an earlier set.
 */
export function parametersChanged(
  parameters: readonly WorkflowParameter[],
  values: ParameterFormValues,
  used: Readonly<Record<string, ParameterValue>>,
): boolean {
  const reading = readParameters(parameters, values);
  return !reading.ok || JSON.stringify(reading.parameters) !== JSON.stringify(used);
}
