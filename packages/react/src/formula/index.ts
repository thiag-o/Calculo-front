// Vertical "formula" (ADR 0003).
// Formula editor (Monaco, loaded on demand) and the formula language.
// This file is the vertical's public interface; the rest of the folder is private.
export { FormulaEditor } from './FormulaEditor';
export type { FormulaEditorProps } from './FormulaEditor';
export { useFormulaLanguage, FORMULA_LANGUAGE_KEY } from './queries';
export type { FormulaContext, FormulaFunction, FormulaLanguage, FormulaSymbol, WorkflowProblem } from './queries';
