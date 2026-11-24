import { useState } from 'react';
import { Button, textClasses } from '../../design-system';
import { displayApiText, type ScalarType } from './literals';
import { readScalar } from './values';
import { ValueInput } from './ValueInput';

/** The API accepts 1 to 100 values in a list. */
const MAX_ITEMS = 100;

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export interface TagsFieldProps {
  name: string;
  type: ScalarType;
  scale: number | null;
  help: string;
  items: readonly string[];
  onChange: (items: readonly string[]) => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * A list parameter without `allowed_values`: one value at a time, typed as its type asks, kept as a tag (Enter or
 * "Adicionar"). The tags are the API texts of the values, in the order they were added.
 */
export function TagsField({ name, type, scale, help, items, onChange, error, disabled }: TagsFieldProps) {
  const [entry, setEntry] = useState('');
  const [badInput, setBadInput] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const full = items.length >= MAX_ITEMS;

  function add() {
    if (full || (entry === '' && !badInput)) return;
    const reading = readScalar(entry, type, scale, badInput);
    if (!reading.ok) {
      setEntryError(reading.message);
      return;
    }
    if (reading.value === null || typeof reading.value === 'boolean') return;
    if (items.includes(reading.value)) {
      setEntryError('Esse valor já está na lista.');
      return;
    }
    onChange([...items, reading.value]);
    setEntry('');
    setBadInput(false);
    setEntryError(null);
  }

  return (
    <div className="fc-parameter-tags">
      <div className="fc-parameter-tags-entry">
        <ValueInput
          className="fc-parameter-tags-input"
          label={name}
          tooltip={help}
          type={type}
          value={entry}
          onChange={(next, bad) => {
            setEntry(next);
            setBadInput(bad);
            setEntryError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Enter adds the tag; it must not submit the dialog that holds the form.
            event.preventDefault();
            add();
          }}
          error={entryError ?? error}
          disabled={disabled}
        />
        <Button
          type="button"
          aria-label={`Adicionar a ${name}`}
          onClick={add}
          disabledReason={disabled ? 'O formulário está desabilitado' : full ? 'A lista aceita no máximo 100 valores' : undefined}
        >
          Adicionar
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="fc-parameter-tag-list" aria-label={`Valores de ${name}`}>
          {items.map((item) => {
            const shown = displayApiText(item, type);
            return (
              <li key={item} className={`fc-parameter-tag ${textClasses({ variant: 'label-13' })}`}>
                <span className="fc-parameter-tag-text">{shown}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  iconOnly
                  icon={<CloseIcon />}
                  label={`Remover ${shown}`}
                  disabledReason={disabled ? 'O formulário está desabilitado' : undefined}
                  onClick={() => onChange(items.filter((other) => other !== item))}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
