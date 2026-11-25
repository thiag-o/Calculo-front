import { useId, useRef, type KeyboardEvent } from 'react';
import { Text } from '../../design-system';
import { useFieldsState } from '../properties';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export interface ChoiceControlProps<T extends string> {
  /** Visible label above the control; with `scope`, the accessible name of the group gets the parameter's name. */
  label: string;
  scope: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  /** Called only with a choice that was confirmed (click, Enter or Space); the arrows do not choose. */
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A segmented control (estilos §7.2) whose choice has a cost (it writes to the draft, opens a confirmation, takes the
 * focus): the arrows, Home and End only move the focus between the options, and the choice is confirmed with a click,
 * Enter or Space (manual activation of the WAI-ARIA radio group).
 */
export function ChoiceControl<T extends string>({ label, scope, options, value, onChange, className }: ChoiceControlProps<T>) {
  const { readOnly, reasonId } = useFieldsState();
  const labelId = `fc-choice-${useId()}`;
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let target: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = index === 0 ? last : index - 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = last;
    if (target === null) return;
    event.preventDefault();
    buttons.current.get(options[target]!.value)?.focus();
  }

  return (
    <div className={['fc-field', className].filter(Boolean).join(' ')}>
      <Text as="span" id={labelId} variant="label-13" emphasis="secondary" className="fc-label">
        {label}
      </Text>
      <div role="radiogroup" aria-label={`${label} (${scope})`} aria-describedby={reasonId} className="fc-segmented">
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              if (element) buttons.current.set(option.value, element);
              else buttons.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            disabled={readOnly}
            className="fc-segmented-option"
            onClick={() => {
              if (option.value !== value) onChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
