import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { FieldMessage, Select, Text, TextField, textClasses, type SelectOption } from '../../design-system';
import { useDraftEditor, type WorkflowProblem } from '../draft';
import type { ErrorPolicy, RoundingMode } from './definition';
import { InfoIcon } from './icons';
import {
  ERROR_POLICY_LABELS,
  ERROR_POLICY_OPTIONS,
  INHERIT_LABEL,
  INHERIT_VALUE,
  NOT_SAVED_NOTE,
  READ_ONLY_REASON,
  ROUNDING_MODE_LABELS,
  ROUNDING_MODE_OPTIONS,
} from './labels';
import { problemText } from './problemPaths';
import './properties.css';

interface PropertiesContextValue {
  readOnly: boolean;
  /** The id of the read-only reason, for the `aria-describedby` of each disabled field. */
  reasonId: string | undefined;
}

const PropertiesContext = createContext<PropertiesContextValue>({ readOnly: false, reasonId: undefined });

/** Whether the fields are disabled and the reason they point to. */
export function useFieldsState(): PropertiesContextValue {
  return useContext(PropertiesContext);
}

export type PropertiesCategory = 'calc' | 'decision' | 'output' | 'source';

export interface PropertiesFrameProps {
  /** A noun: "Cálculo", "Entradas", "Saída", "Workflow". */
  title: string;
  /** The 8px square of the block category (estilos §2.4), beside the title. */
  category?: PropertiesCategory;
  /** A second line under the title (the block id, in mono). */
  subtitle?: ReactNode;
  /** The item's action, on the right of the title ("Incluir entrada"). */
  action?: ReactNode;
  /** The item's problems that match no field on screen. */
  problems?: readonly WorkflowProblem[];
  children: ReactNode;
}

/**
 * The frame of a properties form: title, the read-only reason (E4-20: "Você não tem permissão para editar este
 * workflow", linked to every field by `aria-describedby`) and the item's problems that have no field of their own.
 */
export function PropertiesFrame({ title, category, subtitle, action, problems = [], children }: PropertiesFrameProps) {
  const { readOnly } = useDraftEditor();
  const reasonId = `fc-properties-reason-${useId()}`;
  const titleId = `fc-properties-title-${useId()}`;
  return (
    <PropertiesContext.Provider value={{ readOnly, reasonId: readOnly ? reasonId : undefined }}>
      <section className="fc-properties" aria-labelledby={titleId}>
        <header className="fc-properties-header">
          <div className="fc-properties-heading">
            <Text as="h2" variant="heading-14" id={titleId} className="fc-properties-title">
              {category ? <span className={`fc-properties-square fc-properties-square-${category}`} aria-hidden="true" /> : null}
              {title}
            </Text>
            {subtitle ? <div className="fc-properties-subtitle">{subtitle}</div> : null}
          </div>
          {action}
        </header>
        {readOnly ? (
          <p id={reasonId} className={`fc-properties-reason ${textClasses({ variant: 'label-12', emphasis: 'tertiary' })}`}>
            <InfoIcon size={12} />
            <span>{READ_ONLY_REASON}</span>
          </p>
        ) : null}
        {problems.length > 0 ? (
          <ul className="fc-properties-problems" aria-label="Problemas">
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${problem.path ?? ''}-${index}`}>
                <FieldMessage type="error">{problem.message}</FieldMessage>
              </li>
            ))}
          </ul>
        ) : null}
        {children}
      </section>
    </PropertiesContext.Provider>
  );
}

/** The selections that already moved the focus: each selection focuses its field once (see `useFocusOnSelection`). */
const focusedSelections = new WeakSet<object>();

/**
 * Brings the field into view and focuses it when the selection points to it (`selection.field`, the `path` of a problem
 * clicked in the Problems tab). Each new selection focuses once, even of the same field: a field that mounts later (an
 * item included or moved) or whose path changes (a new analysis) does not take the focus again with the same selection.
 */
export function useFocusOnSelection(path: string | null, element: () => HTMLElement | null | undefined) {
  const { selection } = useDraftEditor();
  const target = useRef(element);
  target.current = element;
  useEffect(() => {
    if (path === null || selection.field !== path || focusedSelections.has(selection)) return;
    const found = target.current();
    if (!found) return;
    focusedSelections.add(selection);
    found.scrollIntoView?.({ block: 'nearest' });
    found.focus({ preventScroll: true });
  }, [selection, path]);
}

function describedBy(...ids: (string | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}

export interface CommitTextFieldProps {
  label: string;
  /** The value in the definition. */
  value: string;
  /** Called with each valid text (an invalid one stays only in the field, with the error, and is not saved). */
  onCommit: (text: string) => void;
  /** Why the text cannot go to the definition, or `null`. */
  validate?: (text: string) => string | null;
  /**
   * A problem the text has that the analysis will also find (a duplicate name): shown right away, while there is no
   * problem from the analysis on the field, but the text still goes to the definition.
   */
  warn?: (text: string) => string | null;
  /** The field's `path` in the analysed definition: its problems and the focus from the Problems tab. */
  path: string | null;
  problems: readonly WorkflowProblem[];
  tooltip?: ReactNode;
  /** Variable names and formulas, in mono-13. */
  mono?: boolean;
  maxLength?: number;
  inputMode?: 'numeric' | 'text';
  className?: string;
}

/**
 * A text field bound to the definition. Each valid text goes to the draft as it is typed; a text the contract does not
 * accept (a name out of the rule, empty places) stays only in the field, with what to do, so the draft is never saved with
 * a shape error (`422 invalid_data`). Undo, redo and reload replace the text with the definition's.
 */
export function CommitTextField({
  label,
  value,
  onCommit,
  validate,
  warn,
  path,
  problems,
  tooltip,
  mono = false,
  maxLength,
  inputMode,
  className,
}: CommitTextFieldProps) {
  const { readOnly, reasonId } = useFieldsState();
  const [shown, setShown] = useState({ text: value, from: value });
  if (shown.from !== value) setShown({ text: value, from: value });
  const input = useRef<HTMLInputElement>(null);
  useFocusOnSelection(path, () => input.current);

  const invalid = validate?.(shown.text) ?? null;
  const error = invalid ? `${invalid} ${NOT_SAVED_NOTE}` : (problemText(problems) ?? warn?.(shown.text) ?? undefined);

  return (
    <TextField
      ref={input}
      label={label}
      value={shown.text}
      maxLength={maxLength}
      inputMode={inputMode}
      spellCheck={mono ? false : undefined}
      autoComplete="off"
      tooltip={tooltip}
      error={error}
      disabled={readOnly}
      aria-describedby={reasonId}
      className={[mono ? 'fc-properties-mono' : null, className].filter(Boolean).join(' ') || undefined}
      onChange={(event) => {
        const text = event.target.value;
        setShown((current) => ({ ...current, text }));
        if (!validate?.(text)) onCommit(text);
      }}
    />
  );
}

export interface PathSelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  path: string | null;
  problems: readonly WorkflowProblem[];
  tooltip?: ReactNode;
  placeholder?: string;
  className?: string;
}

/** A select bound to the definition, with its problems and the focus from the Problems tab. */
export function PathSelect({ label, value, options, onChange, path, problems, tooltip, placeholder, className }: PathSelectProps) {
  const { readOnly, reasonId } = useFieldsState();
  const trigger = useRef<HTMLButtonElement>(null);
  useFocusOnSelection(path, () => trigger.current);
  return (
    <Select
      ref={trigger}
      label={label}
      value={value}
      options={options}
      placeholder={placeholder}
      tooltip={tooltip}
      error={problemText(problems)}
      disabled={readOnly}
      aria-describedby={reasonId}
      className={className}
      onValueChange={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}

/** Places of a `decimal`: an integer from 0 to 18 (E4-4). */
export function parseScale(text: string): number | null {
  if (!/^\d{1,2}$/.test(text)) return null;
  const scale = Number(text);
  return scale <= 18 ? scale : null;
}

interface PolicyFieldProps<T extends string> {
  /** `null` is "Herdar do workflow" (only where `inherited` is given). */
  value: T | null;
  onChange: (value: T | null) => void;
  /** The workflow's value: with it, the select offers "Herdar do workflow" and says what is inherited. */
  inherited?: T;
  path: string | null;
  problems: readonly WorkflowProblem[];
}

function policyField<T extends string>(label: string, labels: Readonly<Record<T, string>>, options: readonly SelectOption[]) {
  return function PolicyField({ value, onChange, inherited, path, problems }: PolicyFieldProps<T>) {
    const withInherit = inherited !== undefined;
    const all = withInherit ? [{ value: INHERIT_VALUE, label: INHERIT_LABEL }, ...options] : options;
    return (
      <PathSelect
        label={label}
        value={value ?? INHERIT_VALUE}
        options={all}
        path={path}
        problems={problems}
        tooltip={withInherit && value === null ? `O workflow usa: ${labels[inherited]}` : undefined}
        onChange={(next) => onChange(next === INHERIT_VALUE ? null : (next as T))}
      />
    );
  };
}

/** Modo de arredondamento ("Meio para cima", "Meio para o par", "Cortar"), with "Herdar do workflow" in the blocks. */
export const RoundingModeField = policyField<RoundingMode>('Modo de arredondamento', ROUNDING_MODE_LABELS, ROUNDING_MODE_OPTIONS);
/** Política de erro ("Gerar erro", "Deixar vazio com aviso", "Usar valor padrão"), with "Herdar do workflow" in the blocks. */
export const ErrorPolicyField = policyField<ErrorPolicy>('Política de erro', ERROR_POLICY_LABELS, ERROR_POLICY_OPTIONS);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Visible label above the control; it names the radio group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The control's `path` in the analysed definition: its problems and the focus from the Problems tab. */
  path?: string | null;
  problems?: readonly WorkflowProblem[];
  className?: string;
}

/**
 * Segmented control (estilos §7.2; "Linear | Múltiplo"): a radio group. Tab enters on the chosen option; the arrows (and
 * Home and End) move and choose, as in the WAI-ARIA radio group.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  path = null,
  problems = [],
  className,
}: SegmentedControlProps<T>) {
  const { readOnly, reasonId } = useFieldsState();
  const labelId = `fc-segmented-${useId()}`;
  const errorId = `fc-segmented-error-${useId()}`;
  const error = problemText(problems);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  useFocusOnSelection(path, () => buttons.current.get(value));

  function choose(next: T) {
    buttons.current.get(next)?.focus();
    if (next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let target: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = index === 0 ? last : index - 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = last;
    if (target === null) return;
    event.preventDefault();
    choose(options[target]!.value);
  }

  return (
    <div className={['fc-field', className].filter(Boolean).join(' ')}>
      <span id={labelId} className={`fc-label ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy(error ? errorId : undefined, reasonId)}
        aria-invalid={error ? true : undefined}
        className="fc-segmented"
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(element) => {
                if (element) buttons.current.set(option.value, element);
                else buttons.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={readOnly}
              className="fc-segmented-option"
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </div>
  );
}
