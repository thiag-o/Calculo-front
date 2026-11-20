import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../api';
import { pushHistory, redoHistory, startHistory, undoHistory, type History } from './history';
import {
  fetchDraftAgain,
  saveDraft,
  trackDraftSave,
  useDraftAnalysis,
  useDraftClients,
  type AnalysisTarget,
  type Draft,
  type DraftSymbol,
  type WorkflowDefinition,
  type WorkflowProblem,
} from './queries';
import { WORKFLOW_ITEM, type EditorItem, type EditorSelection } from './selection';

/** The draft is saved by itself this long after the last change (E4-23). */
export const SAVE_DELAY_MS = 2000;
/** The analysis runs this long after the last change (E4-23). */
export const ANALYSIS_DELAY_MS = 400;

/**
 * Where the saving stands:
 * - `saved`: nothing to save; `savedAt` is the moment of the last save;
 * - `pending`: changes waiting for the 2 s pause;
 * - `saving`: a `PUT` in progress;
 * - `error`: the last save failed (`error`); the next change, or "Tentar de novo", tries again;
 * - `conflict`: `409 draft_conflict`; nothing is saved until "Recarregar rascunho".
 */
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export interface SaveState {
  status: SaveStatus;
  /** When the draft was last saved (ISO), by anyone. */
  savedAt: string;
  error: unknown;
}

/** The reload after a conflict ("Recarregar rascunho"). */
export interface ReloadState {
  reloading: boolean;
  error: unknown;
}

export interface ChangeOptions {
  /**
   * Changes with the same key, less than 1 s apart, become one undo step (the same field being typed, e.g.
   * `root.nodes[2].expression`). Without it, each change is a step.
   */
  mergeKey?: string;
}

/** A new definition, or a function that makes it from the current one. */
export type DefinitionUpdate = WorkflowDefinition | ((current: WorkflowDefinition) => WorkflowDefinition);

/** The local editing state of the draft, shared by the editor's panels (`useDraftEditor`). */
export interface DraftEditorValue {
  workflowId: string;
  /** The definition being edited (the local copy, ahead of the server while not saved). */
  definition: WorkflowDefinition;
  /** The draft revision the next save goes over. */
  revision: number;
  /** The problems and the symbols of the latest analysis or save. */
  problems: readonly WorkflowProblem[];
  symbols: readonly DraftSymbol[];
  /**
   * The definition those problems were found in. Their `path` (`root.nodes[1]…`) and positions refer to it, not to
   * `definition`, while the analysis of the latest change has not come back.
   */
  analyzedDefinition: WorkflowDefinition;
  /** The definition changed after the problems were found (the analysis of the latest change is on the way). */
  problemsOutdated: boolean;
  /** The analysis of the latest change failed: the problems shown are older. The next change tries again. */
  analysisFailed: boolean;
  /** Without `workflows.edit` (E4-20): `change`, `undo` and `redo` do nothing and nothing is saved. */
  readOnly: boolean;
  selection: EditorSelection;
  /** Selects an item and, optionally, the field to bring into view (the `path` of a problem). */
  select: (item: EditorItem, field?: string | null) => void;
  /** Changes the definition: one undo step, the analysis after 400 ms and the save after 2 s. */
  change: (update: DefinitionUpdate, options?: ChangeOptions) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  save: SaveState;
  /** Tries the failed save again, right away. */
  retrySave: () => void;
  /**
   * Saves what is pending right away (before "Calcular", E4-23) and resolves with the saved revision, or `null` when it
   * could not save (read-only, conflict or error, shown in `save`).
   */
  flush: () => Promise<number | null>;
  /** "Recarregar rascunho": takes the server's draft and drops the local changes (nothing is merged, E4-23). */
  reload: () => Promise<void>;
  reloadState: ReloadState;
}

const DraftEditorContext = createContext<DraftEditorValue | null>(null);

/** The draft being edited. Only inside `DraftEditorProvider` (the editor screen mounts it). */
export function useDraftEditor(): DraftEditorValue {
  const value = useContext(DraftEditorContext);
  if (!value) throw new Error('useDraftEditor precisa do DraftEditorProvider (a tela do editor o monta).');
  return value;
}

/** The mutable state of the saving, read by the timers and by the save on close (outside the render). */
interface Live {
  /** Local version: grows on each change, undo, redo and reload. */
  version: number;
  /** The local version the server has. */
  savedVersion: number;
  revision: number;
  saving: Promise<void> | null;
  /** A save was asked while another was running. */
  again: boolean;
  failed: boolean;
  conflict: boolean;
  readOnly: boolean;
}

interface AnalysisResult {
  version: number;
  definition: WorkflowDefinition;
  problems: readonly WorkflowProblem[];
  symbols: readonly DraftSymbol[];
}

function itemExists(definition: WorkflowDefinition, item: EditorItem): boolean {
  return item.type !== 'node' || definition.root.nodes.some((node) => node.id === item.id);
}

export interface DraftEditorProviderProps {
  /** The draft as the server sent it (`GET …/draft`). Read once: later changes come from the editor itself. */
  draft: Draft;
  readOnly: boolean;
  children?: ReactNode;
}

/**
 * Keeps the local edit of a draft (E4-20, E4-23): the definition with "desfazer" of up to 50 steps, the selected item,
 * the analysis 400 ms after the last change (problems and symbols, nothing saved), the save 2 s after the last change and
 * when the editor closes, and the `409 draft_conflict`, which stops the saving until "Recarregar rascunho".
 */
export function DraftEditorProvider({ draft, readOnly, children }: DraftEditorProviderProps) {
  const { client, queryClient } = useDraftClients();
  const workflowId = draft.workflow_id;

  const [history, setHistoryState] = useState<History<WorkflowDefinition>>(() => startHistory(draft.definition));
  const historyRef = useRef(history);
  const [selection, setSelection] = useState<EditorSelection>({ item: WORKFLOW_ITEM, field: null });
  const [result, setResult] = useState<AnalysisResult>(() => ({
    version: 0,
    definition: draft.definition,
    problems: draft.problems,
    symbols: draft.symbols,
  }));
  /** The local version on screen (the `live.version` of the last render). */
  const [version, setVersion] = useState(0);
  const [save, setSave] = useState<SaveState>({ status: 'saved', savedAt: draft.updated_at, error: null });
  const [reloadState, setReloadState] = useState<ReloadState>({ reloading: false, error: null });
  const [analysisTarget, setAnalysisTarget] = useState<AnalysisTarget | null>(null);
  const [revision, setRevision] = useState(draft.revision);

  const live = useRef<Live>({
    version: 0,
    savedVersion: 0,
    revision: draft.revision,
    saving: null,
    again: false,
    failed: false,
    conflict: false,
    readOnly,
  });
  live.current.readOnly = readOnly;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyResult = useCallback((next: AnalysisResult) => {
    setResult((current) => (next.version >= current.version ? next : current));
  }, []);

  const clearTimers = useCallback(() => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    if (analysisTimer.current !== null) clearTimeout(analysisTimer.current);
    saveTimer.current = null;
    analysisTimer.current = null;
  }, []);

  // One save at a time, always over the latest revision. A save asked during another runs right after it.
  const runSave = useCallback((): Promise<void> => {
    const state = live.current;
    if (state.readOnly || state.conflict) return Promise.resolve();
    if (state.saving) {
      state.again = true;
      return state.saving;
    }
    if (state.version === state.savedVersion) return Promise.resolve();
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = null;

    const version = state.version;
    const definition = historyRef.current.present;
    state.failed = false;
    setSave((current) => ({ ...current, status: 'saving', error: null }));
    const saving = (async () => {
      try {
        const saved = await saveDraft(queryClient, client, workflowId, { revision: state.revision, definition });
        state.revision = saved.revision;
        state.savedVersion = version;
        setRevision(saved.revision);
        applyResult({ version, definition, problems: saved.problems, symbols: saved.symbols });
        // "Salvo há…" counts from this browser's clock: a server clock a little ahead would show "há 2 min" right away.
        setSave({ status: state.version === version ? 'saved' : 'pending', savedAt: new Date().toISOString(), error: null });
      } catch (error) {
        state.failed = true;
        state.again = false;
        if (error instanceof ApiError && error.code === 'draft_conflict') {
          state.conflict = true;
          setSave((current) => ({ ...current, status: 'conflict', error }));
        } else {
          setSave((current) => ({ ...current, status: 'error', error }));
        }
      } finally {
        state.saving = null;
      }
      if (state.again) {
        state.again = false;
        await runSaveRef.current();
      }
    })();
    state.saving = saving;
    // Reading the draft again (the editor reopened, "Recarregar rascunho") waits for this save.
    trackDraftSave(queryClient, workflowId, saving);
    return saving;
  }, [applyResult, client, queryClient, workflowId]);
  const runSaveRef = useRef(runSave);
  runSaveRef.current = runSave;

  const commit = useCallback(
    (next: History<WorkflowDefinition>) => {
      if (next === historyRef.current) return;
      historyRef.current = next;
      setHistoryState(next);
      const state = live.current;
      state.version += 1;
      const version = state.version;
      setVersion(version);
      setSelection((current) => (itemExists(next.present, current.item) ? current : { item: WORKFLOW_ITEM, field: null }));

      if (analysisTimer.current !== null) clearTimeout(analysisTimer.current);
      analysisTimer.current = setTimeout(() => {
        analysisTimer.current = null;
        setAnalysisTarget({ version, definition: next.present });
      }, ANALYSIS_DELAY_MS);

      if (state.conflict) return;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      setSave((current) => (current.status === 'saved' ? { ...current, status: 'pending' } : current));
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void runSaveRef.current();
      }, SAVE_DELAY_MS);
    },
    [],
  );

  const change = useCallback(
    (update: DefinitionUpdate, options: ChangeOptions = {}) => {
      if (live.current.readOnly) return;
      const current = historyRef.current;
      const definition = typeof update === 'function' ? update(current.present) : update;
      commit(pushHistory(current, definition, Date.now(), options.mergeKey ?? null));
    },
    [commit],
  );

  const undo = useCallback(() => {
    if (!live.current.readOnly) commit(undoHistory(historyRef.current));
  }, [commit]);
  const redo = useCallback(() => {
    if (!live.current.readOnly) commit(redoHistory(historyRef.current));
  }, [commit]);

  const select = useCallback((item: EditorItem, field: string | null = null) => setSelection({ item, field }), []);

  const retrySave = useCallback(() => {
    void runSaveRef.current();
  }, []);

  const flush = useCallback(async (): Promise<number | null> => {
    const state = live.current;
    for (;;) {
      if (state.saving) {
        await state.saving;
        if (state.failed) return null;
        continue;
      }
      if (state.readOnly || state.conflict) return null;
      if (state.version === state.savedVersion) return state.revision;
      await runSaveRef.current();
      if (state.failed) return null;
    }
  }, []);

  const reload = useCallback(async () => {
    setReloadState({ reloading: true, error: null });
    try {
      const fresh = await fetchDraftAgain(queryClient, client, workflowId);
      clearTimers();
      const state = live.current;
      // The results asked before the reload (lower version) are ignored when they arrive.
      state.version += 1;
      state.savedVersion = state.version;
      state.revision = fresh.revision;
      state.conflict = false;
      state.failed = false;
      state.again = false;
      const next = startHistory(fresh.definition);
      historyRef.current = next;
      setHistoryState(next);
      setRevision(fresh.revision);
      setAnalysisTarget(null);
      setVersion(state.version);
      setResult({ version: state.version, definition: fresh.definition, problems: fresh.problems, symbols: fresh.symbols });
      setSave({ status: 'saved', savedAt: fresh.updated_at, error: null });
      setSelection((current) => (itemExists(fresh.definition, current.item) ? current : { item: WORKFLOW_ITEM, field: null }));
      setReloadState({ reloading: false, error: null });
    } catch (error) {
      setReloadState({ reloading: false, error });
    }
  }, [clearTimers, client, queryClient, workflowId]);

  // The analysis of the latest version; an older answer never replaces a newer result.
  const analysis = useDraftAnalysis(workflowId, analysisTarget);
  useEffect(() => {
    if (analysis.data && analysisTarget) {
      applyResult({
        version: analysisTarget.version,
        definition: analysisTarget.definition,
        problems: analysis.data.problems,
        symbols: analysis.data.symbols,
      });
    }
  }, [analysis.data, analysisTarget, applyResult]);

  const analysisFailed = analysis.isError && analysisTarget !== null && result.version < analysisTarget.version;

  // Leaving the editor saves what is pending (E4-23). The save goes on after the screen is gone.
  useEffect(
    () => () => {
      clearTimers();
      const state = live.current;
      if (!state.readOnly && !state.conflict && state.version !== state.savedVersion) void runSaveRef.current();
    },
    [clearTimers],
  );

  const value = useMemo<DraftEditorValue>(
    () => ({
      workflowId,
      definition: history.present,
      revision,
      problems: result.problems,
      symbols: result.symbols,
      analyzedDefinition: result.definition,
      problemsOutdated: result.version !== version,
      analysisFailed,
      readOnly,
      selection,
      select,
      change,
      undo,
      redo,
      canUndo: !readOnly && history.past.length > 0,
      canRedo: !readOnly && history.future.length > 0,
      save,
      retrySave,
      flush,
      reload,
      reloadState,
    }),
    [workflowId, history, revision, result, version, analysisFailed, readOnly, selection, select, change, undo, redo, save, retrySave, flush, reload, reloadState],
  );

  return <DraftEditorContext.Provider value={value}>{children}</DraftEditorContext.Provider>;
}
