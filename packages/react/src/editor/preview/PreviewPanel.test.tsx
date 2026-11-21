import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { clearSessionData } from '../../session';
import {
  DRAFT,
  DRAFT_WITHOUT_BATCH_SOURCE,
  PARAMETER_TABLE_ROWS,
  PREVIEW,
  PREVIEW_ROUTE,
  PROBLEM,
  SAVE_ROUTE,
  SCHEMA_DRIFT,
  SOURCE_READ_DENIED,
  json,
  problem,
  renderTab,
  simulateApi,
  type SimulatedApi,
} from './preview.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const runButton = () => screen.getByRole('button', { name: 'Rodar prévia' });
const selection = () => screen.getByRole('status', { name: 'Seleção' });

function sourceItem(name: string): HTMLElement {
  return screen.getByRole('button', { name: `${name}: selecionar no canvas` }).closest('li')!;
}

describe('aba Prévia: estados', () => {
  it('vazio: diz o que falta antes da primeira prévia', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Prévia' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma prévia ainda')).toBeInTheDocument();
    expect(screen.getByText(/Clique em Rodar prévia para ver as contagens/)).toBeInTheDocument();
    expect(runButton()).toBeEnabled();
  });

  it('carregando: mostra o esqueleto enquanto a prévia roda', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(PREVIEW_ROUTE, () => new Promise<Response>((resolve) => (release = resolve)));
    const { user } = renderTab();
    await user.click(runButton());
    const loading = (await screen.findByText('Rodando a prévia')).closest('[role="status"]')!;
    expect(loading.querySelectorAll('.fc-skeleton').length).toBeGreaterThan(3);
    expect(runButton()).toHaveAttribute('aria-busy', 'true');
    release(json(PREVIEW));
    expect(await screen.findByText('Contagens sobre os primeiros 500 registros.')).toBeInTheDocument();
    expect(screen.queryByText('Rodando a prévia')).not.toBeInTheDocument();
  });

  it('erro da rota: mostra a mensagem da API', async () => {
    api.respond(PREVIEW_ROUTE, problem(409, 'connection_credential_unreadable'));
    const { user } = renderTab();
    await user.click(runButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível rodar a prévia');
    expect(alert).toHaveTextContent('Texto do servidor para connection_credential_unreadable.');
  });

  it('erro de rascunho com problemas: manda resolver na aba Problemas', async () => {
    api.respond(PREVIEW_ROUTE, problem(409, 'draft_has_problems', { problems: [PROBLEM] }));
    const { user } = renderTab();
    await user.click(runButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Resolva 1 problema na aba Problemas e rode a prévia de novo.');
  });

  it('conflito de revisão: oferece recarregar o rascunho e desabilita o botão', async () => {
    api.respond(PREVIEW_ROUTE, problem(409, 'draft_conflict', { current_revision: 5 }));
    const { user } = renderTab();
    await user.click(runButton());
    expect(await screen.findByText('Este rascunho mudou em outra aba ou por outra pessoa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar rascunho' })).toBeInTheDocument();
    expect(runButton()).toHaveAccessibleDescription('Recarregue o rascunho para rodar a prévia');
  });

  it('resultado: contagens com ponto e palavra, chaves de exemplo e a amostra', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    expect(await screen.findByText('Contagens sobre os primeiros 500 registros.')).toBeInTheDocument();

    const produtos = sourceItem('Produtos');
    const counts = within(produtos).getByRole('list', { name: 'Contagens de Produtos' });
    expect(within(counts).getByText('480 encontrados')).toBeInTheDocument();
    expect(within(counts).getByText('12 sem correspondência')).toBeInTheDocument();
    expect(within(counts).getByText('8 com mais de uma linha (máx. 3)')).toBeInTheDocument();
    // Dot + word (estilos §7.5): no line with "Gerar erro" is an error; more than one with "Aceitar a primeira" a warning.
    expect(within(counts).getByText('480 encontrados').closest('.fc-status')).toHaveClass('fc-status-green');
    expect(within(counts).getByText('12 sem correspondência').closest('.fc-status')).toHaveClass('fc-status-red');
    expect(within(counts).getByText('8 com mais de uma linha (máx. 3)').closest('.fc-status')).toHaveClass('fc-status-amber');

    const noMatch = within(produtos).getByRole('list', { name: 'Sem correspondência em Produtos: chaves de exemplo' });
    expect(within(noMatch).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['nf_id 17 · item_seq 2', 'nf_id 23 · item_seq 1']);
    const multiple = within(produtos).getByRole('list', { name: 'Com mais de uma linha em Produtos: chaves de exemplo' });
    expect(within(multiple).getByText('nf_id 12 · item_seq 3')).toBeInTheDocument();

    const sample = within(produtos).getByRole('table', { name: 'Amostra de Produtos' });
    expect(within(sample).getByRole('columnheader', { name: 'categoria' })).toBeInTheDocument();
    expect(within(sample).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['A', 'B']);
    // The sample scrolls sideways inside its own box, reachable by the keyboard.
    expect(within(produtos).getByRole('region', { name: 'Amostra de Produtos' })).toHaveAttribute('tabindex', '0');
    expect(sample).toHaveClass('fc-preview-table');
  });

  it('resultado do filtro e da tabela de parâmetros: as contagens do modo e os valores no padrão brasileiro', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    const campanha = await screen.findByRole('list', { name: 'Contagens de Produtos da campanha' });
    expect(within(campanha).getByText('450 passaram no filtro')).toBeInTheDocument();
    expect(within(campanha).getByText('50 filtrados').closest('.fc-status')).toHaveClass('fc-status-multi');

    const fatores = sourceItem('Fatores');
    const counts = within(fatores).getByRole('list', { name: 'Contagens de Fatores' });
    expect(within(counts).getByText('1.480 encontrados')).toBeInTheDocument();
    expect(within(counts).getByText('0 sem correspondência').closest('.fc-status')).toHaveClass('fc-status-gray');
    expect(within(counts).getByText('0 com mais de uma linha')).toBeInTheDocument();
    expect(within(fatores).queryByRole('list', { name: /chaves de exemplo/ })).not.toBeInTheDocument();
    expect(within(fatores).getByRole('cell', { name: '0,1500' })).toBeInTheDocument();
  });

  it('no bloco que virou Filtro, a política não vale: as contagens da prévia ficam em ponto neutro', async () => {
    const produto = DRAFT.definition.root.nodes.find((node) => node.id === 'produto');
    if (produto?.type !== 'source') throw new Error('expected the Fonte "produto"');
    const filter: Schemas['FilterSourceNode'] = {
      id: produto.id,
      type: 'source',
      name: produto.name,
      description: null,
      position: produto.position,
      mode: 'filter',
      dataset_id: produto.dataset_id,
      links: produto.links,
      filters: [],
      exists: true,
    };
    const draft: Schemas['Draft'] = {
      ...DRAFT,
      definition: { ...DRAFT.definition, root: { ...DRAFT.definition.root, nodes: DRAFT.definition.root.nodes.map((node) => (node.id === 'produto' ? filter : node)) } },
    };
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab({ draft });
    await user.click(runButton());
    const counts = await screen.findByRole('list', { name: 'Contagens de Produtos' });
    expect(within(counts).getByText('12 sem correspondência').closest('.fc-status')).toHaveClass('fc-status-gray');
    expect(within(counts).getByText('8 com mais de uma linha (máx. 3)').closest('.fc-status')).toHaveClass('fc-status-gray');
  });

  it('resultado por grupo: os registros de exemplo com Input e Output lado a lado', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());

    const root = await screen.findByRole('table', { name: 'Registros de exemplo de Workflow' });
    expect(within(root).getByRole('columnheader', { name: 'Input' })).toHaveAttribute('colspan', '5');
    expect(within(root).getByRole('columnheader', { name: 'Output' })).toHaveAttribute('colspan', '1');
    expect(within(root).getByRole('columnheader', { name: 'pontos_item' })).toBeInTheDocument();
    const [first, second] = within(root).getAllByRole('row').slice(2);
    expect(within(first!).getByRole('rowheader')).toHaveTextContent('nf_id 10 · item_seq 1');
    expect(within(first!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['ok', '10', '1', 'P-001', '1.500,00', '05/10/2026', '225,00']);
    // The record that did not reach the end has no Output.
    expect(within(second!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['filtrado', '10', '2', 'P-207', '80,00', '05/10/2026', '—']);

    const group = screen.getByRole('table', { name: 'Registros de exemplo de Pontuação' });
    expect(within(group).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Registro',
      'Situação',
      'Input',
      'Output',
      'fator',
      'valor_item',
      'pontos',
    ]);
    expect(within(group).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['ok', '0,1500', '1.500,00', '225,00']);
  });

  it('a fonte do lote sem registros diz o que conferir', async () => {
    api.respond(PREVIEW_ROUTE, json({ ...PREVIEW, counted_records: 0, sources: [], groups: [{ node_id: null, records: [] }] }));
    const { user } = renderTab();
    await user.click(runButton());
    expect(await screen.findByText('A fonte do lote não trouxe nenhum registro. Confira os filtros da fonte do lote.')).toBeInTheDocument();
  });
});

describe('aba Prévia: Rodar prévia', () => {
  it('salva o rascunho pendente antes de chamar a rota, com a revisão salva', async () => {
    api.respond(SAVE_ROUTE, json({ ...DRAFT, revision: 4 }));
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Renomear Produtos' }));
    await user.click(runButton());
    await screen.findByText('Contagens sobre os primeiros 500 registros.');
    const routes = api.routes().filter((route) => route === SAVE_ROUTE || route === PREVIEW_ROUTE);
    expect(routes).toEqual([SAVE_ROUTE, PREVIEW_ROUTE]);
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([{ revision: 4, sample_size: 20 }]);
    // The block is named as it was saved.
    expect(screen.getByRole('button', { name: 'Produtos do ERP: selecionar no canvas' })).toBeInTheDocument();
  });

  it('sem nada pendente, roda a revisão atual sem salvar', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    await screen.findByText('Contagens sobre os primeiros 500 registros.');
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([{ revision: 3, sample_size: 20 }]);
  });

  it('se o rascunho não salvar, não roda e diz o porquê', async () => {
    api.respond(SAVE_ROUTE, problem(500, 'unexpected_error'));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Renomear Produtos' }));
    await user.click(runButton());
    expect(await screen.findByText('O rascunho não foi salvo')).toBeInTheDocument();
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([]);
  });

  it('só leitura (Aprovador): roda a prévia sem salvar', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab({ readOnly: true });
    await user.click(runButton());
    expect(await screen.findByText('480 encontrados')).toBeInTheDocument();
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });

  it('fica desabilitado com o motivo enquanto o rascunho tem problemas', async () => {
    const { user } = renderTab({ draft: { ...DRAFT, problems: [PROBLEM] } });
    expect(runButton()).toHaveAttribute('aria-disabled', 'true');
    expect(runButton()).toHaveAccessibleDescription('Resolva 1 problema para rodar a prévia');
    expect(screen.getByText('Resolva 1 problema para rodar a prévia')).toBeVisible();
    await user.click(runButton());
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([]);
  });

  it('fica desabilitado com o motivo enquanto falta a fonte do lote', async () => {
    const { user } = renderTab({ draft: DRAFT_WITHOUT_BATCH_SOURCE });
    expect(runButton()).toHaveAttribute('aria-disabled', 'true');
    expect(runButton()).toHaveAccessibleDescription('Escolha a fonte do lote para rodar a prévia');
    expect(screen.getByText(/Escolha a fonte do lote no painel do workflow/)).toBeInTheDocument();
    await user.click(runButton());
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([]);
  });

  it('guarda a última prévia ao fechar e abrir a aba, e avisa quando o rascunho mudou', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user, remount } = renderTab();
    await user.click(runButton());
    await screen.findByText('480 encontrados');
    remount();
    expect(screen.getByText('480 encontrados')).toBeInTheDocument();
    expect(screen.queryByText(/Prévia de uma versão anterior/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Renomear Produtos' }));
    expect(screen.getByText('Prévia de uma versão anterior do rascunho. Rode a prévia de novo para ver a atual.')).toBeInTheDocument();
  });

  it('esquece a última prévia quando a sessão sai do módulo', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user, queryClient } = renderTab();
    await user.click(runButton());
    await screen.findByText('480 encontrados');
    clearSessionData(queryClient);
    await waitFor(() => expect(screen.queryByText('480 encontrados')).not.toBeInTheDocument());
  });
});

describe('aba Prévia: seleção no canvas', () => {
  it('o nome do bloco Fonte e do grupo selecionam-no no canvas', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    await user.click(await screen.findByRole('button', { name: 'Produtos: selecionar no canvas' }));
    expect(selection()).toHaveTextContent('node:produto');
    await user.click(screen.getByRole('button', { name: 'Pontuação: selecionar no canvas' }));
    expect(selection()).toHaveTextContent('node:grp_pontuacao');
  });

  it('pelo teclado, com Enter', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    (await screen.findByRole('button', { name: 'Fatores: selecionar no canvas' })).focus();
    await user.keyboard('{Enter}');
    expect(selection()).toHaveTextContent('node:fatores');
  });

  it('um bloco removido depois da prévia não é mais selecionável', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab();
    await user.click(runButton());
    await screen.findByRole('button', { name: 'Fatores: selecionar no canvas' });
    await user.click(screen.getByRole('button', { name: 'Remover Fatores' }));
    expect(screen.queryByRole('button', { name: 'Fatores: selecionar no canvas' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Contagens de Fatores' })).toBeInTheDocument();
  });
});

describe('aba Prévia: erros de leitura', () => {
  it('schema_drift: a mensagem da API e a fonte do lote, que se seleciona', async () => {
    api.respond(PREVIEW_ROUTE, json(SCHEMA_DRIFT));
    const { user } = renderTab();
    await user.click(runButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('O dataset mudou na origem');
    expect(alert).toHaveTextContent('`ItensNF.vl_itm` não existe mais na origem.');
    await user.click(within(alert).getByRole('button', { name: 'Fonte do lote: selecionar no canvas' }));
    expect(selection()).toHaveTextContent('inputs');
    expect(screen.queryByText('Contagens sobre os primeiros 500 registros.')).not.toBeInTheDocument();
  });

  it('source_read_denied: a mensagem da API e o nome do bloco', async () => {
    api.respond(PREVIEW_ROUTE, json(SOURCE_READ_DENIED));
    const { user } = renderTab();
    await user.click(runButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sem permissão de leitura na origem');
    expect(alert).toHaveTextContent('O usuário da conexão não pode ler o dataset Produtos. Peça a permissão de leitura (SELECT) a quem cuida do banco.');
    await user.click(within(alert).getByRole('button', { name: 'Produtos: selecionar no canvas' }));
    expect(selection()).toHaveTextContent('node:produto');
  });

  it('parameter_table_rows: a mensagem da API e o nome do bloco', async () => {
    api.respond(PREVIEW_ROUTE, json(PARAMETER_TABLE_ROWS));
    const { user } = renderTab();
    await user.click(runButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A tabela de parâmetros não tem exatamente uma linha');
    expect(alert).toHaveTextContent('A tabela de parâmetros Fatores tem 2 linhas depois dos filtros; ela precisa de exatamente 1.');
    await user.click(within(alert).getByRole('button', { name: 'Fatores: selecionar no canvas' }));
    expect(selection()).toHaveTextContent('node:fatores');
  });
});
