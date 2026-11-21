import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../api';
import { groupedDraft, nestedDraft, withSourceAndEmptyGroup } from '../groups/groups.test-support';
import { INPUTS_ID, OUTPUT_ID, canvasGraph, readersOf } from './graph';

function graphOf(draft: Schemas['Draft']) {
  return canvasGraph(draft.definition, draft.symbols, draft.dependencies, null, draft.groups);
}

function linksOf(draft: Schemas['Draft']) {
  return graphOf(draft).links.map((link) => `${link.source}|${link.sourceHandle} -> ${link.target}|${link.targetHandle}`);
}

describe('canvasGraph com grupos', () => {
  it('as ligações entram e saem do grupo pelas barras de Input e de Output', () => {
    expect(linksOf(groupedDraft())).toEqual([
      `${INPUTS_ID}|var:categoria -> grp_pontuacao|in:categoria`,
      `${INPUTS_ID}|var:valor_item -> grp_pontuacao|in:valor_item`,
      'calc_pontos|out:pontos -> grp_pontuacao|inner-out:pontos',
      'grp_pontuacao|inner-in:categoria -> td_elegibilidade|in:categoria',
      'td_elegibilidade|out:fator -> calc_pontos|in:fator',
      'grp_pontuacao|inner-in:valor_item -> calc_pontos|in:valor_item',
      'grp_pontuacao|out:pontos -> calc_bonus|in:pontos',
      `calc_bonus|out:bonus -> ${OUTPUT_ID}|field:0`,
    ]);
  });

  it('o Input do grupo vem da análise (groups), com o tipo do symbol; o Output, do que o grupo entrega', () => {
    const view = graphOf(groupedDraft()).groups[0]!;
    expect(view.inputs.map((port) => [port.label, port.type])).toEqual([
      ['categoria', 'text'],
      ['valor_item', 'decimal(2)'],
    ]);
    expect(view.outputs.map((port) => [port.label, port.type])).toEqual([['pontos', 'decimal(2)']]);
    expect(view.blockCount).toBe(2);
    // Without the analysis of the group, its Input is empty: nothing is guessed from the formulas.
    const draft = groupedDraft();
    expect(canvasGraph(draft.definition, draft.symbols, draft.dependencies, null, []).groups[0]!.inputs).toEqual([]);
  });

  it('grupo recolhido: os blocos de dentro somem, e ficam só as ligações que entram e saem', () => {
    const graph = graphOf(groupedDraft(true));
    expect(graph.blocks.filter((view) => view.hidden).map((view) => view.block.id)).toEqual(['td_elegibilidade', 'calc_pontos']);
    expect(linksOf(groupedDraft(true))).toEqual([
      `${INPUTS_ID}|var:categoria -> grp_pontuacao|in:categoria`,
      `${INPUTS_ID}|var:valor_item -> grp_pontuacao|in:valor_item`,
      'grp_pontuacao|out:pontos -> calc_bonus|in:pontos',
      `calc_bonus|out:bonus -> ${OUTPUT_ID}|field:0`,
    ]);
  });

  it('grupo dentro de grupo: cada nível passa pelas barras do seu grupo', () => {
    const graph = graphOf(nestedDraft());
    expect(graph.order).toEqual(['grp_campanha', 'grp_pontuacao', 'td_elegibilidade', 'calc_pontos', 'calc_bonus']);
    expect(graph.groups.map((view) => [view.group.id, view.parent, view.blockCount])).toEqual([
      ['grp_campanha', null, 2],
      ['grp_pontuacao', 'grp_campanha', 2],
    ]);
    expect(linksOf(nestedDraft())).toEqual([
      `${INPUTS_ID}|var:categoria -> grp_campanha|in:categoria`,
      `${INPUTS_ID}|var:valor_item -> grp_campanha|in:valor_item`,
      'grp_pontuacao|out:pontos -> grp_campanha|inner-out:pontos',
      'grp_campanha|inner-in:categoria -> grp_pontuacao|in:categoria',
      'grp_campanha|inner-in:valor_item -> grp_pontuacao|in:valor_item',
      'calc_pontos|out:pontos -> grp_pontuacao|inner-out:pontos',
      'grp_pontuacao|inner-in:categoria -> td_elegibilidade|in:categoria',
      'td_elegibilidade|out:fator -> calc_pontos|in:fator',
      'grp_pontuacao|inner-in:valor_item -> calc_pontos|in:valor_item',
      'grp_campanha|out:pontos -> calc_bonus|in:pontos',
      `calc_bonus|out:bonus -> ${OUTPUT_ID}|field:0`,
    ]);
  });

  it('o bloco Fonte tem portas de ligação (o que ele lê) e de saída (as variáveis que traz)', () => {
    const graph = graphOf(withSourceAndEmptyGroup());
    const source = graph.blocks.find((view) => view.block.id === 'produto')!;
    expect(source.reads.map((port) => [port.label, port.type])).toEqual([['categoria', 'text']]);
    expect(source.outputs.map((port) => [port.handle, port.label, port.type])).toEqual([['out:limite', 'limite', 'decimal(2)']]);
    expect(linksOf(withSourceAndEmptyGroup())).toContain(`${INPUTS_ID}|var:categoria -> produto|in:categoria`);
  });

  it('a barra Saída fica à direita do grupo inteiro', () => {
    const draft = nestedDraft();
    draft.definition.root.nodes = draft.definition.root.nodes.slice(0, 1);
    const graph = graphOf(draft);
    // Campanha holds Pontuação (with two blocks 240 apart): much wider than a block.
    expect(graph.outputPosition.x).toBeGreaterThan(800);
  });
});

describe('readersOf com grupos', () => {
  it('conta quem lê o Output do grupo e não conta os nós que saem com ele', () => {
    const draft = groupedDraft();
    expect(readersOf('grp_pontuacao', draft.definition, [], draft.dependencies)).toBe(1);
    expect(readersOf('td_elegibilidade', draft.definition, draft.symbols, draft.dependencies)).toBe(1);
  });
});
