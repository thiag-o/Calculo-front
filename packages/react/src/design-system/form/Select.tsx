import * as RadixSelect from '@radix-ui/react-select';
import { forwardRef, type FocusEventHandler } from 'react';
import { useFluxoPortal } from '../root';
import { FieldMessages, joinClasses, useFieldIds, type FieldProps } from './fieldStructure';
import { BrandIcon, ChevronDownIcon } from './icons';
import { Label } from './Label';
import './field.css';
import './select.css';

export interface SelectOption {
  /** Submitted value (cannot be empty). */
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends FieldProps {
  options: readonly SelectOption[];
  /** Controlled value. `''` goes back to the placeholder text. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Text while nothing is chosen. Default: "Selecione". */
  placeholder?: string;
  /** Name on form submission. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  'aria-describedby'?: string;
  /** Classes of the field container (label, trigger and messages). */
  className?: string;
}

/**
 * Single-option select (Radix Select) with label, tooltip and error (estilos.md §7.2).
 * Keyboard: Enter, Space and the arrows open; arrows and typing navigate; Enter picks; Esc closes and gives focus back.
 * The list opens in the module root portal container, so it must be inside `<FluxoRoot>`.
 * The `ref` goes to the trigger, so react-hook-form can focus the field with an error (use with `Controller`).
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    label,
    tooltip,
    error,
    options,
    value,
    defaultValue,
    onValueChange,
    placeholder = 'Selecione',
    name,
    required,
    disabled,
    id,
    onBlur,
    'aria-describedby': externalDescribedBy,
    className,
  },
  ref,
) {
  const ids = useFieldIds(id, tooltip, error, externalDescribedBy);
  const portal = useFluxoPortal();

  return (
    <div className={joinClasses('fc-field', className)}>
      <Label htmlFor={ids.id}>{label}</Label>
      <RadixSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        name={name}
        required={required}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          ref={ref}
          id={ids.id}
          className="fc-select-trigger"
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          onBlur={onBlur}
        >
          <RadixSelect.Value className="fc-select-value" placeholder={placeholder} />
          <RadixSelect.Icon className="fc-select-arrow">
            <ChevronDownIcon />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        {portal && (
          <RadixSelect.Portal container={portal}>
            <RadixSelect.Content className="fc-select-content" position="popper" sideOffset={4} collisionPadding={8}>
              <RadixSelect.Viewport className="fc-select-list">
                {options.map((option) => (
                  <RadixSelect.Item key={option.value} value={option.value} disabled={option.disabled} className="fc-select-item">
                    <RadixSelect.ItemText>
                      <span className="fc-select-item-text">{option.label}</span>
                    </RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="fc-select-mark">
                      <BrandIcon />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        )}
      </RadixSelect.Root>
      <FieldMessages ids={ids} tooltip={tooltip} error={error} />
    </div>
  );
});
