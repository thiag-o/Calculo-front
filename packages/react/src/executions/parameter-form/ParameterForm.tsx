import { useId, useState } from 'react';
import { Button, Checkbox, FieldMessage, Select, Text, TextField, textClasses } from '../../design-system';
import { AllowedValuesField } from './AllowedValuesField';
import { displayApiText, literalToApiText } from './literals';
import { RELATIVE_LABELS, fieldHelp, relativesFor } from './labels';
import { TagsField } from './TagsField';
import {
  allowedList,
  allowedQuery,
  fieldState,
  isScheduleRelative,
  periodWarning,
  readParameter,
  scalarType,
  scheduleFieldState,
  type ParameterErrors,
  type ParameterFieldState,
  type ParameterFormValues,
  type RelativeDefault,
  type WorkflowParameter,
} from './values';
import { ValueInput } from './ValueInput';
import './parameter-form.css';

/** The select needs a non-empty value for "no choice". */
const NONE_OPTION = 'none';

/**
 * - `run` (default): the values of one run (trigger, preview, "Calcular", simulation). A relative default is shown by its
 *   label, with "Trocar por um valor fixo";
 * - `schedule`: the values of a schedule (E7-24). A parameter whose type has relatives (date, date and time, period; never a
 *   list) is "Fixo" or "Relativo"; the relative is resolved at each trigger.
 */
export type ParameterFormMode = 'run' | 'schedule';

export interface ParameterFormProps {
  /** The workflow: the values of a parameter with a query (`allowed_values`) are read from its saved draft. */
  workflowId: string;
  /** The declaration of the workflow (`definition.parameters`). */
  parameters: readonly WorkflowParameter[];
  /** What is typed, by parameter name. Start with `{}`: every parameter starts as its declaration says. */
  values: ParameterFormValues;
  onChange: (values: ParameterFormValues) => void;
  /** The errors by parameter name: the back's `missing_parameter` and `invalid_parameter`, and the ones of the reading. */
  errors?: ParameterErrors;
  /** Default `run`. Comes with the controller (`useParameterForm` or `useScheduleParameterForm`). */
  mode?: ParameterFormMode;
  disabled?: boolean;
}

/**
 * The form of the parameters of a run, generated from the declaration (E6-17, E6-19): a field by type, number and date in
 * the pattern of the user (E4-24), the period as two dates, the closed list as a multiple choice or a select, the query as
 * a search over the values read from the API (E7-23), the free list as tags, and the relative default shown by its label
 * (the execution resolves it) with "Trocar por um valor fixo". In the schedule mode, Fixo | Relativo (E7-24). Controlled:
 * use it with `useParameterForm` or `useScheduleParameterForm`. The caller puts it inside its own `<form>` or dialog.
 */
export function ParameterForm({ workflowId, parameters, values, onChange, errors = {}, mode = 'run', disabled = false }: ParameterFormProps) {
  if (parameters.length === 0) return null;
  const Field = mode === 'schedule' ? ScheduleParameterField : RunParameterField;
  return (
    <div className="fc-parameter-form" role="group" aria-label="Parâmetros">
      {parameters.map((parameter) => (
        <Field
          key={parameter.name}
          workflowId={workflowId}
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
  workflowId: string;
  parameter: WorkflowParameter;
  state: ParameterFieldState;
  error: string | undefined;
  disabled: boolean;
  onChange: (state: ParameterFieldState) => void;
}

function relativeLabel(parameter: WorkflowParameter): string | null {
  return parameter.default?.kind === 'relative' ? RELATIVE_LABELS[parameter.default.value] : null;
}

/** The error on screen: the one given (the back's or the reading's) or, once the field was left, the one of what is typed. */
function useShownError(parameter: WorkflowParameter, state: ParameterFieldState, error: string | undefined) {
  const [touched, setTouched] = useState(false);
  const shown = error ?? (touched ? (readParameter(parameter, state).error ?? undefined) : undefined);
  return { shown, markTouched: () => setTouched(true), resetTouched: () => setTouched(false) };
}

function RunParameterField({ workflowId, parameter, state, error, disabled, onChange }: ParameterFieldProps) {
  const { shown, markTouched } = useShownError(parameter, state, error);
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

  return (
    <div className="fc-parameter-field">
      <ValueField
        workflowId={workflowId}
        parameter={parameter}
        help={help}
        state={state}
        error={shown}
        disabled={disabled}
        onChange={onChange}
        onBlur={markTouched}
      />
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

/** A parameter of a schedule: Fixo | Relativo when its type has relatives, otherwise just its field. */
function ScheduleParameterField({ workflowId, parameter, state, error, disabled, onChange }: ParameterFieldProps) {
  const fixed = scheduleFieldState(state);
  const { shown, markTouched, resetTouched } = useShownError(parameter, fixed, error);
  // The relative chosen before going to Fixo: coming back to Relativo gives it back, not the first one.
  const [lastRelative, setLastRelative] = useState<RelativeDefault | null>(null);
  const relatives = relativesFor(parameter);
  const help = fieldHelp(parameter);
  const valueField = (
    <ValueField
      workflowId={workflowId}
      parameter={parameter}
      help={help}
      state={fixed}
      error={shown}
      disabled={disabled}
      onChange={onChange}
      onBlur={markTouched}
    />
  );
  if (relatives.length === 0) return <div className="fc-parameter-field">{valueField}</div>;

  const relativeOn = isScheduleRelative(parameter, state);
  const declared = parameter.default?.kind === 'relative' ? parameter.default.value : null;
  const firstRelative: RelativeDefault | undefined = declared !== null && relatives.includes(declared) ? declared : relatives[0];
  const remembered = lastRelative !== null && relatives.includes(lastRelative) ? lastRelative : null;
  return (
    <div className="fc-parameter-field">
      <ValueKind
        name={parameter.name}
        relative={relativeOn}
        disabled={disabled}
        onChange={(toRelative) => {
          // Each side starts clean: the error of a Fixo left behind does not come back with it.
          resetTouched();
          if (!toRelative) setLastRelative(state.relative);
          onChange({ ...fixed, relative: toRelative ? (remembered ?? firstRelative ?? null) : null });
        }}
      />
      {relativeOn ? (
        <Select
          label={parameter.name}
          tooltip={help}
          error={error}
          disabled={disabled}
          options={relatives.map((value) => ({ value, label: RELATIVE_LABELS[value] }))}
          value={state.relative ?? undefined}
          onValueChange={(next) => onChange({ ...fixed, relative: relatives.find((value) => value === next) ?? null })}
        />
      ) : (
        valueField
      )}
    </div>
  );
}

interface ValueKindProps {
  name: string;
  relative: boolean;
  disabled: boolean;
  onChange: (relative: boolean) => void;
}

const VALUE_KINDS = [
  { relative: false, label: 'Fixo' },
  { relative: true, label: 'Relativo' },
] as const;

/** Fixo | Relativo, a segmented control (estilos.md §7.2) made of native radios: the arrows move between the two. */
function ValueKind({ name, relative, disabled, onChange }: ValueKindProps) {
  const group = useId();
  return (
    <div className="fc-parameter-kind" role="radiogroup" aria-label={`Valor de ${name}`}>
      {VALUE_KINDS.map((option) => {
        const checked = option.relative === relative;
        return (
          <label
            key={option.label}
            className={`fc-parameter-kind-option ${textClasses({ variant: 'label-13' })}`}
            data-checked={checked || undefined}
            data-disabled={disabled || undefined}
          >
            <input
              type="radio"
              className="fc-parameter-kind-radio"
              name={group}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.relative)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

interface ValueFieldProps {
  workflowId: string;
  parameter: WorkflowParameter;
  help: string;
  state: ParameterFieldState;
  error: string | undefined;
  disabled: boolean;
  onChange: (state: ParameterFieldState) => void;
  onBlur: () => void;
}

/** The field of a value, by what the declaration says: period, query, closed list, free list or one value of the type. */
function ValueField({ workflowId, parameter, help, state, error, disabled, onChange, onBlur }: ValueFieldProps) {
  const patch = (next: Partial<ParameterFieldState>) => onChange({ ...state, ...next });

  if (parameter.type === 'period') {
    return (
      <PeriodField name={parameter.name} help={help} state={state} error={error} disabled={disabled} onChange={patch} onBlur={onBlur} />
    );
  }
  if (allowedQuery(parameter) !== null) {
    return (
      <AllowedValuesField
        workflowId={workflowId}
        name={parameter.name}
        type={scalarType(parameter)}
        help={help}
        multiple={parameter.list}
        selected={parameter.list ? state.items : state.text === '' ? [] : [state.text]}
        error={error}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(selected) => patch(parameter.list ? { items: selected } : { text: selected[0] ?? '' })}
      />
    );
  }
  if (parameter.list && allowedList(parameter) !== null) {
    return (
      <ChoiceList
        parameter={parameter}
        help={help}
        selected={state.items}
        error={error}
        disabled={disabled}
        onChange={(items) => patch({ items })}
      />
    );
  }
  if (parameter.list) {
    return (
      <TagsField
        name={parameter.name}
        type={scalarType(parameter)}
        scale={parameter.scale}
        help={help}
        items={state.items}
        error={error}
        disabled={disabled}
        onChange={(items) => patch({ items })}
      />
    );
  }
  if (allowedList(parameter) !== null) {
    return (
      <ChoiceSelect parameter={parameter} help={help} value={state.text} error={error} disabled={disabled} onChange={(text) => patch({ text })} />
    );
  }
  return (
    <ValueInput
      label={parameter.name}
      tooltip={help}
      type={scalarType(parameter)}
      value={state.text}
      onChange={(text, badInput) => patch({ text, incomplete: badInput ? ['text'] : [] })}
      onBlur={onBlur}
      error={error}
      disabled={disabled}
    />
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
      <Text variant="mono-13" className="fc-parameter-name">
        {name}
      </Text>
      <div className="fc-parameter-relative-row">
        <span className={`fc-parameter-relative-value ${textClasses({ variant: 'label-14' })}`}>{label}</span>
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
      <legend className={`fc-parameter-name ${textClasses({ variant: 'mono-13' })}`}>{name}</legend>
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
        <p role="status" className={`fc-parameter-warning ${textClasses({ variant: 'label-12' })}`}>
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

/** The closed list of allowed values as options: the API text to send and the text to show. */
function allowedOptions(parameter: WorkflowParameter): { value: string; label: string }[] {
  const type = scalarType(parameter);
  return (allowedList(parameter) ?? []).flatMap((literal) => {
    const value = literalToApiText(literal, type);
    return value === null ? [] : [{ value, label: displayApiText(value, type) }];
  });
}

/** A list parameter with a closed list of `allowed_values`: a multiple choice among them. */
function ChoiceList({ parameter, help, selected, error, disabled, onChange }: ChoiceProps & { selected: readonly string[]; onChange: (items: string[]) => void }) {
  const options = allowedOptions(parameter);
  return (
    <fieldset className="fc-parameter-choices" disabled={disabled}>
      <legend className={`fc-parameter-name ${textClasses({ variant: 'mono-13' })}`}>{parameter.name}</legend>
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

/** A scalar parameter with a closed list of `allowed_values`: one choice among them. */
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
