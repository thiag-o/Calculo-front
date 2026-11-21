// Sub-vertical "preview" of the "editor" vertical (ADR 0003, E5-16): the "Prévia" tab of the bottom panel (E5-11, E5-20),
// with the counts per Fonte block and the example records per group of the saved draft. It reads and saves the draft only
// through useDraftEditor (ADR 0042). The last preview of each workflow stays in memory for the "Calcular" tab
// (useLastPreview: "Escolher registro" by the sample, F67).
export { PreviewPanel } from './PreviewPanel';
export { PreviewResult } from './PreviewResult';
export type { PreviewResultProps } from './PreviewResult';
export { PREVIEW_LABEL, RUN_PREVIEW_LABEL, COUNT_NOTE } from './messages';
export { useLastPreview, PREVIEW_SAMPLE_SIZE } from './queries';
export type { LastPreview, Preview, PreviewGroup, PreviewRecord, PreviewSource } from './queries';

/** The value of the "Prévia" tab of the bottom panel (`bottomTabs` of the editor screen), between Problemas and Calcular. */
export const PREVIEW_TAB = 'preview';

/** The tab shows with either permission (the API accepts either, like the unit run; the Auditor sees no Prévia). */
export const PREVIEW_PERMISSIONS = ['workflows.edit', 'simulations.run'] as const;

/** Whether the person may use "Rodar prévia": `workflows.edit` or `simulations.run`. */
export function canRunPreview(hasPermission: (code: string) => boolean): boolean {
  return PREVIEW_PERMISSIONS.some((code) => hasPermission(code));
}
