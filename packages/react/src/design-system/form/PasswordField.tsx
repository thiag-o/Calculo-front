import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { FieldMessages, joinClasses, useFieldIds, type FieldProps } from './fieldStructure';
import { EyeIcon, EyeOffIcon } from './icons';
import { Label } from './Label';
import './field.css';

export interface PasswordFieldProps extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'children'> {
  /** Classes of the field container (label, input and messages). The other props go to the `<input>`. */
  className?: string;
}

/**
 * Password field with label, tooltip, error and the "Mostrar senha" button (toggle with `aria-pressed`).
 * The password starts hidden. Default `autoComplete`: `current-password` (use `new-password` when setting a password).
 * Forwards the `ref` to the `<input>`, to work with react-hook-form's `register`.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, tooltip, error, id, className, autoComplete = 'current-password', 'aria-describedby': externalDescribedBy, ...rest },
  ref,
) {
  const ids = useFieldIds(id, tooltip, error, externalDescribedBy);
  const [visible, setVisible] = useState(false);

  return (
    <div className={joinClasses('fc-field', className)}>
      <Label htmlFor={ids.id}>{label}</Label>
      <div className="fc-password-field">
        <input
          {...rest}
          ref={ref}
          id={ids.id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          className="fc-field-input"
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
        />
        <button
          type="button"
          className="fc-password-field-toggle"
          aria-label="Mostrar senha"
          aria-pressed={visible}
          aria-controls={ids.id}
          disabled={rest.disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <FieldMessages ids={ids} tooltip={tooltip} error={error} />
    </div>
  );
});
