// Sub-vertical "decision-table" of the "editor" vertical (ADR 0003): the properties of a Decision Table (with "Abrir
// tabela") and the grid of its rules, which opens in place of the canvas (E4-22). Both read and change the draft with
// useDraftEditor; the editor screen (F57) mounts them.
export { DecisionTableGrid } from './DecisionTableGrid';
export type { DecisionTableGridProps } from './DecisionTableGrid';
export { DecisionTableProperties } from './DecisionTableProperties';
export type { DecisionTablePropertiesProps } from './DecisionTableProperties';
export { isGridPath } from './tableProblems';
export { parseClipboard } from './clipboard';
export { MAX_RULES, MAX_CONDITIONS, MAX_RESULTS } from './tableModel';
