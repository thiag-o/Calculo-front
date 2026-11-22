import { useState, type KeyboardEvent } from 'react';

/** One item of the list: what is written (`@periodo.inicio`) and its type or origin in words. */
export interface SuggestionItem {
  key: string;
  label: string;
  detail?: string;
}

export interface SuggestionListProps {
  /** The listbox id, for the field's `aria-controls`; each option is `${id}-${index}` (`suggestionId`). */
  id: string;
  /** Accessible name of the list ("Parâmetros"). */
  label: string;
  items: readonly SuggestionItem[];
  /** The option under the arrows (the field's `aria-activedescendant`). */
  active: number;
  onPick: (index: number) => void;
  onActivate: (index: number) => void;
}

/** The id of the option `index` of the list `id`. */
export function suggestionId(id: string, index: number): string {
  return `${id}-${index}`;
}

/**
 * The autocomplete list under a text field (the plain formula field and the filter values): a listbox with the focus kept
 * in the field, which points at the active option by `aria-activedescendant` (`useSuggestionKeys`). A click picks without
 * taking the focus from the field. It stays inside the field's container, in the module root (ADR 0002).
 */
export function SuggestionList({ id, label, items, active, onPick, onActivate }: SuggestionListProps) {
  return (
    <ul id={id} role="listbox" aria-label={label} className="fc-suggestions">
      {items.map((item, index) => (
        <li
          key={item.key}
          id={suggestionId(id, index)}
          role="option"
          aria-selected={index === active}
          className={['fc-suggestions-item', index === active ? 'fc-suggestions-item-active' : null].filter(Boolean).join(' ')}
          // mousedown, not click: the field keeps the focus (and the caret) while the item is picked.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(index);
          }}
          onMouseEnter={() => onActivate(index)}
        >
          <span className="fc-suggestions-label">{item.label}</span>
          {item.detail ? <span className="fc-suggestions-detail">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The keyboard of a field with a `SuggestionList` open: arrows move the active option (it goes back to the first whenever
 * `query`, the text being completed, changes), Enter picks it and Esc closes the list. `onKeyDown` returns whether it used
 * the key; a closed list (`count` 0) uses none.
 */
export function useSuggestionKeys(query: string, count: number, onPick: (index: number) => void, onClose: () => void) {
  const [state, setState] = useState({ query, active: 0 });
  const current = state.query === query ? state.active : 0;
  const active = count === 0 ? -1 : Math.min(current, count - 1);
  const setActive = (index: number) => setState({ query, active: index });

  function onKeyDown(event: KeyboardEvent): boolean {
    if (count === 0) return false;
    if (event.key === 'ArrowDown') setActive((active + 1) % count);
    else if (event.key === 'ArrowUp') setActive((active - 1 + count) % count);
    else if (event.key === 'Enter') onPick(active);
    else if (event.key === 'Escape') onClose();
    else return false;
    event.preventDefault();
    // Esc closes only the list, not the panel around the field.
    event.stopPropagation();
    return true;
  }

  return { active, setActive, onKeyDown };
}
