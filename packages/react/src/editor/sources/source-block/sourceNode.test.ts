import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../../api';
import {
  findSourceNode,
  linkCandidates,
  locateNode,
  toFilterMode,
  toLinearMode,
  updateSourceNode,
  variableNameCounts,
  withDataset,
} from './sourceNode';
import { PRODUTOS, PRODUTOS_2024, SEM_VARIAVEIS, VARIABLES, campanha, produto, sourceDraft, variableId } from './source-block.test-support';

function withGroup(): Schemas['WorkflowDefinition'] {
  const definition = sourceDraft([campanha()]).definition;
  definition.root.nodes.push({
    id: 'grp_pontuacao',
    type: 'group',
    name: 'Pontuação',
    description: null,
    position: { x: 0, y: 0 },
    collapsed: false,
    nodes: [produto()],
    outputs: ['categoria'],
  });
  return definition;
}

describe('o bloco Fonte na definição', () => {
  it('acha o bloco e o caminho dele também dentro de um grupo', () => {
    const definition = withGroup();
    expect(locateNode(definition, 'produto')).toMatchObject({ path: 'root.nodes[2].nodes[0]', groups: ['grp_pontuacao'] });
    expect(locateNode(definition, 'campanha')).toMatchObject({ path: 'root.nodes[0]', groups: [] });
    expect(findSourceNode(definition, 'produto')?.name).toBe('Produto');
    expect(findSourceNode(definition, 'calc_pontos')).toBeNull();
  });

  it('muda o bloco dentro do grupo e mantém o resto como estava', () => {
    const definition = withGroup();
    const next = updateSourceNode(definition, 'produto', (node) => ({ ...node, name: 'Produto atual' }));
    expect(findSourceNode(next, 'produto')?.name).toBe('Produto atual');
    expect(next.root.nodes[0]).toBe(definition.root.nodes[0]);
    expect(updateSourceNode(definition, 'nada', (node) => node)).toBe(definition);
  });

  it('no Filtro, tira a ordenação, a saída e as políticas, e confere EXISTE', () => {
    const node = toFilterMode(produto());
    expect(node.mode).toBe('filter');
    expect(node.exists).toBe(true);
    for (const field of ['order_by', 'outputs', 'no_match', 'multiple_rows']) expect(node).not.toHaveProperty(field);
    expect(node.links).toEqual(produto().links);
  });

  it('no Linear, ganha a primeira variável como ordenação, todas como saída e "Gerar erro" nas políticas', () => {
    const node = toLinearMode(campanha(), VARIABLES[PRODUTOS]!);
    expect(node).toMatchObject({
      mode: 'linear',
      exists: null,
      no_match: 'error',
      multiple_rows: 'error',
      order_by: [{ variable_id: variableId(PRODUTOS, 'codigo'), direction: 'asc' }],
    });
    expect(node?.outputs.map((output) => output.name)).toEqual(['codigo', 'vigencia_inicio', 'categoria', 'preco', 'ativo', 'estoque', 'atualizado_em']);
    expect(toLinearMode(campanha(), [])).toBeNull();
  });

  it('ao trocar o dataset, usa as variáveis de mesmo nome e diz o que sai', () => {
    const node = produto({
      filters: [
        { variable_id: variableId(PRODUTOS, 'categoria'), operator: '=', values: ['"A"'] },
        { variable_id: variableId(PRODUTOS, 'preco'), operator: '>', values: ['10'] },
      ],
    });
    const change = withDataset(node, PRODUTOS_2024, VARIABLES[PRODUTOS]!, VARIABLES[PRODUTOS_2024]!);
    expect(change.node).toMatchObject({
      dataset_id: PRODUTOS_2024,
      links: [{ variable: 'cod_prod', column_variable_id: variableId(PRODUTOS_2024, 'codigo') }],
      filters: [{ variable_id: variableId(PRODUTOS_2024, 'categoria'), operator: '=', values: ['"A"'] }],
      // `vigencia_inicio` is not there: the ordering gets the default.
      order_by: [{ variable_id: variableId(PRODUTOS_2024, 'codigo'), direction: 'asc' }],
      outputs: [{ variable_id: variableId(PRODUTOS_2024, 'categoria'), name: 'categoria' }],
    });
    expect(change.dropped).toEqual({ filters: 1, order: 1, outputs: 0 });
    expect(change.unlinked).toBe(0);
    expect(withDataset(node, SEM_VARIAVEIS, VARIABLES[PRODUTOS]!, []).node).toBeNull();
  });

  it('ao trocar o dataset, a variável de mesmo nome mas de outro tipo ou outras casas sai do bloco', () => {
    const node = produto({
      filters: [{ variable_id: variableId(PRODUTOS, 'estoque'), operator: '>', values: ['0'] }],
      outputs: [
        { variable_id: variableId(PRODUTOS, 'categoria'), name: 'categoria' },
        { variable_id: variableId(PRODUTOS, 'preco'), name: 'preco' },
      ],
    });
    const change = withDataset(node, PRODUTOS_2024, VARIABLES[PRODUTOS]!, VARIABLES[PRODUTOS_2024]!);
    // `estoque` is text and `preco` has 4 places in Produtos 2024.
    expect(change.node?.filters).toEqual([]);
    expect((change.node?.mode === 'linear' ? change.node.outputs : undefined)).toEqual([{ variable_id: variableId(PRODUTOS_2024, 'categoria'), name: 'categoria' }]);
    expect(change.dropped).toEqual({ filters: 1, order: 1, outputs: 1 });
  });

  it('num Filtro, a ligação sem variável de mesmo nome fica e é contada', () => {
    const change = withDataset(campanha(), PRODUTOS, VARIABLES[PRODUTOS]!, VARIABLES[PRODUTOS]!);
    expect(change.unlinked).toBe(1);
    expect(change.node?.links).toEqual(campanha().links);
  });

  it('oferece à ligação só as variáveis lidas, lineares e visíveis, nunca as do próprio bloco', () => {
    const { symbols } = sourceDraft();
    expect(linkCandidates(symbols, 'campanha', []).map((symbol) => symbol.name)).toEqual(['nf_id', 'cod_prod', 'loja_id', 'valor_item', 'categoria']);
    expect(linkCandidates(symbols, 'produto', []).map((symbol) => symbol.name)).not.toContain('categoria');
    expect(linkCandidates(symbols, 'produto', ['grp_metas']).map((symbol) => symbol.name)).toContain('meta');
  });

  it('conta os nomes de variável do workflow, com a fonte do lote e as saídas das fontes', () => {
    const counts = variableNameCounts(withGroup());
    expect(counts.get('cod_prod')).toBe(1);
    expect(counts.get('categoria')).toBe(1);
    expect(counts.get('pontos')).toBe(1);
  });
});
