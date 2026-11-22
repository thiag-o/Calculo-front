import { useState } from 'react';
import { Button, Checkbox, FieldMessage, Select, Text, TextField } from '../../design-system';
import { displayApiText, literalToApiText } from './literals';
import { RELATIVE_LABELS, fieldHelp } from './labels';
import { TagsField } from './TagsField';
import {
  fieldState,
  hasAllowedValues,
  periodWarning,
  readParameter,
  scalarType,
  type ParameterErrors,
  type ParameterFieldState,
  type ParameterFormValues,
  type WorkflowParameter,
} from './values';
import { ValueInput } from './ValueInput';
import './parameter-form.css';

/** The select needs a non-empty value for "no choice". */
const NONE_OPTION = 'none';

export interface ParameterFormProps {
  /** The declaration of the workflow (`definition.parameters`). */
  parameters: readonly WorkflowParameter[];
  /** What is typed, by parameter name. Start with `{}`: every parameter starts as its declaration says. */
  values: ParameterFormValues;
  onChange: (values: ParameterFormValues) => void;
  /** The errors by parameter name: the back's `missing_parameter` and `invalid_parameter`, and the ones of `readParameters`. */
  errors?: ParameterErrors;
  disabled?: boolean;
}

/**
 * The form of the parameters of a run, generated from the declaration (E6-17, E6-19): a field by type, number and date in
 * the pattern of the user (E4-24), the period as two dates, the list as a multiple choice or as tags, and the relative
 * default shown by its label (the execution resolves it) with "Trocar por um valor fixo". Controlled: use it with
 * `useParameterForm`. The caller puts it inside its own `<form>` or dialog.
 */
export function ParameterForm({ parameters, values, onChange, errors = {}, disabled = false }: ParameterFormProps) {
  if (parameters.length === 0) return null;
  return (
    <div className="fc-parameter-form" role="group" aria-label="Parâmetros">
      {parameters.map((parameter) => (
        <ParameterField
          key={parameter.name}
          parameter={parameter}
          state={fieldState(values, parameter)}
          error={errors[parameter.name]}
          disabled={disabled}
          onChange={(next) => onChange({ ...values, [parameter.name]: next })}
        />
      ))}
    </div>
  );
}

interface ParameterFieldProps {
  parameter: WorkflowParameter;
  state: ParameterFieldState;
  error: string | undefined;
  disabled: boolean;
  onChange: (state: ParameterFieldState) => void;
}

function relativeLabel(parameter: WorkflowParameter): string | null {
  return parameter.default?.kind === 'relative' ? RELATIVE_LABELS[parameter.default.value] : null;
}

function ParameterField({ parameter, state, error, disabled, onChange }: ParameterFieldProps) {
  const [touched, setTouched] = useState(false);
  const relative = relativeLabel(parameter);
  const help = fieldHelp(parameter);

  if (state.usingDefault && relative !== null) {
    return (
      <div className="fc-parameter-field">
        <RelativeDefault
          name={parameter.name}
          label={relative}
          help={help}
          error={error}
          disabled={disabled}
          onReplace={() => onChange({ ...state, usingDefault: false })}
        />
      </div>
    );
  }

  const shownError = error ?? (touched ? readParameter(parameter, state).error ?? undefined : undefined);
  const patch = (next: Partial<ParameterFieldState>) => onChange({ ...state, ...next });
  const markTouched = () => setTouched(true);

  let field;
  if (parameter.type === 'period') {
    field = (
      <PeriodField
        name={parameter.name}
        help={help}
        state={state}
        error={shownError}
        disabled={disabled}
        onChange={(next) => patch(next)}
        onBlur={markTouched}
      />
    );
  } else if (parameter.list && hasAllowedValues(parameter)) {
    field = (
      <ChoiceList
        parameter={parameter}
        help={help}
        selected={state.items}
        error={shownError}
        disabled={disabled}
        onChange={(items) => patch({ items })}
      />
    );
  } else if (parameter.list) {
    field = (
      <TagsField
        name={parameter.name}
        type={scalarType(parameter)}
        scale={parameter.scale}
        help={help}
        items={state.items}
        error={shownError}
        disabled={disabled}
        onChange={(items) => patch({ items })}
      />
    );
  } else if (hasAllowedValues(parameter)) {
    field = (
      <ChoiceSelect
        parameter={parameter}
        help={help}
        value={state.text}
        error={shownError}
        disabled={disabled}
        onChange={(text) => patch({ text })}
      />
    );
  } else {
    field = (
      <ValueInput
        label={parameter.name}
        tooltip={help}
        type={scalarType(parameter)}
        value={state.text}
        onChange={(text, badInput) => patch({ text, incomplete: badInput ? ['text'] : [] })}
        onBlur={markTouched}
        error={shownError}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="fc-parameter-field">
      {field}
      {relative !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="fc-parameter-back"
          disabledReason={disabled ? 'O formulário está desabilitado' : undefined}
          onClick={() => onChange({ ...state, usingDefault: true })}
        >
          {`Voltar ao padrão (${relative})`}
        </Button>
      ) : null}
    </div>
  );
}

interface RelativeDefaultProps {
  name: string;
  label: string;
  help: string;
  error: string | undefined;
  disabled: boolean;
  onReplace: () => void;
}

/** The relative default is not a date yet: it is shown by its label, and "Trocar por um valor fixo" opens the field. */
function RelativeDefault({ name, label, help, error, disabled, onReplace }: RelativeDefaultProps) {
  return (
    <div className="fc-parameter-relative" role="group" aria-label={name}>
      <Text variant="label-14" className="fc-parameter-name">
        {name}
      </Text>
      <div className="fc-parameter-relative-row">
        <span className="fc-parameter-relative-value">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="small"
          disabledReason={disabled ? 'O formulário está desabilitado' : undefined}
          onClick={onReplace}
        >
          Trocar por um valor fixo
        </Button>
      </div>
      <FieldMessage type="tooltip">{help}</FieldMessage>
      {error ? <FieldMessage type="error">{error}</FieldMessage> : null}
    </div>
  );
}

interface PeriodFieldProps {
  name: string;
  help: string;
  state: ParameterFieldState;
  error: string | undefined;
  disabled: boolean;
  onChange: (patch: Partial<ParameterFieldState>) => void;
  onBlur: () => void;
}

/** A period: two dates, both included. A start after the end is only a warning here; the back refuses it in the field. */
function PeriodField({ name, help, state, error, disabled, onChange, onBlur }: PeriodFieldProps) {
  const warning = periodWarning(state);
  const flag = (part: 'start' | 'end', bad: boolean) => {
    const others = state.incomplete.filter((other) => other !== part);
    return bad ? [...others, part] : others;
  };
  return (
    <fieldset className="fc-parameter-period" disabled={disabled}>
      <legend className="fc-parameter-name">{name}</legend>
      <div className="fc-parameter-period-dates">
        <TextField
          type="date"
          label="Início"
          value={state.start}
          onChange={(event) => onChange({ start: event.target.value, incomplete: flag('start', event.target.validity.badInput) })}
          onBlur={onBlur}
        />
        <TextField
          type="date"
          label="Fim"
          value={state.end}
          onChange={(event) => onChange({ end: event.target.value, incomplete: flag('end', event.target.validity.badInput) })}
          onBlur={onBlur}
        />
      </div>
      <FieldMessage type="tooltip">{help}</FieldMessage>
      {warning && !error ? (
        <p role="status" className="fc-parameter-warning">
          {warning}
        </p>
      ) : null}
      {error ? <FieldMessage type="error">{error}</FieldMessage> : null}
    </fieldset>
  );
}

interface ChoiceProps {
  parameter: WorkflowParameter;
  help: string;
  error: string | undefined;
  disabled: boolean;
}

/** The allowed values as options: the API text to send and the text to show. */
function allowedOptions(parameter: WorkflowParameter): { value: string; label: string }[] {
  const type = scalarType(parameter);
  return (parameter.allowed_values ?? []).flatMap((literal) => {
    const value = literalToApiText(literal, type);
    return value === null ? [] : [{ value, label: displayApiText(value, type) }];
  });
}

/** A list parameter with `allowed_values`: a multiple choice among them. */
function ChoiceList({ parameter, help, selected, error, disabled, onChange }: ChoiceProps & { selected: readonly string[]; onChange: (items: string[]) => void }) {
  const options = allowedOptions(parameter);
  return (
    <fieldset className="fc-parameter-choices" disabled={disabled}>
      <legend className="fc-parameter-name">{parameter.name}</legend>
      <div className="fc-parameter-choice-list">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            disabled={disabled}
            onCheckedChange={(checked) => {
              // The order of the declaration, whatever the order of the clicks.
              const chosen = new Set(selected);
              if (checked === true) chosen.add(option.value);
              else chosen.delete(option.value);
              onChange(options.map((other) => other.value).filter((value) => chosen.has(value)));
            }}
          />
        ))}
      </div>
      <FieldMessage type="tooltip">{help}</FieldMessage>
      {error ? <FieldMessage type="error">{error}</FieldMessage> : null}
    </fieldset>
  );
}

/** A scalar parameter with `allowed_values`: one choice among them. */
function ChoiceSelect({ parameter, help, value, error, disabled, onChange }: ChoiceProps & { value: string; onChange: (text: string) => void }) {
  const options = allowedOptions(parameter);
  return (
    <Select
      label={parameter.name}
      tooltip={help}
      error={error}
      disabled={disabled}
      options={parameter.required ? options : [{ value: NONE_OPTION, label: 'Nenhum' }, ...options]}
      value={value}
      onValueChange={(next) => onChange(next === NONE_OPTION ? '' : next)}
    />
  );
}
