// Sub-vertical "canvas" of the "editor" vertical (ADR 0003): the workflow canvas (React Flow, ADR 0037) with the blocks,
// the groups (drawn by editor/groups), the Entradas and Saída bars, the links derived from the analysis, the toolbar, the
// zoom and the minimap. It reads and changes the draft only through useDraftEditor (ADR 0042); the editor screen (F57)
// mounts it.
export { WorkflowCanvas, ARROW_STEP } from './WorkflowCanvas';
export type { WorkflowCanvasProps } from './WorkflowCanvas';
export { canvasGraph, readersOf } from './graph';
export type { CanvasGraph, BlockView, GroupView, GroupPort, Link, Port } from './graph';
// Delete on a block (confirmation, announcement and focus afterwards), shared with the layers.
export { useBlockRemoval } from './BlockRemoval';
export type { BlockRemoval, BlockRemovalOptions } from './BlockRemoval';
