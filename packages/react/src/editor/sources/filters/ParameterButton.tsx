import { Button, Menu } from '../../../design-system';
import type { ParameterReference } from '../../../formula';
import { READ_ONLY_REASON } from '../../draft';
import { useFieldsState } from '../../properties';
import { AtSignIcon } from './icons';
import { scopedName } from './paths';

export interface ParameterButtonProps {
  /** The label of the field beside it ("Valor", "De"). */
  fieldLabel: string;
  scope?: string;
  /** The references that serve the field (`servingReferences`). */
  references: readonly ParameterReference[];
  /** Whether the draft has any parameter: without one, the reason says where to declare it. */
  hasParameters: boolean;
  onPick: (reference: ParameterReference) => void;
}

/**
 * "Usar parâmetro" (D35): beside the fields where `@` cannot be typed (the date picker and the Verdadeiro/Falso select), a
 * menu with the parameters that serve the field. Without any, the button says why (estilos.md §14).
 */
export function ParameterButton({ fieldLabel, scope, references, hasParameters, onPick }: ParameterButtonProps) {
  const { readOnly } = useFieldsState();
  const label = scopedName('Usar parâmetro', scope ? `${fieldLabel}, ${scope}` : fieldLabel);
  const reason = readOnly
    ? READ_ONLY_REASON
    : !hasParameters
      ? 'O workflow não tem parâmetros. Declare-os nas propriedades do workflow.'
      : references.length === 0
        ? 'Nenhum parâmetro do workflow serve a este campo.'
        : undefined;
  const button = (
    <Button iconOnly variant="ghost" size="small" label={label} icon={<AtSignIcon size={14} />} className="fc-filters-parameter-button" disabledReason={reason} />
  );
  if (reason) return button;
  return (
    <Menu
      align="end"
      trigger={button}
      items={references.map((reference) => ({ label: reference.text, onSelect: () => onPick(reference) }))}
    />
  );
}
