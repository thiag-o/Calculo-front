import { useRef, useState } from 'react';
import { Button, Dialog, DialogClose, EmptyState } from '../../design-system';
import { useDraftEditor, type Dependency, type WorkflowDefinition } from '../draft';
import {
  INPUTS_MAX,
  INPUT_FIELDS_MAX,
  NAME_PATTERN,
  moveItem,
  newInput,
  newInputField,
  removeItem,
  replaceItem,
  updateInput,
  updateInputFields,
  updateInputs,
  variableNameCounts,
  withCardinality,
  withType,
  type DataType,
  type DeclaredInput,
  type InputField,
  type MultipleInput,
} from './definition';
import { CommitTextField, PathSelect, PropertiesFrame, SegmentedControl, parseScale, useFieldsState } from './fields';
import { ArrowDownIcon, ArrowUpIcon, ListIcon, PlusIcon, TrashIcon } from './icons';
import { indexOfItem, itemKey } from './itemIdentity';
import {
  CARDINALITY_LABELS,
  DATA_TYPE_OPTIONS,
  DUPLICATE_VARIABLE_MESSAGE,
  NAME_RULE_MESSAGE,
  NAME_TOOLTIP,
  READ_ONLY_REASON,
  SCALE_RULE_MESSAGE,
  duplicateWarning,
} from './labels';
import { INPUTS_PATH, inputPath, ofPresentItems, otherProblems, problemsAt } from './problemPaths';

const CARDINALITY_OPTIONS = (['linear', 'multiple'] as const).map((value) => ({ value, label: CARDINALITY_LABELS[value] }));

const validateName = (text: string) => (NAME_PATTERN.test(text) ? null : NAME_RULE_MESSAGE);
const validateScale = (text: string) => (parseScale(text) === null ? SCALE_RULE_MESSAGE : null);

/**
 * Where an input on screen was in the analysed definition (ADR 0044): its `path` there (`root.inputs[2]`) and the path of
 * each of its fields, found by object and not by the position on screen. `null` for what was not analysed yet.
 */
interface AnalyzedPlace {
  at: string | null;
  fields: (string | null)[];
}

function analyzedPlace(analyzed: WorkflowDefinition, input: DeclaredInput): AnalyzedPlace {
  const fields = input.cardinality === 'multiple' ? input.fields : [];
  const index = indexOfItem(analyzed.root.inputs, input);
  if (index < 0) return { at: null, fields: fields.map(() => null) };
  const at = inputPath(index);
  const was = analyzed.root.inputs[index]!;
  const wasFields = was.cardinality === 'multiple' ? was.fields : undefined;
  return {
    at,
    fields: fields.map((field) => {
      const fieldIndex = indexOfItem(wasFields, field);
      return fieldIndex < 0 ? null : `${at}.fields[${fieldIndex}]`;
    }),
  };
}

/** The merge key of a field of an input: the same while the same input (and field) is edited, wherever it moves. */
function mergeKeyOf(input: DeclaredInput, field: string, inputField?: InputField): string {
  const item = `input:${itemKey(input)}`;
  return inputField ? `${item}.field:${itemKey(inputField)}.${field}` : `${item}.${field}`;
}

/**
 * The declared inputs (E4-1): name, Linear or Múltiplo, type and places; a Múltiplo has its fields (name, type, places).
 * Inputs can be included, removed (with the confirmation) and moved up and down. Each input is known by its object (ADR
 * 0044): its problems follow it while the analysis of a move, an inclusion or a removal is on the way.
 */
export function InputsProperties() {
  const { definition, analyzedDefinition, problems, dependencies, readOnly, change } = useDraftEditor();
  const inputs = definition.root.inputs;
  const [removing, setRemoving] = useState<DeclaredInput | null>(null);
  const removed = useRef(false);
  /** The "Remover entrada" button that opened the dialog: the focus goes back to it when the removal is cancelled. */
  const opener = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const names = variableNameCounts(definition);

  const places = inputs.map((input) => analyzedPlace(analyzedDefinition, input));
  const shown = new Set<string>();
  const present = new Set<string>();
  inputs.forEach((input, index) => {
    const { at, fields } = places[index]!;
    if (at === null) return;
    present.add(at);
    shown.add(`${at}.name`);
    shown.add(`${at}.cardinality`);
    if (input.cardinality === 'linear') {
      shown.add(`${at}.type`);
      if (input.type === 'decimal') shown.add(`${at}.scale`);
    } else {
      input.fields.forEach((field, fieldIndex) => {
        const fieldAt = fields[fieldIndex];
        if (!fieldAt) return;
        present.add(fieldAt);
        shown.add(`${fieldAt}.name`);
        shown.add(`${fieldAt}.type`);
        if (field.type === 'decimal') shown.add(`${fieldAt}.scale`);
      });
    }
  });

  const full = inputs.length >= INPUTS_MAX;
  const addReason = readOnly ? READ_ONLY_REASON : full ? `O workflow aceita até ${INPUTS_MAX} entradas.` : undefined;

  function add() {
    change((current) => updateInputs(current, (all) => [...all, newInput(current)]));
    // The new input comes last: its name is the first thing to change.
    requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>(':scope > li:last-child input')?.focus());
  }

  const addButton = (
    <Button ref={addRef} size="small" icon={<PlusIcon size={14} />} disabledReason={addReason} onClick={add}>
      Incluir entrada
    </Button>
  );

  const blocks = removing ? countNodesReading(removing, dependencies, definition) : 0;
  const outputFields = removing ? definition.root.output.fields.filter((field) => field.variable === removing.name).length : 0;

  return (
    <PropertiesFrame
      title="Entradas"
      category="source"
      action={inputs.length > 0 ? addButton : undefined}
      problems={ofPresentItems(otherProblems(problems, INPUTS_PATH, shown), present)}
    >
      {inputs.length === 0 ? (
        <EmptyState
          icon={<ListIcon />}
          title="Nenhuma entrada declarada"
          description="Declare os valores que o workflow recebe em cada registro."
          action={addButton}
        />
      ) : (
        <ol ref={list} className="fc-properties-list" aria-label="Entradas declaradas">
          {inputs.map((input, index) => (
            <InputItem
              key={itemKey(input)}
              input={input}
              place={places[index]!}
              first={index === 0}
              last={index === inputs.length - 1}
              names={names}
              onRemove={(button) => {
                removed.current = false;
                opener.current = button;
                setRemoving(input);
              }}
            />
          ))}
        </ol>
      )}
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        // The removed input's button is gone: the focus goes to "Incluir entrada". Cancelled, it goes back to the button.
        focusOnClose={() => (removed.current ? addRef.current : opener.current)}
        title="Remover entrada"
        description={
          removing ? (
            <>
              A entrada <span className="fc-properties-code">{removing.name}</span> sai do workflow. {blocksMessage(blocks)}
              {outputFields > 0 ? ` ${outputMessage(outputFields)}` : null} Você pode desfazer com Ctrl Z.
            </>
          ) : null
        }
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                const input = removing;
                removed.current = true;
                setRemoving(null);
                if (input === null) return;
                change((current) => updateInputs(current, (all) => removeItem(all, input)));
              }}
            >
              Remover entrada
            </Button>
          </>
        }
      />
    </PropertiesFrame>
  );
}

/**
 * How many blocks use the input: the nodes whose `reads` (the analysis `dependencies`, D15 and D16) has the input's name
 * or, for a Múltiplo, the name of one of its fields. A node removed after the latest analysis does not count.
 */
function countNodesReading(input: DeclaredInput, dependencies: readonly Dependency[], definition: WorkflowDefinition): number {
  const names = new Set([input.name, ...(input.cardinality === 'multiple' ? input.fields.map((field) => field.name) : [])]);
  const nodes = new Set(definition.root.nodes.map((node) => node.id));
  return dependencies.filter((dependency) => nodes.has(dependency.node_id) && dependency.reads.some((name) => names.has(name))).length;
}

function blocksMessage(count: number): string {
  if (count === 0) return 'Nenhum bloco usa esta entrada.';
  if (count === 1) return '1 bloco usa esta entrada e passa a mostrar um problema.';
  return `${count} blocos usam esta entrada e passam a mostrar um problema.`;
}

/** The output fields that show the input (a field of the output names its variable). */
function outputMessage(count: number): string {
  if (count === 1) return '1 campo da saída mostra esta entrada e passa a mostrar um problema.';
  return `${count} campos da saída mostram esta entrada e passam a mostrar um problema.`;
}

interface InputItemProps {
  input: DeclaredInput;
  place: AnalyzedPlace;
  first: boolean;
  last: boolean;
  /** How many times each variable name is used: a duplicate name is warned as it is typed. */
  names: ReadonlyMap<string, number>;
  /** Asks to remove the input; `button` gets the focus back if the removal is cancelled. */
  onRemove: (button: HTMLElement) => void;
}

function InputItem({ input, place, first, last, names, onRemove }: InputItemProps) {
  const { problems, change } = useDraftEditor();
  const { readOnly } = useFieldsState();
  const { at } = place;
  const path = (field: string) => (at === null ? null : `${at}.${field}`);

  function update(apply: (current: DeclaredInput, definition: WorkflowDefinition) => DeclaredInput, field?: string) {
    change((current) => updateInput(current, input, apply), field ? { mergeKey: mergeKeyOf(input, field) } : undefined);
  }

  const reason = (fallback: string | undefined) => (readOnly ? READ_ONLY_REASON : fallback);

  return (
    <li className="fc-properties-item">
      <div role="group" aria-label={`Entrada ${input.name}`} className="fc-properties-item-group">
        <CommitTextField
          label="Nome"
          value={input.name}
          mono
          maxLength={63}
          tooltip={NAME_TOOLTIP}
          path={path('name')}
          problems={problemsAt(problems, path('name'))}
          validate={validateName}
          warn={duplicateWarning(names, input.name, DUPLICATE_VARIABLE_MESSAGE)}
          onCommit={(name) => update((current) => ({ ...current, name }), 'name')}
        />
        <SegmentedControl
          label="Cardinalidade"
          options={CARDINALITY_OPTIONS}
          value={input.cardinality}
          path={path('cardinality')}
          problems={problemsAt(problems, path('cardinality'))}
          onChange={(cardinality) => update((current, definition) => withCardinality(definition, current, cardinality))}
        />
        {input.cardinality === 'linear' ? (
          <TypeAndScale
            item={input}
            at={at}
            onType={(type) =>
              update((current, definition) =>
                current.cardinality === 'linear' ? withType(current, type, definition.settings.rounding.scale) : current,
              )
            }
            onScale={(scale) => update((current) => ({ ...current, scale }), 'scale')}
          />
        ) : (
          <MultipleFields input={input} place={place} names={names} />
        )}
        <div className="fc-properties-item-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label="Mover para cima"
            icon={<ArrowUpIcon size={14} />}
            disabledReason={reason(first ? 'Já é a primeira entrada' : undefined)}
            onClick={() => change((current) => updateInputs(current, (all) => moveItem(all, input, -1)))}
          />
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label="Mover para baixo"
            icon={<ArrowDownIcon size={14} />}
            disabledReason={reason(last ? 'Já é a última entrada' : undefined)}
            onClick={() => change((current) => updateInputs(current, (all) => moveItem(all, input, 1)))}
          />
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label="Remover entrada"
            icon={<TrashIcon size={14} />}
            disabledReason={reason(undefined)}
            onClick={(event) => onRemove(event.currentTarget)}
          />
        </div>
      </div>
    </li>
  );
}

interface TypeAndScaleProps {
  item: { type: DataType; scale?: number | null };
  /** The path of the item in the analysed definition (`root.inputs[0]`, `root.inputs[1].fields[0]`), or `null`. */
  at: string | null;
  onType: (type: DataType) => void;
  onScale: (scale: number) => void;
}

function TypeAndScale({ item, at, onType, onScale }: TypeAndScaleProps) {
  const { problems } = useDraftEditor();
  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  return (
    <div className="fc-properties-row">
      <PathSelect
        label="Tipo"
        value={item.type}
        options={DATA_TYPE_OPTIONS}
        path={path('type')}
        problems={problemsAt(problems, path('type'))}
        onChange={(type) => onType(type as DataType)}
      />
      {item.type === 'decimal' ? (
        <CommitTextField
          label="Casas decimais"
          value={String(item.scale ?? '')}
          inputMode="numeric"
          maxLength={2}
          path={path('scale')}
          problems={problemsAt(problems, path('scale'))}
          validate={validateScale}
          onCommit={(text) => onScale(parseScale(text)!)}
        />
      ) : null}
    </div>
  );
}

interface MultipleFieldsProps {
  input: MultipleInput;
  place: AnalyzedPlace;
  names: ReadonlyMap<string, number>;
}

function MultipleFields({ input, place, names }: MultipleFieldsProps) {
  const { problems, change } = useDraftEditor();
  const { readOnly } = useFieldsState();
  const list = useRef<HTMLOListElement>(null);

  function updateFields(apply: (fields: readonly InputField[], definition: WorkflowDefinition) => readonly InputField[], mergeKey?: string) {
    change((current) => updateInputFields(current, input, apply), mergeKey ? { mergeKey } : undefined);
  }

  function updateField(field: InputField, apply: (current: InputField, definition: WorkflowDefinition) => InputField, name?: string) {
    updateFields(
      (fields, definition) => replaceItem(fields, field, (current) => apply(current, definition)),
      name ? mergeKeyOf(input, name, field) : undefined,
    );
  }

  const full = input.fields.length >= INPUT_FIELDS_MAX;
  const only = input.fields.length === 1;

  return (
    <fieldset className="fc-properties-group">
      <legend className="fc-properties-group-title">Campos de {input.name}</legend>
      <ol ref={list} className="fc-properties-sublist">
        {input.fields.map((field, fieldIndex) => {
          const fieldAt = place.fields[fieldIndex] ?? null;
          const path = (name: string) => (fieldAt === null ? null : `${fieldAt}.${name}`);
          return (
            <li key={itemKey(field)}>
              <div role="group" aria-label={`Campo ${field.name}`} className="fc-properties-subitem-group">
                <CommitTextField
                  label="Nome do campo"
                  value={field.name}
                  mono
                  maxLength={63}
                  path={path('name')}
                  problems={problemsAt(problems, path('name'))}
                  validate={validateName}
                  warn={duplicateWarning(names, field.name, DUPLICATE_VARIABLE_MESSAGE)}
                  onCommit={(name) => updateField(field, (current) => ({ ...current, name }), 'name')}
                />
                <TypeAndScale
                  item={field}
                  at={fieldAt}
                  onType={(type) => updateField(field, (current, definition) => withType(current, type, definition.settings.rounding.scale))}
                  onScale={(scale) => updateField(field, (current) => ({ ...current, scale }), 'scale')}
                />
                <div className="fc-properties-item-actions">
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    label="Remover campo"
                    icon={<TrashIcon size={14} />}
                    disabledReason={readOnly ? READ_ONLY_REASON : only ? 'A entrada múltipla precisa de pelo menos um campo' : undefined}
                    onClick={() => updateFields((fields) => removeItem(fields, field))}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        size="small"
        icon={<PlusIcon size={14} />}
        className="fc-properties-add"
        disabledReason={readOnly ? READ_ONLY_REASON : full ? `A entrada múltipla aceita até ${INPUT_FIELDS_MAX} campos.` : undefined}
        onClick={() => {
          updateFields((fields, definition) => [...fields, newInputField(definition)]);
          requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>(':scope > li:last-child input')?.focus());
        }}
      >
        Incluir campo
      </Button>
    </fieldset>
  );
}
