import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { formulaSegments, parameterCompletionAt } from './parameters';
import type { WorkflowParameter } from './queries';
import { SuggestionList, suggestionId, useSuggestionKeys } from './SuggestionList';

interface PlainFieldProps {
  value: string;
  onChange: (value: string) => void;
  parameters: readonly WorkflowParameter[];
  readOnly: boolean;
  ariaLabel: string;
  describedBy: string | undefined;
  invalid: boolean;
  /** The textarea, for the fix of the problem note. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The plain formula field, used when Monaco or the language does not load (E4-21): a monospaced textarea with the `@`
 * autocomplete of the run parameters (E6-18) and their highlight (text colour with weight 500, estilos.md §2.4). The
 * highlight is a copy of the text drawn under a textarea with transparent text: the caret, the selection and the editing
 * stay the browser's.
 */
export function PlainField({ value, onChange, parameters, readOnly, ariaLabel, describedBy, invalid, fieldRef }: PlainFieldProps) {
  const listId = `fc-formula-parameters-${useId()}`;
  const highlight = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  // The caret to put back after a pick changed the text from outside (the value comes back through the props).
  const pendingCaret = useRef<number | null>(null);

  const before = caret === null ? null : value.slice(0, caret);
  const completion = before === null || readOnly || parameters.length === 0 ? null : parameterCompletionAt(before, parameters);
  const query = before === null || !completion ? '' : before.slice(completion.from);
  const items = completion && closedAt !== `${completion.from}:${value}` ? completion.items.filter((item) => matches(item.label, query)) : [];

  function pick(index: number) {
    const item = items[index];
    if (!completion || !item || caret === null) return;
    const next = value.slice(0, completion.from) + item.insertText + value.slice(caret);
    pendingCaret.current = completion.from + item.insertText.length;
    onChange(next);
  }

  const keys = useSuggestionKeys(`${completion?.from}:${query}`, items.length, pick, () => {
    if (completion) setClosedAt(`${completion.from}:${value}`);
  });

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const position = pendingCaret.current;
    if (!field || position === null || field.value !== value) return;
    pendingCaret.current = null;
    field.setSelectionRange(position, position);
    setCaret(position);
  }, [value, fieldRef]);

  const readCaret = (field: HTMLTextAreaElement) => setCaret(field.selectionStart === field.selectionEnd ? field.selectionStart : null);
  const open = items.length > 0;

  return (
    <div className="fc-formula-plain-field">
      <div ref={highlight} className="fc-formula-plain-highlight" aria-hidden="true">
        {formulaSegments(value).map((segment, index) =>
          segment.parameter ? (
            <span key={index} className="fc-formula-parameter">
              {segment.text}
            </span>
          ) : (
            segment.text
          ),
        )}
        {/* A last line break needs a character after it to take its height, as in the textarea. */}
        {'​'}
      </div>
      <textarea
        ref={fieldRef}
        className="fc-formula-plain"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-autocomplete={readOnly ? undefined : 'list'}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && keys.active >= 0 ? suggestionId(listId, keys.active) : undefined}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        rows={3}
        onChange={(event) => {
          // Typing puts the caret itself: a pick the parent refused leaves no caret waiting for a later text.
          pendingCaret.current = null;
          readCaret(event.target);
          onChange(event.target.value);
        }}
        onSelect={(event) => readCaret(event.currentTarget)}
        onBlur={() => setCaret(null)}
        onKeyDown={(event) => {
          if (open) keys.onKeyDown(event);
        }}
        onScroll={(event) => {
          if (!highlight.current) return;
          highlight.current.scrollTop = event.currentTarget.scrollTop;
          highlight.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      />
      {open ? (
        <SuggestionList
          id={listId}
          label="Parâmetros"
          items={items.map((item) => ({ key: item.label, label: item.label, detail: `${item.typeLabel} · ${item.description}` }))}
          active={keys.active}
          onPick={pick}
          onActivate={keys.setActive}
        />
      ) : null}
    </div>
  );
}

/** Whether an item starts with what was typed of it, without case (`@PER` finds `@periodo`); a complete one is done. */
function matches(label: string, query: string): boolean {
  const typed = query.toLowerCase();
  return label.toLowerCase().startsWith(typed) && label.toLowerCase() !== typed;
}
