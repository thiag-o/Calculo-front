import { useRef } from 'react';
import { Button, EmptyState, type SelectOption } from '../../design-system';
import { useDraftEditor, type DraftSymbol } from '../draft';
import { NAME_PATTERN, moveItem, newOutputField, removeItem, replaceItem, updateOutputFields, type OutputField } from './definition';
import { CommitTextField, PathSelect, PropertiesFrame } from './fields';
import { ArrowDownIcon, ArrowUpIcon, ListIcon, PlusIcon, TrashIcon } from './icons';
import { indexOfItem, itemKey } from './itemIdentity';
import { DUPLICATE_OUTPUT_FIELD_MESSAGE, NAME_RULE_MESSAGE, NAME_TOOLTIP, READ_ONLY_REASON, duplicateWarning, scopedName } from './labels';
import { OUTPUT_PATH, ofPresentItems, otherProblems, outputFieldPath, problemsAt } from './problemPaths';

const NO_VARIABLE_REASON = 'Declare uma entrada ou crie um bloco para ter uma variável para a saída';

/** The linear variables of the analysis (inputs and block outputs): what an output field can show. */
function linearSymbols(symbols: readonly DraftSymbol[]): DraftSymbol[] {
  return symbols.filter((symbol) => symbol.cardinality === 'linear');
}

/**
 * The output fields of the workflow: a name and the linear variable each one shows. Each field is known by its object (ADR
 * 0044): its problems follow it while the analysis of a move, an inclusion or a removal is on the way.
 */
export function OutputProperties() {
  const { definition, analyzedDefinition, problems, symbols, readOnly, change } = useDraftEditor();
  const fields = definition.root.output.fields;
  const variables = linearSymbols(symbols);
  const list = useRef<HTMLOListElement>(null);

  // Where each field was in the analysed definition, found by object: the problems' paths point there.
  const places = fields.map((field) => {
    const index = indexOfItem(analyzedDefinition.root.output.fields, field);
    return index < 0 ? null : outputFieldPath(index);
  });
  const shown = new Set<string>();
  const present = new Set<string>();
  for (const at of places) {
    if (at === null) continue;
    present.add(at);
    shown.add(`${at}.name`);
    shown.add(`${at}.variable`);
  }
  const nameCounts = new Map<string, number>();
  for (const field of fields) nameCounts.set(field.name, (nameCounts.get(field.name) ?? 0) + 1);

  const addReason = readOnly ? READ_ONLY_REASON : variables.length === 0 ? NO_VARIABLE_REASON : undefined;

  function add() {
    change((current) =>
      updateOutputFields(current, (all) => {
        const used = new Set(all.map((field) => field.variable));
        const variable = (variables.find((symbol) => !used.has(symbol.name)) ?? variables[0])!.name;
        return [...all, newOutputField(all, variable)];
      }),
    );
    requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>(':scope > li:last-child input')?.focus());
  }

  function update(field: OutputField, apply: (current: OutputField) => OutputField, mergeKey?: string) {
    change((current) => updateOutputFields(current, (all) => replaceItem(all, field, apply)), mergeKey ? { mergeKey } : undefined);
  }

  const addButton = (
    <Button size="small" icon={<PlusIcon size={14} />} disabledReason={addReason} onClick={add}>
      Incluir campo
    </Button>
  );

  return (
    <PropertiesFrame
      title="Saída"
      category="output"
      action={fields.length > 0 ? addButton : undefined}
      problems={ofPresentItems(otherProblems(problems, OUTPUT_PATH, shown), present)}
    >
      {fields.length === 0 ? (
        <EmptyState
          icon={<ListIcon />}
          title="Nenhum campo de saída"
          description="Escolha as variáveis que o workflow entrega em cada registro."
          action={addButton}
        />
      ) : (
        <ol ref={list} className="fc-properties-list" aria-label="Campos de saída">
          {fields.map((field, index) => {
            const at = places[index] ?? null;
            const path = (name: string) => (at === null ? null : `${at}.${name}`);
            const options: SelectOption[] = variables.map((symbol) => ({ value: symbol.name, label: symbol.name }));
            // A variable that no longer exists stays listed, so the select shows it (the problem says what to do).
            if (field.variable && !options.some((option) => option.value === field.variable)) {
              options.push({ value: field.variable, label: field.variable });
            }
            const reason = (fallback: string | undefined) => (readOnly ? READ_ONLY_REASON : fallback);
            return (
              <li key={itemKey(field)} className="fc-properties-item">
                <div role="group" aria-label={`Campo ${field.name}`} className="fc-properties-item-group">
                  <CommitTextField
                    label="Nome"
                    scope={field.name}
                    value={field.name}
                    mono
                    maxLength={63}
                    tooltip={NAME_TOOLTIP}
                    path={path('name')}
                    problems={problemsAt(problems, path('name'))}
                    validate={(text) => (NAME_PATTERN.test(text) ? null : NAME_RULE_MESSAGE)}
                    warn={duplicateWarning(nameCounts, field.name, DUPLICATE_OUTPUT_FIELD_MESSAGE)}
                    onCommit={(name) => update(field, (current) => ({ ...current, name }), `output:${itemKey(field)}.name`)}
                  />
                  <PathSelect
                    label="Variável"
                    scope={field.name}
                    value={field.variable}
                    options={options}
                    className="fc-properties-mono"
                    path={path('variable')}
                    problems={problemsAt(problems, path('variable'))}
                    onChange={(variable) => update(field, (current) => ({ ...current, variable }))}
                  />
                  <OutputActions field={field} first={index === 0} last={index === fields.length - 1} reason={reason} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </PropertiesFrame>
  );
}

interface OutputActionsProps {
  field: OutputField;
  first: boolean;
  last: boolean;
  reason: (fallback: string | undefined) => string | undefined;
}

function OutputActions({ field, first, last, reason }: OutputActionsProps) {
  const { change } = useDraftEditor();
  return (
    <div className="fc-properties-item-actions">
      <Button
        iconOnly
        variant="ghost"
        size="small"
        label={scopedName('Mover para cima', field.name)}
        icon={<ArrowUpIcon size={14} />}
        disabledReason={reason(first ? 'Já é o primeiro campo' : undefined)}
        onClick={() => change((current) => updateOutputFields(current, (all) => moveItem(all, field, -1)))}
      />
      <Button
        iconOnly
        variant="ghost"
        size="small"
        label={scopedName('Mover para baixo', field.name)}
        icon={<ArrowDownIcon size={14} />}
        disabledReason={reason(last ? 'Já é o último campo' : undefined)}
        onClick={() => change((current) => updateOutputFields(current, (all) => moveItem(all, field, 1)))}
      />
      <Button
        iconOnly
        variant="ghost"
        size="small"
        label={scopedName('Remover campo', field.name)}
        icon={<TrashIcon size={14} />}
        disabledReason={reason(undefined)}
        onClick={() => change((current) => updateOutputFields(current, (all) => removeItem(all, field)))}
      />
    </div>
  );
}
