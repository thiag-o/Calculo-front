// Vertical "formula" (ADR 0003).
// Formula editor (Monaco, loaded on demand) and the formula language.
// This file is the vertical's public interface; the rest of the folder is private.
export { FormulaEditor } from './FormulaEditor';
export type { FormulaEditorProps } from './FormulaEditor';
export { useFormulaLanguage, FORMULA_LANGUAGE_KEY } from './queries';
export type { FormulaContext, FormulaFunction, FormulaLanguage, FormulaSymbol, WorkflowParameter, WorkflowProblem } from './queries';
// The run parameters as `@nome` (E6-18), also read by the filter values (editor/sources/filters): the references each
// parameter offers (a period by `.inicio` and `.fim`), the reading of a written one, and the autocomplete list of a text field.
export { PERIOD_PARTS, findParameter, parameterReferences, parameterTypeLabel, readParameterReference } from './parameters';
export type { ParameterReading, ParameterReference, PeriodPart } from './parameters';
export { SuggestionList, suggestionId, useSuggestionKeys } from './SuggestionList';
export type { SuggestionItem, SuggestionListProps } from './SuggestionList';
