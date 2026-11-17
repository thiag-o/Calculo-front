import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { textClasses } from '../typography';
import { FieldMessages, joinClasses, useFieldIds, type FieldProps } from './fieldStructure';
import { BrandIcon, MinusIcon } from './icons';
import './field.css';
import './checkbox.css';

type RadixCheckboxProps = Omit<ComponentPropsWithoutRef<typeof RadixCheckbox.Root>, 'asChild' | 'children'>;

export interface CheckboxProps extends FieldProps, RadixCheckboxProps {
  /** Classes of the container (box, label and messages). The other props go to the box (Radix Checkbox). */
  className?: string;
}

/**
 * Checkbox (Radix Checkbox) with the label beside it, tooltip and error (estilos.md §7.2).
 * Accepts `checked`/`onCheckedChange` (controlled) or `defaultChecked`, and the `'indeterminate'` state.
 * Space toggles; clicking the label too. With `name`, it takes part in form submission.
 */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, tooltip, error, id, className, 'aria-describedby': externalDescribedBy, ...rest },
  ref,
) {
  const ids = useFieldIds(id, tooltip, error, externalDescribedBy);
  return (
    <div className={joinClasses('fc-checkbox', rest.disabled && 'fc-checkbox-disabled', className)}>
      <div className="fc-checkbox-row">
        <RadixCheckbox.Root
          {...rest}
          ref={ref}
          id={ids.id}
          className="fc-checkbox-box"
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
        >
          <RadixCheckbox.Indicator className="fc-checkbox-indicator">
            <BrandIcon size={12} className="fc-checkbox-mark" />
            <MinusIcon size={12} className="fc-checkbox-dash" />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        <label htmlFor={ids.id} className={joinClasses('fc-checkbox-label', textClasses({ variant: 'copy-14' }))}>
          {label}
        </label>
      </div>
      <FieldMessages ids={ids} tooltip={tooltip} error={error} />
    </div>
  );
});
