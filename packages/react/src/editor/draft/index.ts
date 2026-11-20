// Sub-vertical "draft" of the "editor" vertical (ADR 0003): the draft queries and its local edit (definition, selection,
// undo, saving by itself, analysis while typing, conflict and read-only). The editor's panels read it with useDraftEditor.
export { DraftEditorProvider, useDraftEditor, SAVE_DELAY_MS, ANALYSIS_DELAY_MS } from './DraftEditor';
export type {
  DraftEditorProviderProps,
  DraftEditorValue,
  SaveState,
  SaveStatus,
  ReloadState,
  ChangeOptions,
  DefinitionUpdate,
} from './DraftEditor';
export { useDraft, useDraftAnalysis, saveDraft, fetchDraftAgain } from './queries';
export type { Draft, WorkflowDefinition, WorkflowProblem, DraftSymbol, Analysis, AnalysisTarget } from './queries';
export { WORKFLOW_ITEM, sameItem } from './selection';
export type { EditorItem, EditorSelection } from './selection';
export { HISTORY_LIMIT } from './history';
export { useUndoShortcuts } from './useUndoShortcuts';
export { SaveIndicator, SaveNotices } from './SaveIndicator';
export { savedAgo } from './savedAgo';
export { READ_ONLY_REASON, loadErrorMessage, canRetryLoad } from './messages';
