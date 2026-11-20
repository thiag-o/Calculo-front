import { useId, type ReactNode } from 'react';
import { FieldMessage, Label, Select, TextField } from '../../design-system';
import type { DataType } from './values';

/** "Vazio", "Verdadeiro" and "Falso"; the select needs a non-empty value for the empty one. */
const EMPTY_OPTION = 'empty';
const BOOLEAN_OPTIONS = [
  { value: EMPTY_OPTION, label: 'Vazio' },
  { value: 'true', label: 'Verdadeiro' },
  { value: 'false', label: 'Falso' },
] as const;

/** The type in words, under the field or in the column header ("Número com 2 casas"). */
export function typeDescription(type: DataType, scale?: number | null): string {
  switch (type) {
    case 'integer':
      return 'Número inteiro';
    case 'decimal':
      return scale === 1 ? 'Número com 1 casa' : scale === undefined || scale === null ? 'Número' : `Número com ${scale} casas`;
    case 'date':
      return 'Data';
    case 'datetime':
      return 'Data e hora';
    case 'boolean':
      return 'Verdadeiro ou falso';
    default:
      return 'Texto';
  }
}

export interface ValueFieldProps {
  /** The id of the control, to focus the field with an error. */
  id: string;
  /** The input or field name. */
  label: string;
  /** Inside the items table: the column header names the field, so the label is only for the screen reader. */
  compact?: boolean;
  type: DataType;
  scale?: number | null;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * The field of one value, by type (E4-24): text; number in the Brazilian pattern (`1.500,00`); date and date and time
 * with the browser's own pickers; boolean as a select of "Vazio", "Verdadeiro" and "Falso". Empty is null.
 */
export function ValueField({ id, label, compact = false, type, scale, value, onChange, onBlur, error, disabled }: ValueFieldProps) {
  const shownLabel: ReactNode = compact ? <span className="fc-visually-hidden">{label}</span> : <span className="fc-unit-run-name">{label}</span>;
  const tooltip = compact ? undefined : typeDescription(type, scale);
  const className = compact ? 'fc-unit-run-field fc-unit-run-field-compact' : 'fc-unit-run-field';

  if (type === 'boolean') {
    return (
      <Select
        id={id}
        className={className}
        label={shownLabel}
        tooltip={tooltip}
        error={error ?? undefined}
        options={BOOLEAN_OPTIONS}
        value={value === '' ? EMPTY_OPTION : value}
        onValueChange={(next) => onChange(next === EMPTY_OPTION ? '' : next)}
        onBlur={onBlur}
        disabled={disabled}
      />
    );
  }

  if (type === 'datetime') {
    return (
      <DateTimeField
        id={id}
        className={className}
        label={shownLabel}
        tooltip={tooltip}
        error={error}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
      />
    );
  }

  const number = type === 'integer' || type === 'decimal';
  return (
    <TextField
      id={id}
      className={className}
      label={shownLabel}
      tooltip={tooltip}
      error={error ?? undefined}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={number ? (type === 'integer' ? 'numeric' : 'decimal') : undefined}
      autoComplete="off"
      spellCheck={number ? false : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
    />
  );
}

interface DateTimeFieldProps {
  id: string;
  className: string;
  label: ReactNode;
  tooltip?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

/**
 * Date and time (`datetime-local`, with seconds), with the design-system field look (estilos.md §7.2). The design
 * system's `TextField` has no date-and-time type, so the field is put together from its `Label` and `FieldMessage`.
 */
function DateTimeField({ id, className, label, tooltip, error, value, onChange, onBlur, disabled }: DateTimeFieldProps) {
  const messages = useId();
  const tooltipId = tooltip ? `${messages}-tip` : undefined;
  const errorId = error ? `${messages}-error` : undefined;
  const describedBy = [errorId, tooltipId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`fc-field ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="datetime-local"
        step={1}
        className="fc-field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
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
