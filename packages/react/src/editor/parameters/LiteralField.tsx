import { useRef, useState } from 'react';
import { TextField } from '../../design-system';
import { useDraftEditor, type WorkflowProblem } from '../draft';
import { PathSelect, problemText, useFieldsState, useFocusOnSelection } from '../properties';
import { BOOLEAN_LITERALS, fromLiteral, toLiteral, type ValueType } from './parameterRules';

/** The note of a field whose text does not go to the draft (ADR 0046), the same as the properties'. */
export const NOT_SAVED_NOTE = 'Enquanto o campo tiver erro, a mudança não é salva.';

/**
 * A date literal that the picker cannot show (`hoje`, `DATA(2026, 13, 1)`) stays in a text field: what to type there, and
 * that an empty field gives the calendar back.
 */
export const TEXT_DATE_HELP = 'Esta data não cabe no calendário. Digite-a como AAAA-MM-DD ou apague o campo para usar o calendário.';
const TEXT_DATE_RULE_MESSAGE = 'Digite a data como AAAA-MM-DD, por exemplo 2026-10-01.';

const BOOLEAN_OPTIONS = [
  { value: BOOLEAN_LITERALS.true, label: 'Verdadeiro' },
  { value: BOOLEAN_LITERALS.false, label: 'Falso' },
];

export interface LiteralFieldProps {
  label: string;
  /** The parameter the field belongs to: part of the accessible name ("Valor padrão (categoria)"). */
  scope: string;
  type: ValueType;
  /** The places of a `decimal` (a value with more is refused, never rounded). */
  scale: number | null;
  /** The literal in the definition (`"A"`, `1500.00`, `DATA(2026, 10, 1)`). */
  literal: string;
  /** Called with each literal that can be written (a text that cannot stays only in the field, with the error). */
  onCommit: (literal: string) => void;
  /** The field's `path` in the analysed definition: the focus from the Problems tab. */
  path: string | null;
  problems: readonly WorkflowProblem[];
}

function shownText(type: ValueType, literal: string): string {
  return fromLiteral(type, literal) ?? literal;
}

/**
 * One value of a parameter (its default, an item of its list or an allowed value), typed as people write it (D86): text
 * without quotes, a number in the Brazilian pattern (`1.500,50`), a date in the browser's picker, a boolean in a select.
 * It goes to the draft as a literal of the formula language; a value badly written stays only in the field, with what to
 * do (ADR 0046). A literal that does not fit the picker shows as it is, in a text field.
 */
export function LiteralField({ label, scope, type, scale, literal, onCommit, path, problems }: LiteralFieldProps) {
  const { readOnly, reasonId } = useFieldsState();
  const { definition } = useDraftEditor();
  // The text on screen follows the definition (undo, redo, reload, another field take back a text never committed). A text
  // that already gives the literal stays as typed: `1500` is not rewritten as `1.500` while it is typed.
  const [shown, setShown] = useState({ text: shownText(type, literal), from: literal, type, definition, typed: false });
  if (shown.from !== literal || shown.type !== type || shown.definition !== definition) {
    const typed = toLiteral(type, scale, shown.text);
    const keep = shown.type === type && typed.ok && typed.value === literal;
    setShown({ text: keep ? shown.text : shownText(type, literal), from: literal, type, definition, typed: keep && shown.typed });
  }
  const control = useRef<HTMLInputElement>(null);
  useFocusOnSelection(type === 'boolean' ? null : path, () => control.current);

  const name = `${label} (${scope})`;
  // A date the picker cannot show is typed as text; clearing it or typing a valid date gives the picker back.
  const textDate = type === 'date' && fromLiteral(type, literal) === null;
  const reading = toLiteral(type, scale, shown.text);
  const readingMessage = reading.ok ? '' : textDate ? TEXT_DATE_RULE_MESSAGE : reading.message;
  const error = shown.typed && !reading.ok ? `${readingMessage} ${NOT_SAVED_NOTE}` : problemText(problems);

  function onText(text: string) {
    setShown((current) => ({ ...current, text, typed: true }));
    const next = toLiteral(type, scale, text);
    if (next.ok && next.value !== literal) onCommit(next.value);
  }

  if (type === 'boolean') {
    return (
      <PathSelect
        label={label}
        scope={scope}
        value={fromLiteral('boolean', literal) ?? ''}
        options={BOOLEAN_OPTIONS}
        placeholder="Escolha um valor"
        path={path}
        problems={problems}
        onChange={(next) => {
          if (next !== literal) onCommit(next);
        }}
      />
    );
  }

  const numeric = type === 'integer' || type === 'decimal';
  return (
    <TextField
      ref={control}
      label={label}
      aria-label={name}
      type={type === 'date' && !textDate ? 'date' : 'text'}
      tooltip={textDate ? TEXT_DATE_HELP : undefined}
      value={shown.text}
      inputMode={numeric ? (type === 'integer' ? 'numeric' : 'decimal') : undefined}
      maxLength={10000}
      spellCheck={numeric ? false : undefined}
      autoComplete="off"
      error={error}
      disabled={readOnly}
      aria-describedby={reasonId}
      className={numeric ? 'fc-parameters-mono' : undefined}
      onChange={(event) => onText(event.target.value)}
    />
  );
}
