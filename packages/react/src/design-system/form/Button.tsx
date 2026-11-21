import { forwardRef, useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { textClasses } from '../typography';
import { ButtonTooltip } from './ButtonTooltip';
import { LoadingIcon, InfoIcon } from './icons';
import './button.css';

/** Variants of estilos.md §7.1. One main action per area. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** 28px (small), 32px (default) and 40px (large). */
export type ButtonSize = 'small' | 'default' | 'large';

/** Where the reason of a disabled button shows: in the tooltip (focus and hover) or as text beside it. */
export type ReasonDisplay = 'tooltip' | 'beside';

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children'> {
  /** Default: `secondary`. */
  variant?: ButtonVariant;
  /** Default: `default` (32px). */
  size?: ButtonSize;
  /** Icon on the left of the text (16px; 14px in small), like a Lucide icon. */
  icon?: ReactNode;
  /** Action in progress: shows the indicator, sets `aria-busy` and ignores clicks, without losing focus. */
  loading?: boolean;
  /**
   * Disables the button saying why (estilos.md §14): "Resolva 1 problema e 1 teste para enviar".
   * There is no disabled button without a reason. The button stays focusable, with `aria-disabled` and the reason in `aria-describedby`.
   */
  disabledReason?: string;
  /** Default: `tooltip`. */
  showReason?: ReasonDisplay;
}

interface TextButtonProps extends ButtonBaseProps {
  iconOnly?: false;
  /** Text as verb + object ("Abrir editor"). */
  children: ReactNode;
  label?: never;
}

interface IconButtonProps extends ButtonBaseProps {
  /** Square button with the icon only. */
  iconOnly: true;
  icon: ReactNode;
  /** Accessible name of the button, also shown in the tooltip. */
  label: string;
  children?: never;
}

export type ButtonProps = TextButtonProps | IconButtonProps;

interface NativeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button's aria-describedby. */
  description?: string;
}

/**
 * The `<button>`, with aria-describedby coming only from `description`. The tooltip (Radix Tooltip) adds its own
 * content id to aria-describedby while open; since the Button already describes the reason, the screen reader
 * would read it twice. That is why the aria-describedby coming from the tooltip is discarded.
 */
const NativeButton = forwardRef<HTMLButtonElement, NativeButtonProps>(function NativeButton(
  { description, ...rest },
  ref,
) {
  // The aria-describedby of `rest` (the tooltip's) is overwritten.
  return <button {...rest} ref={ref} aria-describedby={description} />;
});

/** Product button (estilos.md §7.1): variants, sizes, icon only, loading and disabled with a reason. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = 'secondary',
    size = 'default',
    icon,
    loading = false,
    disabledReason,
    showReason = 'tooltip',
    iconOnly = false,
    label,
    children,
    className,
    type = 'button',
    onClick,
    'aria-describedby': externalDescribedBy,
    ...rest
  } = props;

  const reasonId = useId();
  const disabled = Boolean(disabledReason);
  const inert = disabled || loading;
  const describedBy = [disabled ? reasonId : undefined, externalDescribedBy].filter(Boolean).join(' ') || undefined;

  const classes = [
    'fc-button',
    `fc-button-${variant}`,
    size === 'default' ? null : `fc-button-${size}`,
    iconOnly ? 'fc-button-icon-only' : null,
    disabled ? 'fc-button-disabled' : null,
    loading ? 'fc-button-loading' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // aria-disabled blocks neither the click nor the form submit (Enter in a field triggers the submit button).
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  const button = (
    <NativeButton
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-label={iconOnly ? label : rest['aria-label']}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      description={describedBy}
      onClick={handleClick}
    >
      {loading ? <LoadingIcon className="fc-button-spinning" /> : icon}
      {iconOnly ? null : <span className="fc-button-text">{children}</span>}
    </NativeButton>
  );

  const reasonInTooltip = disabled && showReason === 'tooltip';
  const tooltipContent = iconOnly ? (
    reasonInTooltip ? (
      <>
        <span className="fc-button-tooltip-name">{label}</span>
        <span>{disabledReason}</span>
      </>
    ) : (
      label
    )
  ) : reasonInTooltip ? (
    disabledReason
  ) : null;

  const withTooltip = tooltipContent ? <ButtonTooltip content={tooltipContent}>{button}</ButtonTooltip> : button;

  if (!disabled) return withTooltip;

  if (showReason === 'beside') {
    return (
      <span className="fc-button-with-reason">
        {withTooltip}
        <span id={reasonId} className={`fc-button-reason ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
          <InfoIcon size={12} />
          {disabledReason}
        </span>
      </span>
    );
  }

  // With the tooltip, the reason is also in the DOM (hidden) so aria-describedby works with the tooltip closed.
  return (
    <>
      {withTooltip}
      <span id={reasonId} hidden>
        {disabledReason}
      </span>
    </>
  );
});
