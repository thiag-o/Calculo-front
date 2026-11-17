import { useId, type ReactNode } from 'react';
import { FieldMessage } from './FieldMessage';

/** Props common to every design-system field. */
export interface FieldProps {
  /** Visible label above the field (or beside it, in the checkbox). Required: it is the accessible name. */
  label: ReactNode;
  /** Help below the field ("Mínimo de 12 caracteres"). */
  tooltip?: ReactNode;
  /** Field error: what happened and what to do. Marks the field as invalid. */
  error?: ReactNode;
}

interface FieldIds {
  id: string;
  tooltipId?: string;
  errorId?: string;
  /** Error first: it is what the screen reader must say before the help. */
  describedBy?: string;
  invalid: boolean;
}

/** Ids of the field and of the messages, and the aria-describedby that links them. */
export function useFieldIds(externalId: string | undefined, tooltip: ReactNode, error: ReactNode, externalDescribedBy?: string): FieldIds {
  const generated = useId();
  const id = externalId ?? `fc-field-${generated}`;
  const tooltipId = hasContent(tooltip) ? `${id}-dica` : undefined;
  const errorId = hasContent(error) ? `${id}-erro` : undefined;
  const describedBy = [errorId, tooltipId, externalDescribedBy].filter(Boolean).join(' ') || undefined;
  return { id, tooltipId, errorId, describedBy, invalid: errorId !== undefined };
}

export function FieldMessages({ ids, tooltip, error }: { ids: FieldIds; tooltip: ReactNode; error: ReactNode }) {
  return (
    <>
      {ids.tooltipId ? (
        <FieldMessage id={ids.tooltipId} type="tooltip">
          {tooltip}
        </FieldMessage>
      ) : null}
      {ids.errorId ? (
        <FieldMessage id={ids.errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </>
  );
}

function hasContent(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== false && value !== '';
}

export function joinClasses(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
