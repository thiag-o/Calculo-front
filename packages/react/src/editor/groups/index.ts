// Sub-vertical "groups" of the "editor" vertical (ADR 0003, E5-16): the groups of the workflow (E5-19). The tree of
// nodes (groups inside groups), the group edits (Agrupar, Desagrupar, "Mover para o grupo…", "Tirar do grupo",
// recolher e expandir, the Output), where a group stands on the canvas, its React Flow node and its properties. The
// canvas and the layers draw the tree from here; every edit goes to the draft through useDraftEditor().change.
export {
  isGroup,
  treeEntries,
  findEntry,
  findNode,
  findGroup,
  scopeNodes,
  ancestorsOf,
  descendantsOf,
  updateScope,
  updateNodes,
  updateNode,
  removeNode,
  siblingsOf,
  producedNames,
  declaredNames,
  firstFree,
  freeNodeId,
} from './tree';
export type { DefinitionNode, GroupNode, TreeEntry } from './tree';
export {
  groupReason,
  groupNodes,
  ungroup,
  moveTargets,
  moveToGroup,
  takeOutOfGroup,
  setCollapsed,
  setGroupOutputs,
  outputCandidates,
} from './actions';
export type { Grouped } from './actions';
export { BLOCK_WIDTH, BLOCK_HEIGHT, GROUP_CONTENT, groupSizes, clampInside } from './layout';
export type { Size, GroupRows } from './layout';
export { GroupBoxNode } from './GroupBoxNode';
export type { GroupBoxData, GroupBoxNodeType, GroupBoxView, GroupBoxPort } from './GroupBoxNode';
export { MoveToGroupDialog } from './MoveToGroupDialog';
export type { MoveToGroupDialogProps } from './MoveToGroupDialog';
export { GroupProperties } from './GroupProperties';
export type { GroupPropertiesProps } from './GroupProperties';
export { GroupIcon, MoreIcon } from './icons';
export * from './messages';
