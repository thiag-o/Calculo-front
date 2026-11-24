// Sub-vertical "values" of the "editor" vertical (D25, ADR 0056): the formatters of values on screen, shared by "preview"
// and "unit-run" (which depend on this one, never on each other the other way around). Numbers and dates only as text.
// The Brazilian-pattern readers and formatters live in `design-system/format` (ADR 0069); re-exported here for the editor.
export { formatApiNumber, readBrazilianNumber, formatDate, formatDateTime } from '../../design-system';
export type { NumberReading } from '../../design-system';
export { NO_VALUE } from './empty';
export { formatValue } from './format';
export { allNodes, variableTypes } from './variableTypes';
