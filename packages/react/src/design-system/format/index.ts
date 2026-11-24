// Sub-vertical "format" of "design-system" (ADR 0069): the Brazilian-pattern reading and formatting of numbers and dates,
// the one place every vertical takes them from. Only text is handled: a value never becomes a floating-point `number`.
export { formatApiNumber, readBrazilianNumber } from './numbers';
export type { NumberReading } from './numbers';
export { formatDate, formatDateTime } from './dates';
