import type { HTMLAttributes } from 'react';
import './typography.css';

/** Styles of the type scale (estilos.md §3). */
export const textStyles = [
  'heading-48',
  'heading-32',
  'heading-24',
  'heading-16',
  'heading-14',
  'copy-14',
  'label-14',
  'label-13',
  'label-12',
  'button-14',
  'mono-13',
  'mono-12',
] as const;

export type TextStyle = (typeof textStyles)[number];

/** Text color: primary, secondary or tertiary (tertiary only for non-essential information). */
export type TextEmphasis = 'primary' | 'secondary' | 'tertiary';

type TextElement = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'strong' | 'em' | 'code';

export interface TextOptions {
  variant: TextStyle;
  emphasis?: TextEmphasis;
  /** Weight 500, for label-14, label-12 and mono-13. */
  medium?: boolean;
}

/** fc- classes of a text style, for elements that are not the Text component. */
export function textClasses({ variant, emphasis, medium }: TextOptions): string {
  return [`fc-${variant}`, emphasis ? `fc-text-${emphasis}` : null, medium ? 'fc-text-medium' : null].filter(Boolean).join(' ');
}

export interface TextProps extends TextOptions, HTMLAttributes<HTMLElement> {
  /** Rendered HTML element. Default: span. Headings pick the level (h1…h6) by the screen hierarchy. */
  as?: TextElement;
}

/** Text on the product type scale. */
export function Text({ variant, emphasis, medium, as: Tag = 'span', className, ...rest }: TextProps) {
  const classes = ['fc-text', textClasses({ variant, emphasis, medium }), className].filter(Boolean).join(' ');
  return <Tag className={classes} {...rest} />;
}
