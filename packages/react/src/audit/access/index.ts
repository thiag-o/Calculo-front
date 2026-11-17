// Sub-vertical "access" of the "audit" vertical (ADR 0003): Audit › Access (sign-ins, failures, locks and access
// changes). This folder's interface; other verticals reach it only through audit/index.ts.
export { AccessEvents } from './AccessEvents';
