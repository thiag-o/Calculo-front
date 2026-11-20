import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useSession } from '../../session';
import type { TypedValues } from './values';

/**
 * The last values typed in "Calcular", only in memory (design §1, principle 3: nothing in `localStorage` or
 * `sessionStorage`). They live with the module's QueryClient, so they last while the module is open and go away with it;
 * each workflow has its own, under the person and the tenant, so another sign-in in the same module never sees them.
 */
const remembered = new WeakMap<QueryClient, Map<string, TypedValues>>();

/** The values typed in the "Calcular" tab of a workflow, kept when the tab or the editor closes and opens again. */
export function useRememberedValues(workflowId: string): [TypedValues, (update: (current: TypedValues) => TypedValues) => void] {
  const queryClient = useQueryClient();
  const session = useSession();
  const key = `${session.data?.user.id ?? ''}:${session.data?.current_tenant?.id ?? ''}:${workflowId}`;
  const store = remembered.get(queryClient) ?? new Map<string, TypedValues>();
  remembered.set(queryClient, store);

  const [state, setState] = useState<{ key: string; values: TypedValues }>(() => ({ key, values: store.get(key) ?? {} }));
  // Another person, tenant or workflow: the values are theirs.
  const values = state.key === key ? state.values : (store.get(key) ?? {});

  const update = useCallback(
    (change: (current: TypedValues) => TypedValues) => {
      // The store always has the last values (it is written right here), so the change is computed and kept outside the
      // state updater, which React may call twice.
      const next = change(store.get(key) ?? {});
      store.set(key, next);
      setState({ key, values: next });
    },
    [key, store],
  );

  return [values, update];
}
