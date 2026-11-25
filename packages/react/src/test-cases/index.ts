// Vertical "test-cases" (ADR 0003).
// Workflow test cases (inputs → expected outputs) and reference file.
// This file is the vertical's public interface; the rest of the folder is private.

// The Testes screen of a workflow (`/workflows/:id/tests`, E7-25): in epic 7, only the Arquivo de referência section.
export { TestCases } from './TestCases';
export type { TestCasesProps } from './TestCases';
// The permissions of the screen (E7-14) and the cache keys, all under `['test-cases', …]`.
export { SIMULATIONS_RUN, TEST_CASES_EDIT, TEST_CASES_KEY, referenceFilesKey } from './reference-files';
export type { ReferenceFile } from './reference-files';
