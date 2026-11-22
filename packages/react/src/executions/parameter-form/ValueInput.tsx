import { useId, type KeyboardEventHandler, type ReactNode } from 'react';
import { FieldMessage, Label, Select, TextField } from '../../design-system';
import type { ScalarType } from './literals';

/** "Vazio", "Verdadeiro" and "Falso"; the select needs a non-empty value for the empty one. */
const EMPTY_OPTION = 'empty';
const BOOLEAN_OPTIONS = [
  { value: EMPTY_OPTION, label: 'Vazio' },
  { value: 'true', label: 'Verdadeiro' },
  { value: 'false', label: 'Falso' },
] as const;

export interface ValueInputProps {
  label: ReactNode;
  tooltip?: string;
  type: ScalarType;
  value: string;
  /** `badInput`: the browser holds a date it cannot read (half typed), which it reports as empty. */
  onChange: (value: string, badInput: boolean) => void;
  onBlur?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * The field of one value, by type (E4-24): text; number in the Brazilian pattern (`1.500,00`); date and date and time with
 * the browser's own pickers (shown in the format of the user's language); boolean as a select of "Vazio", "Verdadeiro" and
 * "Falso".
 */
export function ValueInput({ label, tooltip, type, value, onChange, onBlur, onKeyDown, error, disabled, className }: ValueInputProps) {
  if (type === 'boolean') {
    return (
      <Select
        className={className}
        label={label}
        tooltip={tooltip}
        error={error ?? undefined}
        options={BOOLEAN_OPTIONS}
        value={value === '' ? EMPTY_OPTION : value}
        onValueChange={(next) => onChange(next === EMPTY_OPTION ? '' : next, false)}
        onBlur={onBlur}
        disabled={disabled}
      />
    );
  }

  if (type === 'datetime') {
    return (
      <DateTimeInput
        className={className}
        label={label}
        tooltip={tooltip}
        error={error}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    );
  }

  const number = type === 'integer' || type === 'decimal';
  return (
    <TextField
      className={className}
      label={label}
      tooltip={tooltip}
      error={error ?? undefined}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={number ? (type === 'integer' ? 'numeric' : 'decimal') : undefined}
      autoComplete="off"
      spellCheck={number ? false : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value, event.target.validity.badInput)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      disabled={disabled}
    />
  );
}

/**
 * Date and time (`datetime-local`, with seconds), with the design-system field look (estilos.md §7.2). The design system's
 * `TextField` has no date-and-time type, so the field is put together from its `Label` and `FieldMessage`.
 */
function DateTimeInput({ className, label, tooltip, error, value, onChange, onBlur, onKeyDown, disabled }: Omit<ValueInputProps, 'type'>) {
  const id = useId();
  const tooltipId = tooltip ? `${id}-tip` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, tooltipId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['fc-field', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="datetime-local"
        step={1}
        className="fc-field-input"
        value={value}
        onChange={(event) => onChange(event.target.value, event.target.validity.badInput)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-invalid={errorId ? true : undefined}
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
}
