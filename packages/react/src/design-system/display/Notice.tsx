import type { HTMLAttributes, ReactNode } from 'react';
import { AlertIcon } from '../form/icons';
import { WarningIcon, SuccessIcon } from './icons';
import './notice.css';

/** `error` (red), `warning` (amber) and `success` (green): -100 background and -900 text (estilos.md §7.7). */
export type NoticeType = 'success' | 'error' | 'warning';

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  type: NoticeType;
  /** Summary in weight 500, before the text. Optional. */
  title?: ReactNode;
  /** What happened, where and what to do (estilos.md §14). No "Ops!" and no exclamation. */
  children: ReactNode;
  /** Actions to fix it, below the note ("Abrir catálogo", "Tentar de novo"). */
  actions?: ReactNode;
}

const icons: Record<NoticeType, ReactNode> = {
  error: <AlertIcon size={14} />,
  warning: <WarningIcon size={14} />,
  success: <SuccessIcon size={14} />,
};

/**
 * Inline note (estilos.md §7.7 and §14): -100 background, -900 text, 6px radius, 14px icon, no side border.
 * The error is `alert` (announced right away); success and warning are `status` (announced without interrupting).
 */
export function Notice({ type, title, actions, className, children, ...rest }: NoticeProps) {
  const note = (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={['fc-notice', `fc-notice-${type}`, actions ? null : className].filter(Boolean).join(' ')}
      {...(actions ? {} : rest)}
    >
      {icons[type]}
      <div className="fc-notice-text">
        {title ? <p className="fc-notice-title">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );

  if (!actions) return note;

  return (
    <div className={['fc-notice-block', className].filter(Boolean).join(' ')} {...rest}>
      {note}
      <div className="fc-notice-actions">{actions}</div>
    </div>
  );
}
