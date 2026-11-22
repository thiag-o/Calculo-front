import { useId, useMemo, useRef, useState } from 'react';
import { Text, TextField } from '../../../design-system';
import { SuggestionList, suggestionId, useSuggestionKeys, type ParameterReference } from '../../../formula';
import { useDraftEditor, type WorkflowProblem } from '../../draft';
import { problemText, useFieldsState, useFocusOnSelection } from '../../properties';
import { fitsDatePicker, fromLiteral, isParameter, toLiteral, type DataType, type FilterOperator } from './filterRules';
import { ParameterButton } from './ParameterButton';
import { parameterHint, servingReferences } from './parameterHints';
import { scopedName } from './paths';

/** The note of a field whose text does not go to the draft (ADR 0046), the same as the properties'. */
export const NOT_SAVED_NOTE = 'Enquanto o campo tiver erro, a mudança não é salva.';

export interface LiteralFieldProps {
  label: string;
  /** The item the field belongs to: part of the accessible name ("Valor (filtro 1)"). */
  scope?: string;
  type: DataType;
  /** The places of a `decimal` (a value with more is refused, never rounded). */
  scale: number | null;
  /** The filter operator: a list parameter only serves `in`. */
  operator: FilterOperator;
  /** The literal in the definition (`"A"`, `1500.00`, `DATA(2026, 10, 1)`, `@periodo.inicio`). */
  literal: string;
  /** Called with each literal that can be written (a text that cannot stays only in the field, with the error). */
  onCommit: (literal: string) => void;
  /** A parameter picked from the list or from "Usar parâmetro". Default: commits its text. */
  onPickParameter?: (reference: ParameterReference) => void;
  path: string | null;
  problems: readonly WorkflowProblem[];
}

/**
 * A value of a filter, typed as people write it: text without quotes, a number in the Brazilian pattern (`1.500,50`), a
 * date in the date picker. It goes to the draft as a literal of the formula language (E4-3); a number badly written stays
 * only in the field, with what to do (ADR 0046).
 *
 * A value starting with `@` is a run parameter (E6-18) and goes as typed: typing `@` opens the list of the draft's
 * parameters that serve the variable's type and the operator, and a help below says when a typed one would not serve,
 * without blocking (the analysis decides, D35). The date picker has "Usar parâmetro" beside it, since `@` cannot be typed
 * there; clearing the parameter brings the date picker back.
 */
export function LiteralField({ label, scope, type, scale, operator, literal, onCommit, onPickParameter, path, problems }: LiteralFieldProps) {
  const { readOnly, reasonId } = useFieldsState();
  const { definition } = useDraftEditor();
  const parameters = definition.parameters;
  const serving = useMemo(() => servingReferences(parameters, type, operator), [parameters, type, operator]);
  // The text on screen follows the definition (undo, redo, reload, another field take back a text never committed). A text
  // that already gives the literal stays as typed: `1500` is not rewritten as `1.500` while it is typed.
  const [shown, setShown] = useState({ text: fromLiteral(type, literal), from: literal, type, definition });
  if (shown.from !== literal || shown.type !== type || shown.definition !== definition) {
    const typed = toLiteral(type, scale, shown.text);
    const keep = shown.type === type && typed.ok && typed.value === literal;
    setShown({ text: keep ? shown.text : fromLiteral(type, literal), from: literal, type, definition });
  }
  const input = useRef<HTMLInputElement>(null);
  useFocusOnSelection(path, () => input.current);
  const [focused, setFocused] = useState(false);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const listId = `fc-filters-parameters-${useId()}`;
  const hintId = `fc-filters-parameter-hint-${useId()}`;

  const reading = toLiteral(type, scale, shown.text);
  const error = reading.ok ? problemText(problems) : `${reading.message} ${NOT_SAVED_NOTE}`;
  const parameter = isParameter(shown.text);
  const datePicker = type === 'date' && !parameter && fitsDatePicker(literal);
  const numeric = type === 'integer' || type === 'decimal';

  // The list: the parameters that serve and start with what was typed (without case), while the field has the focus.
  const typed = shown.text.trim().toLowerCase();
  const items =
    focused && parameter && !readOnly && closedFor !== shown.text
      ? serving.filter((reference) => reference.text.toLowerCase().startsWith(typed) && reference.text.toLowerCase() !== typed)
      : [];
  const open = items.length > 0;
  // The help waits for the reference to be written (no list open) and gives way to an error of the field.
  const hint = parameter && !open && !error ? parameterHint(shown.text, parameters, type, operator) : null;

  function pick(reference: ParameterReference) {
    setShown((current) => ({ ...current, text: reference.text }));
    if (onPickParameter) onPickParameter(reference);
    else if (reference.text !== literal) onCommit(reference.text);
  }

  const keys = useSuggestionKeys(
    shown.text,
    items.length,
    (index) => pick(items[index]!),
    () => setClosedFor(shown.text),
  );
  const describedBy = [hint ? hintId : null, reasonId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="fc-filters-value">
      <div className="fc-filters-value-row">
        <div className="fc-filters-value-field">
          <TextField
            ref={input}
            label={label}
            aria-label={scope ? scopedName(label, scope) : undefined}
            type={datePicker ? 'date' : 'text'}
            value={shown.text}
            inputMode={numeric && !parameter ? 'decimal' : undefined}
            maxLength={10000}
            spellCheck={false}
            autoComplete="off"
            error={error}
            disabled={readOnly}
            aria-describedby={describedBy}
            aria-autocomplete={!datePicker && parameters.length > 0 && !readOnly ? 'list' : undefined}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && keys.active >= 0 ? suggestionId(listId, keys.active) : undefined}
            className={numeric || type === 'datetime' || parameter ? 'fc-filters-mono' : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (open) keys.onKeyDown(event);
            }}
            onChange={(event) => {
              const text = event.target.value;
              setShown((current) => ({ ...current, text }));
              const next = toLiteral(type, scale, text);
              if (next.ok && next.value !== literal) onCommit(next.value);
            }}
          />
          {open ? (
            <SuggestionList
              id={listId}
              label={scopedName('Parâmetros', scope ? `${label}, ${scope}` : label)}
              items={items.map((reference) => ({ key: reference.text, label: reference.text, detail: reference.typeLabel }))}
              active={keys.active}
              onPick={(index) => pick(items[index]!)}
              onActivate={keys.setActive}
            />
          ) : null}
        </div>
        {type === 'date' || type === 'boolean' ? (
          <ParameterButton fieldLabel={label} scope={scope} references={serving} hasParameters={parameters.length > 0} onPick={pick} />
        ) : null}
      </div>
      {hint ? (
        <Text as="p" id={hintId} variant="label-12" emphasis="secondary" className="fc-filters-parameter-hint">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
