import { useCallback, useEffect, useMemo } from 'react';
import { useDraftEditor } from '../../draft';
import { useLastUnitRun } from '../../unit-run';
import { runViews, type RunViews } from './views';

export interface RunValuesState {
  /** The values of the last run, while the definition on screen is the one that ran; otherwise `null`. */
  views: RunViews | null;
  /** "Limpar": the values leave the canvas. */
  clear: () => void;
}

/**
 * The values of the last "Calcular" of the workflow on the canvas (E5-21). They show only while the definition on screen
 * is the one that ran AND it is the one saved at the revision that ran: an edit made while "Calcular" was saving goes into
 * the definition the tab keeps with the run, but not into the saved revision the trace is of, so those values never show.
 * Any edit clears them: the definition on screen stops being the one that ran (every change, undo and reload makes a new
 * definition, ADR 0044), and the run is forgotten, so undoing the edit does not bring old values back.
 */
export function useRunValues(): RunValuesState {
  const { workflowId, definition, revision, save } = useDraftEditor();
  const { lastRun, clear: forget } = useLastUnitRun(workflowId);
  const saved = save.status === 'saved';
  // Forgotten only when the definition or the revision diverge; `saved` only decides whether the values show.
  const stale = lastRun !== null && (lastRun.definition !== definition || lastRun.revision !== revision);
  const current = lastRun !== null && !stale ? lastRun : null;
  const shown = current !== null && saved ? current : null;

  useEffect(() => {
    if (stale && lastRun) forget(lastRun);
  }, [stale, lastRun, forget]);

  const views = useMemo(() => (shown ? runViews(shown) : null), [shown]);
  const clear = useCallback(() => {
    if (current) forget(current);
  }, [current, forget]);
  return { views, clear };
}
