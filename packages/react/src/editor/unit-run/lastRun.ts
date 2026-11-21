import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { currentSession, onSessionDataCleared, useSession, type Session } from '../../session';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import { memoryKey } from './memory';
import type { UnitRun } from './queries';

/** The last "Calcular" of a workflow, kept while the module is open (the canvas shows its values, E5-21). */
export interface LastUnitRun {
  revision: number;
  /** The definition that ran: the canvas shows the values only while the definition on screen is this one. */
  definition: WorkflowDefinition;
  /** The symbols of the analysis when it ran: the types of the variables, to show the values. */
  symbols: readonly DraftSymbol[];
  trace: UnitRun;
}

/**
 * The last trace of each workflow, only in memory (design §1, principle 3: nothing in `localStorage`), as the last preview
 * (ADR 0056) and the values typed (ADR 0045): it lives with the module's QueryClient, under the person and the tenant,
 * and is forgotten when the session data leaves the module (`onSessionDataCleared`). It survives the tab closing.
 */
interface Store {
  runs: Map<string, LastUnitRun>;
  listeners: Set<() => void>;
}

const stores = new WeakMap<QueryClient, Store>();

function storeOf(queryClient: QueryClient): Store {
  let store = stores.get(queryClient);
  if (!store) {
    const created: Store = { runs: new Map(), listeners: new Set() };
    stores.set(queryClient, created);
    onSessionDataCleared(queryClient, () => {
      created.runs.clear();
      notify(created);
    });
    store = created;
  }
  return store;
}

function notify(store: Store) {
  for (const listener of [...store.listeners]) listener();
}

/** The key of the last run: the person, the tenant and the workflow (ADR 0045); none without both. */
function runKey(session: Session | undefined, workflowId: string): string | null {
  const userId = session?.user.id;
  const tenantId = session?.current_tenant?.id;
  return userId && tenantId ? memoryKey(userId, tenantId, workflowId) : null;
}

/**
 * Keeps the answer of a run as the workflow's last one (`useUnitRun`, only for the same session data), under the session
 * in the cache when the answer arrives. Without a person and a tenant there, nothing is kept.
 */
export function keepLastUnitRun(queryClient: QueryClient, workflowId: string, run: LastUnitRun) {
  const key = runKey(currentSession(queryClient), workflowId);
  if (key === null) return;
  const store = storeOf(queryClient);
  store.runs.set(key, run);
  notify(store);
}

export interface LastUnitRunValue {
  /** The last run of the workflow in this module (by this person, in this tenant), or `null`. */
  lastRun: LastUnitRun | null;
  /** Forgets `run` ("Limpar", or an edit), unless a newer run took its place meanwhile. */
  clear: (run: LastUnitRun) => void;
}

/** The last "Calcular" of the workflow and how to forget it. */
export function useLastUnitRun(workflowId: string): LastUnitRunValue {
  const queryClient = useQueryClient();
  const session = useSession();
  const key = runKey(session.data, workflowId);
  const store = storeOf(queryClient);
  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );
  const lastRun = useSyncExternalStore(subscribe, () => (key === null ? null : (store.runs.get(key) ?? null)));
  const clear = useCallback(
    (run: LastUnitRun) => {
      if (key === null || store.runs.get(key) !== run) return;
      store.runs.delete(key);
      notify(store);
    },
    [store, key],
  );
  return { lastRun, clear };
}
