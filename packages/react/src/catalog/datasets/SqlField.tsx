import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { FieldMessage, Label } from '../../design-system';

export interface SqlFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  label: string;
  /** Help below the field. */
  tooltip?: string;
  /** Field error: the reason the SQL was refused. Marks the field as invalid. */
  error?: string;
}

/**
 * Monospaced text area for free SQL (estilos.md §7.2 and §8, "mono-13"), with label, help and error. The Monaco editor
 * comes in epic 4; until then, a plain `<textarea>` that does not correct spelling. Forwards the `ref` to the
 * `<textarea>`, to work with react-hook-form's `register`.
 */
export const SqlField = forwardRef<HTMLTextAreaElement, SqlFieldProps>(function SqlField(
  { label, tooltip, error, id, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? `fc-sql-${generated}`;
  const tooltipId = tooltip ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, tooltipId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="fc-field">
      <Label htmlFor={fieldId}>{label}</Label>
      <textarea
        {...rest}
        ref={ref}
        id={fieldId}
        className="fc-datasets-sql"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {tooltipId ? (
        <FieldMessage id={tooltipId} type="tooltip">
          {tooltip}
        </FieldMessage>
      ) : null}
      {errorId ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </div>
  );
});
