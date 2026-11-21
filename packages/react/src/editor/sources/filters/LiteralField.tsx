import { useRef, useState } from 'react';
import { Notice, TextField } from '../../../design-system';
import { useDraftEditor, type WorkflowProblem } from '../../draft';
import { problemText, useFieldsState, useFocusOnSelection } from '../../properties';
import { fitsDatePicker, fromLiteral, isParameter, PARAMETER_NOTICE, toLiteral, type DataType } from './filterRules';
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
  /** The literal in the definition (`"A"`, `1500.00`, `DATA(2026, 10, 1)`). */
  literal: string;
  /** Called with each literal that can be written (a text that cannot stays only in the field, with the error). */
  onCommit: (literal: string) => void;
  path: string | null;
  problems: readonly WorkflowProblem[];
}

/**
 * A value of a filter, typed as people write it: text without quotes, a number in the Brazilian pattern (`1.500,50`), a
 * date in the date picker. It goes to the draft as a literal of the formula language (E4-3); a number badly written stays
 * only in the field, with what to do (ADR 0046). A value starting with `@` is a run parameter, which only comes in epic
 * 6: it goes as typed and the field says so.
 */
export function LiteralField({ label, scope, type, scale, literal, onCommit, path, problems }: LiteralFieldProps) {
  const { readOnly, reasonId } = useFieldsState();
  const { definition } = useDraftEditor();
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

  const reading = toLiteral(type, scale, shown.text);
  const error = reading.ok ? problemText(problems) : `${reading.message} ${NOT_SAVED_NOTE}`;
  const parameter = isParameter(shown.text);
  const datePicker = type === 'date' && !parameter && fitsDatePicker(literal);
  const numeric = type === 'integer' || type === 'decimal';

  return (
    <div className="fc-filters-value">
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
        aria-describedby={reasonId}
        className={numeric || type === 'datetime' ? 'fc-filters-mono' : undefined}
        onChange={(event) => {
          const text = event.target.value;
          setShown((current) => ({ ...current, text }));
          const next = toLiteral(type, scale, text);
          if (next.ok && next.value !== literal) onCommit(next.value);
        }}
      />
      {parameter ? (
        <Notice type="warning" className="fc-filters-parameter">
          {PARAMETER_NOTICE}
        </Notice>
      ) : null}
    </div>
  );
}
