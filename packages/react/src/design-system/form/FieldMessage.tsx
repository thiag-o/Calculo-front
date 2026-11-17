import type { HTMLAttributes } from 'react';
import { textClasses } from '../typography';
import { AlertIcon } from './icons';
import './field.css';

/** `tooltip`: help below the field (tertiary label-12). `error`: what happened and what to do (red-900, with icon). */
export type FieldMessageType = 'tooltip' | 'error';

export interface FieldMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Default: `tooltip`. */
  type?: FieldMessageType;
}

/**
 * Message below a field (estilos.md §7.2). Bind it to the field through `aria-describedby`; the
 * design-system fields already do this with the `tooltip` and `error` props.
 */
export function FieldMessage({ type = 'tooltip', className, children, ...rest }: FieldMessageProps) {
  const classes = [
    'fc-field-message',
    `fc-field-message-${type}`,
    textClasses({ variant: 'label-12', emphasis: type === 'tooltip' ? 'tertiary' : undefined }),
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <p className={classes} {...rest}>
      {type === 'error' ? <AlertIcon size={12} /> : null}
      <span>{children}</span>
    </p>
  );
}
