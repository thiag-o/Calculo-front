/** How many steps "desfazer" keeps (plan, F50). */
export const HISTORY_LIMIT = 50;

/** Changes with the same `mergeKey` closer than this (ms) become a single step (one word typed is one step, not five). */
export const MERGE_WINDOW_MS = 1000;

/**
 * Undo history of a value: the steps before (`past`, oldest first), the current value and the undone steps (`future`,
 * the next one to redo last). Pure: each function returns a new history.
 */
export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
  /** The `mergeKey` and the moment of the last change, to merge the next one. */
  lastKey: string | null;
  lastAt: number;
}

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

/**
 * A new value. With the same `mergeKey` as the previous change, less than `MERGE_WINDOW_MS` later, it replaces the current
 * step instead of adding one. The redo steps are dropped. The past keeps at most `HISTORY_LIMIT` steps.
 */
export function pushHistory<T>(history: History<T>, next: T, now: number, mergeKey: string | null = null): History<T> {
  if (Object.is(next, history.present)) return history;
  const merge = mergeKey !== null && mergeKey === history.lastKey && now - history.lastAt < MERGE_WINDOW_MS && history.future.length === 0;
  const past = merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: mergeKey, lastAt: now };
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous as T,
    future: [...history.future, history.present],
    lastKey: null,
    lastAt: 0,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const next = history.future[history.future.length - 1] as T;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(0, -1),
    lastKey: null,
    lastAt: 0,
  };
}
