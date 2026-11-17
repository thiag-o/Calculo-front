import type { HTMLAttributes } from 'react';
import './card.css';

/** `default`: 16px inside (cards). `none`: for lists and tables, whose rows have their own spacing. */
export type CardPadding = 'default' | 'none';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** HTML element. Default: div. Use `section` with a title, `article` in cards and `li` inside lists. */
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
  /** Default: `default`. */
  padding?: CardPadding;
}

/** Content box (estilos.md §7.6): background-100, 1px border, 12px radius, no shadow. */
export function Card({ as: Tag = 'div', padding = 'default', className, ...rest }: CardProps) {
  const classes = ['fc-card', padding === 'none' ? 'fc-card-no-padding' : null, className].filter(Boolean).join(' ');
  return <Tag className={classes} {...rest} />;
}
