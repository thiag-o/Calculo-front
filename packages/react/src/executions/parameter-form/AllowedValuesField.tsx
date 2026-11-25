import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../../api';
import { Button, FieldMessage, Label, Notice, textClasses } from '../../design-system';
import { SEARCH_DELAY_MS, searchText, useAllowedValues, useDebouncedValue } from './allowedValues';
import { CloseIcon } from './icons';
import { displayApiText, type ScalarType } from './literals';

/** The API accepts 1 to 100 values in a list. */
const MAX_ITEMS = 100;

const READ_ERROR_TITLE = 'Não foi possível ler os valores permitidos';
const READ_ERROR_FALLBACK = 'Tente de novo em instantes.';

export interface AllowedValuesFieldProps {
  workflowId: string;
  /** The parameter name: the label and the `{name}` of the route. */
  name: string;
  type: ScalarType;
  help: string;
  /** A list parameter: many choices, kept as tags. Otherwise one choice. */
  multiple: boolean;
  /** The chosen values, as API texts (one at most without `multiple`). */
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  error?: string;
  disabled?: boolean;
  /** The focus left the field (and its list): the form shows the error of what is chosen from then on. */
  onBlur?: () => void;
}

/**
 * The field of a parameter whose `allowed_values` is a query (E7-23): a search (combobox) over the values read from the
 * API, asked again 300 ms after the last key. With `truncated`, a note says only the first 1.000 are shown. In a list, each
 * choice becomes a tag; choosing a chosen value again takes it out. A read error shows the API message, with "Tentar de
 * novo". The list opens on a click, on typing or on the down arrow (not on the focus alone, so Tab passes by); the
 * arrows move in it, Enter chooses and Esc closes it.
 */
export function AllowedValuesField({ workflowId, name, type, help, multiple, selected, onChange, error, disabled = false, onBlur: onLeave }: AllowedValuesFieldProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const input = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  // What is typed; `null` while nothing is (the field shows the chosen value and the whole list is asked).
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(-1);

  const search = useDebouncedValue(searchText(typed ?? '', type), SEARCH_DELAY_MS);
  const query = useAllowedValues(workflowId, name, search, open && !disabled);
  const values = query.data?.values ?? [];
  // While the text is waiting out the debounce or its search is in flight, the list on screen is the one of an older text: it
  // stays visible, but it is not active (no arrow, no Enter, no click chooses a value that does not match what is typed).
  const settling = open && (searchText(typed ?? '', type) !== search || query.isPlaceholderData);
  const selectable = settling ? [] : values;
  const full = multiple && selected.length >= MAX_ITEMS;

  const chosen = selected[0];
  const shown = typed ?? (multiple || chosen === undefined ? '' : displayApiText(chosen, type));

  // Esc with the list open closes only the list. The dialog around the form (Radix) listens to Esc on the document in the
  // capture phase, before the field's own handler, and closes unless the event was already default-prevented. A capture
  // listener on the window runs before it: it only marks an Esc aimed at this field, and the handler below closes the list.
  useEffect(() => {
    const field = input.current;
    const view = field?.ownerDocument.defaultView;
    if (!open || disabled || !field || !view) return;
    const keepDialog = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && event.target === field) event.preventDefault();
    };
    view.addEventListener('keydown', keepDialog, { capture: true });
    return () => view.removeEventListener('keydown', keepDialog, { capture: true });
  }, [open, disabled]);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(value: string) {
    if (multiple) {
      if (selected.includes(value)) onChange(selected.filter((other) => other !== value));
      else if (!full) onChange([...selected, value]);
      setTyped(null);
      return;
    }
    onChange([value]);
    setTyped(null);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (selectable.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // From no active value, down goes to the first and up to the last.
      setActive((current) => (current < 0 || current >= selectable.length ? (step > 0 ? 0 : selectable.length - 1) : (current + step + selectable.length) % selectable.length));
    } else if (event.key === 'Enter') {
      // Enter chooses; it must never submit the dialog that holds the form.
      if (!open) return;
      event.preventDefault();
      const value = selectable[active];
      if (value !== undefined) choose(value);
    } else if (event.key === 'Escape' && open) {
      // Esc closes the list, not the dialog around it (see the window listener above).
      event.preventDefault();
      event.stopPropagation();
      setTyped(null);
      close();
    }
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    // An emptied field takes the single choice out; anything else typed and not chosen is dropped.
    if (!multiple && typed !== null && typed.trim() === '' && chosen !== undefined) onChange([]);
    setTyped(null);
    close();
    onLeave?.();
  }

  let status: string | null = null;
  if (open && (query.isPending || settling)) status = 'Carregando valores';
  else if (open && query.isSuccess && selectable.length === 0) status = typed?.trim() ? 'Nenhum valor encontrado com esse texto' : 'Nenhum valor encontrado';

  const describedBy = [error ? errorId : null, helpId].filter(Boolean).join(' ');

  return (
    <div className="fc-parameter-allowed" onBlur={onBlur}>
      <div className="fc-field">
        <Label htmlFor={inputId}>{name}</Label>
        <input
          ref={input}
          id={inputId}
          type="text"
          role="combobox"
          className="fc-field-input"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open && !disabled ? listId : undefined}
          aria-activedescendant={open && active >= 0 && active < selectable.length ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-busy={open && query.isFetching ? true : undefined}
          placeholder={multiple ? 'Buscar valor' : undefined}
          value={shown}
          disabled={disabled}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setTyped(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <FieldMessage id={helpId} type="tooltip">
          {help}
        </FieldMessage>
        {error ? (
          <FieldMessage id={errorId} type="error">
            {error}
          </FieldMessage>
        ) : null}
      </div>

      {open && !disabled ? (
        // The focus stays in the field when a button of the popup is pressed (Safari does not focus a button on a click, so the
        // field would lose the focus and the list would close before the click).
        <div className="fc-parameter-allowed-popup" onMouseDown={(event) => event.preventDefault()}>
          {query.isError ? (
            <Notice
              type="error"
              title={READ_ERROR_TITLE}
              actions={
                <Button type="button" size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                  Tentar de novo
                </Button>
              }
            >
              {query.error instanceof ApiError ? query.error.message : READ_ERROR_FALLBACK}
            </Notice>
          ) : null}
          <ul
            id={listId}
            role="listbox"
            aria-label={`Valores de ${name}`}
            aria-multiselectable={multiple || undefined}
            className="fc-parameter-allowed-list"
            hidden={values.length === 0 || query.isError}
          >
            {values.map((value, index) => {
              const isChosen = selected.includes(value);
              const blocked = settling || (full && !isChosen);
              return (
                <li
                  key={value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isChosen}
                  aria-disabled={blocked || undefined}
                  className={`fc-parameter-allowed-option ${textClasses({ variant: 'label-14' })}`}
                  data-active={(!settling && index === active) || undefined}
                  // The focus stays in the field: the click chooses without blurring it.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!blocked) choose(value);
                  }}
                >
                  {displayApiText(value, type)}
                </li>
              );
            })}
          </ul>
          {status !== null && !query.isError ? (
            <p role="status" className={`fc-parameter-allowed-status ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
              {status}
            </p>
          ) : null}
          {query.data?.truncated && !query.isError ? (
            <p className={`fc-parameter-allowed-status ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
              Mostrando os primeiros 1.000. Digite para filtrar.
            </p>
          ) : null}
          {full ? (
            <p className={`fc-parameter-allowed-status ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
              A lista aceita no máximo 100 valores.
            </p>
          ) : null}
        </div>
      ) : null}

      {multiple && selected.length > 0 ? (
        // Pressing "Remover" must not blur the field first (Safari: the list would close before the click).
        <ul className="fc-parameter-tag-list" aria-label={`Valores escolhidos de ${name}`} onMouseDown={(event) => event.preventDefault()}>
          {selected.map((value) => {
            const label = displayApiText(value, type);
            return (
              <li key={value} className={`fc-parameter-tag ${textClasses({ variant: 'label-13' })}`}>
                <span className="fc-parameter-tag-text">{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  iconOnly
                  icon={<CloseIcon />}
                  label={`Remover ${label}`}
                  disabledReason={disabled ? 'O formulário está desabilitado' : undefined}
                  onClick={() => {
                    onChange(selected.filter((other) => other !== value));
                    input.current?.focus();
                  }}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
