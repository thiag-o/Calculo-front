import { useEffect, useId, useRef, useState } from 'react';
import { Button, FieldMessage, Text } from '../../design-system';
import { PlusIcon, TrashIcon } from './icons';
import { typeDescription, ValueField } from './ValueField';
import { itemFieldPath, type DeclaredInput, type TypedItem } from './values';

type MultipleInput = Extract<DeclaredInput, { cardinality: 'multiple' }>;

export interface MultipleInputTableProps {
  input: MultipleInput;
  items: readonly TypedItem[];
  /** The new items; `path` is the field edited (`pontuacoes[0].taxa`), none when an item was included or removed. */
  onChange: (items: TypedItem[], path?: string) => void;
  /** The id of the control of a path (`pontuacoes[0].taxa`), to focus it. */
  fieldId: (path: string) => string;
  /** The error shown at a path (`pontuacoes[0].taxa`), or at the list itself (`pontuacoes`). */
  errorAt: (path: string) => string | null;
  onBlurField: (path: string) => void;
}

/**
 * A multiple input as a small table of items (E4-14): one column per field, with "Incluir item" and "Remover item N".
 * No items is an empty list.
 */
export function MultipleInputTable({ input, items, onChange, fieldId, errorAt, onBlurField }: MultipleInputTableProps) {
  const nameId = useId();
  const listErrorId = useId();
  const area = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // After including, the focus goes to the new item's first field; after removing, to "Incluir item".
  const [focusAfter, setFocusAfter] = useState<{ target: 'item'; index: number } | { target: 'add' } | null>(null);
  const listError = errorAt(input.name);

  useEffect(() => {
    if (!focusAfter) return;
    if (focusAfter.target === 'add') addButton.current?.focus();
    else {
      const first = input.fields[0];
      if (first) area.current?.ownerDocument.getElementById(fieldId(itemFieldPath(input.name, focusAfter.index, first.name)))?.focus();
    }
    setFocusAfter(null);
  }, [focusAfter, fieldId, input]);

  const nextId = () => items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const count = items.length;

  return (
    <div ref={area} className="fc-unit-run-multiple">
      <div className="fc-unit-run-multiple-head">
        <span id={nameId} className="fc-unit-run-name">
          {input.name}
        </span>
        <Text as="span" variant="label-12" emphasis="tertiary">
          {count === 0 ? 'Lista vazia' : count === 1 ? 'Lista com 1 item' : `Lista com ${count.toLocaleString('pt-BR')} itens`}
        </Text>
      </div>
      {count > 0 ? (
        <div className="fc-unit-run-items-scroll">
          <table className="fc-unit-run-items" aria-labelledby={nameId} aria-describedby={listError ? listErrorId : undefined}>
            <thead>
              <tr>
                <th scope="col" className="fc-unit-run-items-number">
                  <span className="fc-visually-hidden">Item</span>
                </th>
                {input.fields.map((field) => (
                  <th key={field.name} scope="col">
                    <span className="fc-unit-run-items-field">{field.name}</span>
                    <span className="fc-unit-run-items-type">{typeDescription(field.type, field.scale)}</span>
                  </th>
                ))}
                <th scope="col" className="fc-unit-run-items-actions">
                  <span className="fc-visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <th scope="row" className="fc-unit-run-items-number">
                    {index + 1}
                  </th>
                  {input.fields.map((field) => {
                    const path = itemFieldPath(input.name, index, field.name);
                    return (
                      <td key={field.name}>
                        <ValueField
                          compact
                          id={fieldId(path)}
                          label={`${field.name} do item ${index + 1}`}
                          type={field.type}
                          scale={field.scale}
                          value={item.fields[field.name] ?? ''}
                          error={errorAt(path)}
                          onBlur={() => onBlurField(path)}
                          onChange={(value) =>
                            onChange(
                              items.map((current) => (current.id === item.id ? { ...current, fields: { ...current.fields, [field.name]: value } } : current)),
                              path,
                            )
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="fc-unit-run-items-actions">
                    <Button
                      variant="ghost"
                      size="small"
                      iconOnly
                      icon={<TrashIcon size={14} />}
                      label={`Remover item ${index + 1} de ${input.name}`}
                      onClick={() => {
                        onChange(items.filter((current) => current.id !== item.id));
                        setFocusAfter({ target: 'add' });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {listError ? (
        <FieldMessage id={listErrorId} type="error">
          {listError}
        </FieldMessage>
      ) : null}
      <div>
        <Button
          ref={addButton}
          variant="ghost"
          size="small"
          icon={<PlusIcon size={14} />}
          aria-label={`Incluir item em ${input.name}`}
          onClick={() => {
            onChange([...items, { id: nextId(), fields: {} }]);
            setFocusAfter({ target: 'item', index: items.length });
          }}
        >
          Incluir item
        </Button>
      </div>
    </div>
  );
}
