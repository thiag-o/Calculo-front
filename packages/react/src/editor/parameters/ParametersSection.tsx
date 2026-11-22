import { useRef } from 'react';
import { Button, FieldMessage, Text } from '../../design-system';
import { READ_ONLY_REASON, useDraftEditor } from '../draft';
import { PlusIcon } from './icons';
import { ParameterItem } from './ParameterItem';
import { indexOfParameter, parameterKey, updateParameters, withoutParameter } from './parameterIdentity';
import { parameterPath, parameterProblems, sectionProblems } from './parameterProblems';
import { PARAMETERS_MAX, newParameter } from './parameterRules';
import './parameters.css';

/**
 * The Parâmetros section of the workflow panel (E6-17): the run parameters, used as `@nome` in the filters, formulas and
 * Decision Tables, with "Adicionar parâmetro". Each parameter is known by its object (ADR 0044): its problems follow it
 * while the analysis of an inclusion or a removal is on the way. A removal can be undone with Ctrl Z.
 */
export function ParametersSection() {
  const { definition, analyzedDefinition, problems, readOnly, change } = useDraftEditor();
  const parameters = definition.parameters;
  const analyzedParameters = analyzedDefinition.parameters ?? [];
  const list = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const names = new Map<string, number>();
  for (const parameter of parameters) names.set(parameter.name, (names.get(parameter.name) ?? 0) + 1);

  const full = parameters.length >= PARAMETERS_MAX;
  const addReason = readOnly ? READ_ONLY_REASON : full ? `O workflow aceita até ${PARAMETERS_MAX} parâmetros.` : undefined;
  const own = sectionProblems(problems);

  function add() {
    change((current) => updateParameters(current, (all) => [...all, newParameter(current)]));
    // The new parameter comes last: its name is the first thing to change.
    requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>(':scope > li:last-child input')?.focus());
  }

  return (
    <fieldset className="fc-properties-group">
      <legend className="fc-properties-group-title">Parâmetros</legend>
      {own.length > 0 ? (
        <ul className="fc-properties-problems" aria-label="Problemas dos parâmetros">
          {own.map((problem, index) => (
            <li key={`${problem.code}-${index}`}>
              <FieldMessage type="error">{problem.message}</FieldMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {parameters.length === 0 ? (
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
          Nenhum parâmetro. Declare os valores que cada execução recebe, como o período das notas, e use-os como @nome.
        </Text>
      ) : (
        <ol ref={list} className="fc-properties-list" aria-label="Parâmetros declarados">
          {parameters.map((parameter) => {
            const index = indexOfParameter(analyzedParameters, parameter);
            const at = index < 0 ? null : parameterPath(index);
            return (
              <ParameterItem
                key={parameterKey(parameter)}
                parameter={parameter}
                at={at}
                analyzed={index < 0 ? null : analyzedParameters[index]!}
                problems={parameterProblems(problems, at)}
                names={names}
                onRemove={() => {
                  change((current) => updateParameters(current, (all) => withoutParameter(all, parameter)));
                  // The removed parameter's button is gone: the focus goes to "Adicionar parâmetro".
                  requestAnimationFrame(() => addRef.current?.focus());
                }}
              />
            );
          })}
        </ol>
      )}
      <Button ref={addRef} size="small" className="fc-properties-add" icon={<PlusIcon size={14} />} disabledReason={addReason} onClick={add}>
        Adicionar parâmetro
      </Button>
    </fieldset>
  );
}
