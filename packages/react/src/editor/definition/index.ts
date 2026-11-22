// Sub-vertical "definition" of the "editor" vertical (ADR 0003): the pure reads of the definition (every node, where a node
// is, the names a node produces, how many times a variable name is used) that more than one sub-vertical needs, so each
// one lives once. A leaf: it imports only the draft's type. Edits of the definition stay in the sub-vertical that owns them.
export { allNodes, declaredVariableNames, locateNode, producedNames, variableNameCounts } from './nodes';
export type { DefinitionNode, GroupNode, NodePlace } from './nodes';
