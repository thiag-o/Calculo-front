import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../../design-system';
import { READ_ONLY_REASON, type WorkflowProblem } from '../draft';
import { useFieldsState } from '../properties';
import { PlusIcon, TrashIcon } from './icons';
import { LiteralField } from './LiteralField';
import { LITERALS_MAX, type ValueType } from './parameterRules';

export interface LiteralListProps {
  /** The caption of the list ("Valores permitidos"). */
  legend: string;
  /** The label of each value, numbered from 1 ("Valor permitido 1"). */
  itemLabel: string;
  /** "Incluir valor permitido". */
  addLabel: string;
  /** The parameter the list belongs to (part of the accessible names). */
  scope: string;
  type: ValueType;
  scale: number | null;
  literals: readonly string[];
  /** With fewer values than this, the "Remover" buttons are not offered (a list default keeps at least one value). */
  minimum: number;
  /**
   * Called with how to change the list, applied to the list at the moment of the change (not to the one of the last
   * render); `item` is the index of the value typed (for the merge key), absent on add or remove.
   */
  onChange: (apply: (literals: readonly string[]) => string[], item?: number) => void;
  /** The problems of the value at `index`. */
  problemsAt: (index: number) => readonly WorkflowProblem[];
  /** The `path` of the value at `index` in the analysed definition, for the focus from the Problems tab. */
  pathAt: (index: number) => string | null;
  /** The problems of the list as a whole, under the caption. */
  problems?: ReactNode;
  /** What an empty list means ("Sem restrição: aceita qualquer valor do tipo."). */
  emptyNote?: ReactNode;
}

/** A list of values of a parameter, each typed as people write it, with "Incluir…" and a "Remover valor" per value. */
export function LiteralList({
  legend,
  itemLabel,
  addLabel,
  scope,
  type,
  scale,
  literals,
  minimum,
  onChange,
  problemsAt,
  pathAt,
  problems,
  emptyNote,
}: LiteralListProps) {
  const { readOnly } = useFieldsState();
  const list = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLFieldSetElement>(null);
  // Where the focus goes after a value is removed, applied once the list is rendered without it.
  const focusAfterRemove = useRef<number | null>(null);
  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    // The value that took the place of the removed one (or the one before it, if the removed was the last): its "Remover"
    // button, or its field when no more can be removed; with the list empty, the "Incluir" button.
    const items = list.current?.querySelectorAll<HTMLElement>(':scope > li') ?? [];
    const item = items[Math.min(index, items.length - 1)];
    const target =
      item?.querySelector<HTMLElement>('.fc-parameters-remove-value') ??
      item?.querySelector<HTMLElement>('input, button') ??
      box.current?.querySelector<HTMLElement>('.fc-properties-add');
    target?.focus();
  });
  const full = literals.length >= LITERALS_MAX;
  const addReason = readOnly ? READ_ONLY_REASON : full ? `A lista aceita até ${LITERALS_MAX} valores.` : undefined;
  const removable = literals.length > minimum;

  function add() {
    onChange((current) => [...current, '']);
    // The new value comes last: it is the next thing to type.
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(':scope > li:last-child input, :scope > li:last-child button')?.focus());
  }

  return (
    <fieldset ref={box} className="fc-properties-group fc-parameters-list">
      <legend className="fc-properties-group-title">{legend}</legend>
      {problems}
      {literals.length === 0 ? emptyNote : null}
      {literals.length > 0 ? (
        <ol ref={list} className="fc-parameters-values">
          {literals.map((literal, index) => {
            const label = `${itemLabel} ${index + 1}`;
            return (
              // The values are texts, with no identity of their own: the position is the key.
              <li key={index} className="fc-parameters-value">
                <LiteralField
                  label={label}
                  scope={scope}
                  type={type}
                  scale={scale}
                  literal={literal}
                  path={pathAt(index)}
                  problems={problemsAt(index)}
                  onCommit={(next) => onChange((current) => current.map((item, at) => (at === index ? next : item)), index)}
                />
                {removable ? (
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    className="fc-parameters-remove-value"
                    label={`Remover ${label.charAt(0).toLocaleLowerCase('pt-BR')}${label.slice(1)} (${scope})`}
                    icon={<TrashIcon size={14} />}
                    disabledReason={readOnly ? READ_ONLY_REASON : undefined}
                    onClick={() => {
                      focusAfterRemove.current = index;
                      onChange((current) => current.filter((_, at) => at !== index));
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      <Button size="small" className="fc-properties-add" icon={<PlusIcon size={14} />} disabledReason={addReason} onClick={add}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
