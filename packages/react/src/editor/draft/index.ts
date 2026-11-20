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
export { useDraft, useDraftAnalysis, saveDraft, fetchDraftAgain, prefetchDraft } from './queries';
export type { Draft, WorkflowDefinition, WorkflowProblem, DraftSymbol, Dependency, Analysis, AnalysisTarget } from './queries';
export { WORKFLOW_ITEM, sameItem } from './selection';
export type { EditorItem, EditorSelection } from './selection';
// The free names of a new block and of a new output or result column (`calc_N`, `td_N`, `resultado_N`).
export { usedNames, freeResultName, freeBlockId } from './names';
export { HISTORY_LIMIT } from './history';
export { useUndoShortcuts } from './useUndoShortcuts';
export { SaveIndicator, SaveNotices } from './SaveIndicator';
export { savedAgo } from './savedAgo';
export { READ_ONLY_REASON, loadErrorMessage, canRetryLoad } from './messages';
// A change the save on close could not save: kept in the module's memory (never in localStorage), told by the next
// screen with "Voltar ao editor" and taken back by the reopened editor.
export { UnsavedChangesNotice } from './UnsavedChangesNotice';
export type { UnsavedChangesNoticeProps } from './UnsavedChangesNotice';
export { draftOwner, findUnsavedChange, useUnsavedDraftChanges } from './unsavedChanges';
export type { UnsavedDraftChange } from './unsavedChanges';
