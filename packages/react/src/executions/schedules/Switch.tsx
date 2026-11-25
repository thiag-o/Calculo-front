import { useId } from 'react';
import { textClasses } from '../../design-system';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The accessible name. With `showLabel`, it is also shown beside the switch. */
  label: string;
  showLabel?: boolean;
  /** The change is on its way: the switch ignores clicks and says it is busy, without losing focus. */
  busy?: boolean;
  disabled?: boolean;
}

/**
 * Switch, 32×18 pill (estilos.md §7.2), as a `button` with `role="switch"`: Space and Enter toggle. It only lives in the
 * schedules for now; it goes to the design system when another screen needs one.
 */
export function Switch({ checked, onCheckedChange, label, showLabel = false, busy = false, disabled = false }: SwitchProps) {
  const id = useId();
  const button = (
    <button
      id={id}
      type="button"
      role="switch"
      className="fc-schedules-switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (!busy) onCheckedChange(!checked);
      }}
    >
      <span className="fc-schedules-switch-knob" aria-hidden="true" />
    </button>
  );
  if (!showLabel) return button;
  return (
    <div className="fc-schedules-switch-field">
      {button}
      <label htmlFor={id} className={textClasses({ variant: 'copy-14' })}>
        {label}
      </label>
    </div>
  );
}
