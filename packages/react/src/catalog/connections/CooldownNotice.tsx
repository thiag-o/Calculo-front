import { Notice } from '../../design-system';

/**
 * The wait of a `429` for the screen reader: a visually hidden `aria-live` region that is always mounted (so a change is
 * announced) and changes only at the start and at the end of the wait, never second by second.
 */
export function CooldownAnnouncer({ announcement }: { announcement: string }) {
  return (
    <div role="status" aria-live="polite" className="fc-visually-hidden">
      {announcement}
    </div>
  );
}

/**
 * The `429` of "Salvar" with the seconds left, as beside "Testar". The count is hidden from the screen reader (the
 * `CooldownAnnouncer` says it once); gone when the wait ends.
 */
export function CooldownNotice({ reason }: { reason: string | undefined }) {
  if (!reason) return null;
  return (
    <Notice type="warning">
      <span aria-hidden="true">{reason}</span>
    </Notice>
  );
}
