// Sub-vertical "unit-run" of the "editor" vertical (ADR 0003): the "Calcular" tab of the bottom panel (E4-14, E4-24,
// E5-12, E5-20). Without a batch source, the form generated from the declared inputs; with one, "Escolher registro" (the
// sample of the last preview or the key typed). The result is the trace of the saved draft for one record. It reads and
// saves the draft only through useDraftEditor (ADR 0042).
export { UnitRunPanel } from './UnitRunPanel';
export { UNIT_RUN_LABEL } from './messages';
export type { UnitRun, UnitRunNode } from './queries';
// The last "Calcular" of each workflow, in memory (ADRs 0045 and 0056): the canvas shows its values (E5-21). Only the
// canvas depends on this; unit-run never imports the canvas.
export { useLastUnitRun } from './lastRun';
export type { LastUnitRun, LastUnitRunValue } from './lastRun';

/** The value of the "Calcular" tab of the bottom panel (`bottomTabs` of the editor screen). */
export const UNIT_RUN_TAB = 'unit-run';

/** The tab shows with either permission (E4-20; the API accepts either, ADR 0046 of the back). */
export const UNIT_RUN_PERMISSIONS = ['workflows.edit', 'simulations.run'] as const;

/** Whether the person may use "Calcular": `workflows.edit` or `simulations.run`. */
export function canRunUnit(hasPermission: (code: string) => boolean): boolean {
  return UNIT_RUN_PERMISSIONS.some((code) => hasPermission(code));
}
