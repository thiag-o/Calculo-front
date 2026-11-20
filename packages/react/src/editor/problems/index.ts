// Sub-vertical "problems" of the "editor" vertical (ADR 0003): the bar's "● N problemas", the Problems tab and the count
// of problems per block, for the canvas and the layers.
export { ProblemCounter } from './ProblemCounter';
export type { ProblemCounterProps } from './ProblemCounter';
export { ProblemList } from './ProblemList';
export type { ProblemListProps } from './ProblemList';
export { useProblemCounts, countProblems, groupProblems, problemItem, problemCountText } from './problemGroups';
export type { ProblemCounts, ProblemGroup, ProblemOwnerKind } from './problemGroups';
