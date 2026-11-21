// Sub-vertical "values" of the "editor" vertical (D25, ADR 0056): the formatters of values on screen, shared by "preview"
// and "unit-run" (which depend on this one, never on each other the other way around). Numbers and dates only as text.
export { formatApiNumber, readBrazilianNumber } from './numbers';
export type { NumberReading } from './numbers';
export { formatDate, formatDateTime } from './dates';
export { NO_VALUE } from './empty';
export { formatValue } from './format';
