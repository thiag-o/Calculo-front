import { forwardRef, type InputHTMLAttributes } from 'react';
import { FieldMessages, joinClasses, useFieldIds, type FieldProps } from './fieldStructure';
import { Label } from './Label';
import './field.css';

/**
 * Accepted text types. Password uses PasswordField. `date` uses the browser date picker: the value is `yyyy-mm-dd` (empty
 * while the date is incomplete) and the screen shows it in the format of the user's language.
 */
export type TextFieldType = 'text' | 'email' | 'search' | 'tel' | 'url' | 'number' | 'date';

export interface TextFieldProps extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'children'> {
  /** Default: `text`. */
  type?: TextFieldType;
  /** Classes of the field container (label, input and messages). The other props go to the `<input>`. */
  className?: string;
}

/**
 * Text field with label, tooltip and error (estilos.md §7.2). Forwards the `ref` to the `<input>`, to work with
 * react-hook-form's `register`.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, tooltip, error, id, className, type = 'text', 'aria-describedby': externalDescribedBy, ...rest },
  ref,
) {
  const ids = useFieldIds(id, tooltip, error, externalDescribedBy);
  return (
    <div className={joinClasses('fc-field', className)}>
      <Label htmlFor={ids.id}>{label}</Label>
      <input
        {...rest}
        ref={ref}
        id={ids.id}
        type={type}
        className="fc-field-input"
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
      />
      <FieldMessages ids={ids} tooltip={tooltip} error={error} />
    </div>
  );
});
