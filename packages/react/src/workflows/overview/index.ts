// Sub-vertical "overview" of the "workflows" vertical (ADR 0003): the workflow Overview (`/workflows/:id`), with
// "Renomear" and "Remover workflow". This folder's interface; other verticals reach it only through workflows/index.ts.
export { WorkflowOverview } from './WorkflowOverview';
export type { WorkflowOverviewProps } from './WorkflowOverview';
