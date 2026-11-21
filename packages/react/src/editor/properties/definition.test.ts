import { describe, expect, it } from 'vitest';
import { groupedDraft, nestedDraft, withSourceAndEmptyGroup } from '../groups/groups.test-support';
import { exampleBatchSource } from '../sources/batch-source/batch-source.test-support';
import { analyzedNodePath } from './problemPaths';
import {
  locateNode,
  moveItem,
  removeItem,
  replaceItem,
  updateCalculation,
  updateInput,
  updateInputFields,
  updateInputs,
  updateOutputFields,
  variableNameCounts,
  variableNames,
  withCardinality,
  type DeclaredInput,
} from './definition';
import { indexOfItem, itemKey } from './itemIdentity';
import { exampleDraft } from './properties.test-support';

function example() {
  return exampleDraft().definition;
}

describe('Edições das entradas e da saída mantêm os objetos do que não mudou (ADR 0044)', () => {
  it('editar uma entrada recria só ela, e ela continua sendo a mesma entrada', () => {
    const definition = example();
    const [valor, categoria, pontuacoes] = definition.root.inputs;
    const next = updateInput(definition, categoria!, (input) => ({ ...input, name: 'segmento' }));

    expect(next.root.inputs[0]).toBe(valor);
    expect(next.root.inputs[2]).toBe(pontuacoes);
    expect(next.root.nodes).toBe(definition.root.nodes);
    expect(next.root.output).toBe(definition.root.output);
    expect(next.settings).toBe(definition.settings);
    expect(next.root.inputs[1]).not.toBe(categoria);
    expect(itemKey(next.root.inputs[1]!)).toBe(itemKey(categoria!));
    expect(indexOfItem(definition.root.inputs, next.root.inputs[1]!)).toBe(1);
  });

  it('a edição que não muda nada devolve a mesma definição', () => {
    const definition = example();
    const categoria = definition.root.inputs[1]!;
    expect(updateInput(definition, categoria, (input) => input)).toBe(definition);
    expect(updateInput(definition, categoria, (input) => withCardinality(definition, input, 'linear'))).toBe(definition);
  });

  it('mover e remover não recriam nenhuma entrada', () => {
    const definition = example();
    const [valor, categoria, pontuacoes] = definition.root.inputs;
    const moved = updateInputs(definition, (all) => moveItem(all, pontuacoes!, -1));
    expect(moved.root.inputs).toEqual([valor, pontuacoes, categoria]);
    expect(moved.root.inputs[0]).toBe(valor);
    expect(moved.root.inputs[1]).toBe(pontuacoes);
    expect(moved.root.inputs[2]).toBe(categoria);

    const removed = updateInputs(moved, (all) => removeItem(all, valor!));
    expect(removed.root.inputs[0]).toBe(pontuacoes);
    expect(removed.root.inputs[1]).toBe(categoria);
  });

  it('acha a entrada editada mesmo depois de movida (pelo objeto, não pela posição)', () => {
    const definition = example();
    const categoria = definition.root.inputs[1]!;
    const renamed = updateInput(definition, categoria, (input) => ({ ...input, name: 'segmento' }));
    const moved = updateInputs(renamed, (all) => moveItem(all, renamed.root.inputs[1]!, 1));
    // The analysed definition is the first one: the input on screen is found where it was analysed.
    expect(indexOfItem(definition.root.inputs, moved.root.inputs[2]!)).toBe(1);
    // An input included later was never analysed.
    const included = updateInputs(moved, (all) => [...all, { name: 'nova', cardinality: 'linear', type: 'text' } satisfies DeclaredInput]);
    expect(indexOfItem(definition.root.inputs, included.root.inputs[3]!)).toBe(-1);
  });

  it('editar um campo da múltipla recria só ele e a entrada dele', () => {
    const definition = example();
    const pontuacoes = definition.root.inputs[2]!;
    if (pontuacoes.cardinality !== 'multiple') throw new Error('pontuacoes é múltipla');
    const [valorCompra, taxa] = pontuacoes.fields;
    const next = updateInputFields(definition, pontuacoes, (fields) => replaceItem(fields, taxa!, (field) => ({ ...field, scale: 6 })));
    const after = next.root.inputs[2]!;
    if (after.cardinality !== 'multiple') throw new Error('pontuacoes é múltipla');

    expect(next.root.inputs[0]).toBe(definition.root.inputs[0]);
    expect(next.root.inputs[1]).toBe(definition.root.inputs[1]);
    expect(after.fields[0]).toBe(valorCompra);
    expect(after.fields[1]).not.toBe(taxa);
    expect(indexOfItem(pontuacoes.fields, after.fields[1]!)).toBe(1);
    expect(indexOfItem(definition.root.inputs, after)).toBe(2);
  });

  it('os campos da saída seguem o mesmo padrão', () => {
    const definition = example();
    definition.root.output.fields.push({ name: 'fator', variable: 'fator' });
    const [pontos, fator] = definition.root.output.fields;
    const renamed = updateOutputFields(definition, (all) => replaceItem(all, pontos!, (field) => ({ ...field, name: 'total' })));
    expect(renamed.root.output.fields[1]).toBe(fator);
    expect(renamed.root.inputs).toBe(definition.root.inputs);

    const moved = updateOutputFields(renamed, (all) => moveItem(all, fator!, -1));
    expect(moved.root.output.fields[0]).toBe(fator);
    expect(moved.root.output.fields[1]).toBe(renamed.root.output.fields[0]);
    expect(indexOfItem(definition.root.output.fields, moved.root.output.fields[1]!)).toBe(0);

    expect(updateOutputFields(moved, (all) => all)).toBe(moved);
  });
});

describe('Nós dentro de grupos', () => {
  const grouped = () => groupedDraft().definition;

  it('acha um nó em qualquer profundidade, com o caminho que os problemas usam', () => {
    expect(locateNode(grouped(), 'calc_pontos')).toMatchObject({ path: 'root.nodes[0].nodes[1]', node: { id: 'calc_pontos' } });
    expect(locateNode(grouped(), 'calc_bonus')?.path).toBe('root.nodes[1]');
    expect(locateNode(nestedDraft().definition, 'calc_pontos')?.path).toBe('root.nodes[0].nodes[0].nodes[1]');
    expect(locateNode(grouped(), 'nao_existe')).toBeNull();
  });

  it('o caminho analisado de um bloco dentro do grupo é o do grupo, e um bloco novo ainda não tem caminho', () => {
    expect(analyzedNodePath(grouped(), 'calc_pontos')).toBe('root.nodes[0].nodes[1]');
    expect(analyzedNodePath(grouped(), 'calc_novo')).toBeNull();
  });

  it('editar um Cálculo dentro do grupo recria só o grupo dele e mantém os outros objetos', () => {
    const definition = grouped();
    const group = definition.root.nodes[0]!;
    const bonus = definition.root.nodes[1]!;
    const next = updateCalculation(definition, 'calc_pontos', (node) => ({ ...node, name: 'Pontos do item' }));
    expect(next.root.nodes[1]).toBe(bonus);
    expect(next.root.nodes[0]).not.toBe(group);
    const inner = next.root.nodes[0]!.type === 'group' ? next.root.nodes[0]!.nodes : [];
    expect(inner[0]).toBe(group.type === 'group' ? group.nodes[0] : null);
    expect(inner[1]).toMatchObject({ id: 'calc_pontos', name: 'Pontos do item' });
  });

  it('a edição que não muda nada, ou de um Cálculo que não existe, devolve a mesma definição', () => {
    const definition = grouped();
    expect(updateCalculation(definition, 'calc_pontos', (node) => node)).toBe(definition);
    expect(updateCalculation(definition, 'nao_existe', (node) => ({ ...node, name: 'x' }))).toBe(definition);
  });

  it('os nomes de variável contam também os de dentro dos grupos, os da Fonte e os da fonte do lote', () => {
    const counts = variableNameCounts(withSourceAndEmptyGroup().definition);
    expect(counts.get('pontos')).toBe(1);
    expect(counts.get('limite')).toBe(1);
    const repeated = updateCalculation(grouped(), 'calc_pontos', (node) => ({ ...node, output: { ...node.output, name: 'bonus' } }));
    expect(variableNameCounts(repeated).get('bonus')).toBe(2);
    const batch = { ...grouped(), root: { ...grouped().root, batch_source: exampleBatchSource() } };
    expect(variableNames(batch).has('valor_item')).toBe(true);
  });
});
