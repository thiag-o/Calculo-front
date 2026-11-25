import { ApiError, type Schemas } from '../api';
import type { StatusTone } from '../design-system';

type NotificationKind = Schemas['NotificationKind'];

/**
 * The dot of each alert kind (estilos.md §7.3 and §12: green, red and amber only for status). Red for what failed
 * (aborted, with errors, a schedule that did not fire, like "Abortada" and "Com erros"); amber for what asks for
 * attention without a failure (a decision to take, E7-21; an alert the scheduled run went on with; a skipped schedule).
 * The title (from the API) is the word beside the dot, so the kind is never only the color (§11).
 */
export const KIND_TONE: Readonly<Record<NotificationKind, StatusTone>> = {
  awaiting_decision: 'amber',
  pre_validation_alert: 'amber',
  execution_aborted: 'red',
  execution_completed_with_errors: 'red',
  schedule_failed: 'red',
  schedule_skipped: 'amber',
};

/** The bell name with the unread count (E7-27): "Alertas, 3 não lidos". Without the count yet: "Alertas". */
export function bellLabel(unread: number | undefined): string {
  if (unread === undefined) return 'Alertas';
  if (unread === 0) return 'Alertas, nenhum não lido';
  if (unread === 1) return 'Alertas, 1 não lido';
  return `Alertas, ${unread.toLocaleString('pt-BR')} não lidos`;
}

/** The count in the badge: up to 99, then "99+" (the name keeps the exact number). */
export function badgeText(unread: number): string {
  return unread > 99 ? '99+' : String(unread);
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver os alertas neste tenant. Peça acesso a um Admin.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Error of the alert list, by `code` (ADR 0008). */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'no_permission') return NO_PERMISSION_MESSAGE;
  // no_connection, unexpected_response…: the error's own pt-BR message.
  return error.message;
}

/** Error of "Marcar todos como lidos": the API's pt-BR message (or the client's, without a response). */
export function markAllErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNKNOWN_MESSAGE;
}
