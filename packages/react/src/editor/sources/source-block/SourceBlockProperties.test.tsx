import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPANHA,
  PRODUTOS,
  PRODUTOS_2024,
  SEM_VARIAVEIS,
  VARIABLES,
  campanha,
  choose,
  currentSource,
  problem,
  produto,
  renderSource,
  scoped,
  simulateApi,
  sourceDraft,
  variableId,
} from './source-block.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Waits for the catalog: the dataset select and the variables' sections. */
async function loaded() {
  await screen.findByRole('combobox', { name: scoped('Dataset') });
  await screen.findByRole('group', { name: 'Filtros' });
}

describe('propriedades do bloco Fonte', () => {
  it('mostra cada campo do Linear: dataset com o tipo, modo, ligações, filtros, ordenação, as duas políticas e a saída', async () => {
    simulateApi();
    renderSource();
    await loaded();

    expect(screen.getByRole('heading', { name: 'Fonte' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: scoped('Nome do bloco') })).toHaveValue('Produto');
    expect(screen.getByRole('combobox', { name: scoped('Dataset') })).toHaveTextContent('Produtos · Tabela');
    expect(screen.getByRole('radio', { name: 'Linear' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Variável do workflow (ligação 1)' })).toHaveTextContent('cod_prod · Texto');
    expect(screen.getByRole('combobox', { name: 'Variável do dataset (ligação 1)' })).toHaveTextContent('codigo · Texto');
    expect(screen.getByText('Nenhum filtro: todas as linhas do dataset entram.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Variável (critério 1)' })).toHaveTextContent('vigencia_inicio · Data');
    expect(screen.getByRole('combobox', { name: 'Direção (critério 1)' })).toHaveTextContent('Decrescente');
    expect(screen.getByRole('combobox', { name: scoped('Sem correspondência') })).toHaveTextContent('Gerar erro');
    expect(screen.getByRole('combobox', { name: scoped('Mais de uma linha') })).toHaveTextContent('Gerar erro');
    expect(screen.getByRole('checkbox', { name: /^categoria/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^preco/ })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Nome no workflow (categoria)' })).toHaveValue('categoria');
  });

  it('muda o nome e a descrição do bloco no rascunho', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    const name = screen.getByRole('textbox', { name: scoped('Nome do bloco') });
    await user.clear(name);
    expect(screen.getByText(/Informe o nome do bloco\./)).toBeInTheDocument();
    expect(currentSource().name).toBe('Produto');
    await user.type(name, 'Produto vigente');
    expect(currentSource().name).toBe('Produto vigente');

    await user.type(screen.getByRole('textbox', { name: scoped('Descrição curta') }), 'Categoria do produto');
    expect(currentSource().description).toBe('Categoria do produto');
  });

  it('troca o dataset depois da confirmação, com as variáveis de mesmo nome, e diz o que sai do bloco', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await choose(user, scoped('Dataset'), 'Produtos 2024 · Excel');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar dataset' });
    expect(await within(dialog).findByText('O bloco passa a usar as variáveis de mesmo nome e mesmo tipo em Produtos 2024.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sem variável de mesmo nome e mesmo tipo, saem do bloco: 1 critério de ordenação.')).toBeInTheDocument();
    expect(currentSource().dataset_id).toBe(PRODUTOS);

    await user.click(within(dialog).getByRole('button', { name: 'Trocar dataset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentSource()).toMatchObject({
      dataset_id: PRODUTOS_2024,
      links: [{ variable: 'cod_prod', column_variable_id: variableId(PRODUTOS_2024, 'codigo') }],
      order_by: [{ variable_id: variableId(PRODUTOS_2024, 'codigo'), direction: 'asc' }],
      outputs: [{ variable_id: variableId(PRODUTOS_2024, 'categoria'), name: 'categoria' }],
    });
  });

  it('na troca de dataset, lista entre as que saem a variável de mesmo nome com outro tipo ou outras casas', async () => {
    simulateApi();
    const { user } = renderSource({
      draft: sourceDraft([
        produto({
          filters: [{ variable_id: variableId(PRODUTOS, 'estoque'), operator: '>', values: ['0'] }],
          outputs: [
            { variable_id: variableId(PRODUTOS, 'categoria'), name: 'categoria' },
            { variable_id: variableId(PRODUTOS, 'preco'), name: 'preco' },
          ],
        }),
      ]),
    });
    await loaded();

    await choose(user, scoped('Dataset'), 'Produtos 2024 · Excel');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar dataset' });
    expect(
      await within(dialog).findByText('Sem variável de mesmo nome e mesmo tipo, saem do bloco: 1 filtro, 1 critério de ordenação e 1 variável da saída.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Trocar dataset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentSource()).toMatchObject({
      filters: [],
      outputs: [{ variable_id: variableId(PRODUTOS_2024, 'categoria'), name: 'categoria' }],
    });
  });

  it('cancelar a troca de dataset não muda o bloco', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await choose(user, scoped('Dataset'), 'Produtos 2024 · Excel');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentSource().dataset_id).toBe(PRODUTOS);
  });

  it('não troca para um dataset sem variáveis num Linear', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await choose(user, scoped('Dataset'), 'Sem variáveis · SQL');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar dataset' });
    expect(await within(dialog).findByText(/O dataset Sem variáveis não tem variáveis\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Trocar dataset' })).toHaveAttribute('aria-disabled', 'true');
    expect(SEM_VARIAVEIS).not.toBe(currentSource().dataset_id);
  });

  it('no modo Filtro, esconde a ordenação, as políticas e a saída, e mostra EXISTE / NÃO EXISTE', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await user.click(screen.getByRole('radio', { name: 'Filtro' }));
    expect(currentSource()).toMatchObject({ mode: 'filter', exists: true });
    for (const field of ['order_by', 'outputs', 'no_match', 'multiple_rows']) expect(currentSource()).not.toHaveProperty(field);

    expect(screen.queryByRole('group', { name: 'Ordenação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: scoped('Sem correspondência') })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: scoped('Mais de uma linha') })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Saída' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: scoped('Dataset') })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ligações' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'EXISTE' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'NÃO EXISTE' }));
    expect(currentSource().exists).toBe(false);
    // The Filtro needs its link: the last one cannot be removed.
    expect(screen.getByRole('button', { name: 'Remover ligação (ligação 1)' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('volta do Filtro para o Linear com a ordenação e a saída padrão', async () => {
    simulateApi();
    const { user } = renderSource({ id: 'campanha' });
    await loaded();

    expect(screen.getByRole('radio', { name: 'Filtro' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Linear' }));
    expect(currentSource('campanha')).toMatchObject({
      mode: 'linear',
      exists: null,
      no_match: 'error',
      multiple_rows: 'error',
      order_by: [{ variable_id: variableId(CAMPANHA, 'cod_prod'), direction: 'asc' }],
      outputs: VARIABLES[CAMPANHA]!.map((variable) => ({ variable_id: variable.id, name: variable.name })),
    });
  });

  it('não passa para o Filtro sem ligação e mostra a tabela de parâmetros com a nota', async () => {
    simulateApi();
    const { user } = renderSource({ draft: sourceDraft([produto({ links: [] })]) });
    await loaded();

    const note = screen.getByRole('note', { name: 'Tabela de parâmetros' });
    expect(note).toHaveTextContent('O dataset precisa ter exatamente uma linha depois dos filtros');
    await user.click(screen.getByRole('radio', { name: 'Filtro' }));
    expect(screen.getByText(/Inclua uma ligação antes de usar o modo Filtro/)).toBeInTheDocument();
    expect(currentSource().mode).toBe('linear');
  });

  it('inclui, muda e remove ligações, só com as variáveis lidas, e avisa os tipos diferentes', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await user.click(screen.getByRole('button', { name: 'Incluir ligação' }));
    expect(currentSource().links).toEqual([
      { variable: 'cod_prod', column_variable_id: variableId(PRODUTOS, 'codigo') },
      { variable: 'nf_id', column_variable_id: variableId(PRODUTOS, 'codigo') },
    ]);

    await user.click(screen.getByRole('combobox', { name: 'Variável do workflow (ligação 2)' }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    // A calculated variable (`pontos`), the block's own output and one inside another group are not offered.
    expect(options).toEqual(['nf_id · Texto', 'cod_prod · Texto', 'loja_id · Inteiro', 'valor_item · Decimal']);
    await user.click(screen.getByRole('option', { name: 'loja_id · Inteiro' }));
    expect(currentSource().links[1]?.variable).toBe('loja_id');
    expect(screen.getByText(/Os tipos são diferentes: Inteiro e Texto\./)).toBeInTheDocument();

    await choose(user, 'Variável do dataset (ligação 2)', 'estoque · Inteiro');
    expect(currentSource().links[1]?.column_variable_id).toBe(variableId(PRODUTOS, 'estoque'));
    expect(screen.queryByText(/Os tipos são diferentes/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover ligação (ligação 1)' }));
    expect(currentSource().links).toEqual([{ variable: 'loja_id', column_variable_id: variableId(PRODUTOS, 'estoque') }]);
  });

  it('mostra link_to_calculated e not_visible na variável da ligação e link_type_mismatch na ligação', async () => {
    simulateApi();
    renderSource({
      draft: sourceDraft(
        [
          produto({
            links: [
              { variable: 'pontos', column_variable_id: variableId(PRODUTOS, 'preco') },
              { variable: 'meta', column_variable_id: variableId(PRODUTOS, 'preco') },
              { variable: 'loja_id', column_variable_id: variableId(PRODUTOS, 'codigo') },
            ],
          }),
        ],
        {
          problems: [
            problem('link_to_calculated', 'pontos é calculada: a ligação usa só variáveis lidas.', 'root.nodes[0].links[0].variable', 'produto'),
            problem('not_visible', 'meta existe, mas não é visível aqui. Ela está dentro do grupo Metas.', 'root.nodes[0].links[1].variable', 'produto'),
            problem('link_type_mismatch', 'loja_id é inteiro e codigo é texto.', 'root.nodes[0].links[2]', 'produto'),
          ],
        },
      ),
    });
    await loaded();

    const first = screen.getByRole('combobox', { name: 'Variável do workflow (ligação 1)' });
    expect(first).toHaveAccessibleDescription(/pontos é calculada/);
    expect(first).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Variável do workflow (ligação 2)' })).toHaveAccessibleDescription(/meta existe, mas não é visível aqui/);
    const third = within(screen.getByRole('group', { name: 'Ligação 3' }));
    expect(third.getByText('loja_id é inteiro e codigo é texto.')).toBeInTheDocument();
    // The analysis already says it: the warning before it does not repeat.
    expect(third.queryByText(/Os tipos são diferentes/)).not.toBeInTheDocument();
    // None goes to the top of the panel.
    expect(screen.queryByRole('list', { name: 'Problemas' })).not.toBeInTheDocument();
  });

  it('mostra no topo o problema do bloco que não tem campo na tela', async () => {
    simulateApi();
    renderSource({
      draft: sourceDraft([produto()], { problems: [problem('filter_outside_root', 'O modo Filtro só vale no grupo raiz.', 'root.nodes[0].position', 'produto')] }),
    });
    await loaded();
    expect(within(screen.getByRole('list', { name: 'Problemas' })).getByText('O modo Filtro só vale no grupo raiz.')).toBeInTheDocument();
  });

  it('dentro de um grupo, edita o bloco e acha os problemas pelo caminho aninhado', async () => {
    simulateApi();
    const draft = sourceDraft([], {
      problems: [problem('not_visible', 'loja_id existe, mas não é visível aqui.', 'root.nodes[0].nodes[0].links[0].variable', 'produto')],
    });
    draft.definition.root.nodes.unshift({
      id: 'grp_pontuacao',
      type: 'group',
      name: 'Pontuação',
      description: null,
      position: { x: 0, y: 0 },
      collapsed: false,
      nodes: [produto()],
      outputs: ['categoria'],
    });
    const { user } = renderSource({ draft });
    await loaded();

    expect(screen.getByRole('combobox', { name: 'Variável do workflow (ligação 1)' })).toHaveAccessibleDescription(/loja_id existe, mas não é visível aqui\./);
    await user.type(screen.getByRole('textbox', { name: scoped('Nome do bloco') }), ' atual');
    expect(currentSource().name).toBe('Produto atual');
  });

  it('inclui, ordena e remove critérios de ordenação, sempre com pelo menos um', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    expect(screen.getByRole('button', { name: 'Remover critério (critério 1)' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Incluir critério' }));
    expect(currentSource().order_by).toEqual([
      { variable_id: variableId(PRODUTOS, 'vigencia_inicio'), direction: 'desc' },
      { variable_id: variableId(PRODUTOS, 'codigo'), direction: 'asc' },
    ]);
    await choose(user, 'Direção (critério 2)', 'Decrescente');
    await user.click(screen.getByRole('button', { name: 'Mover para cima (critério 2)' }));
    expect(currentSource().order_by).toEqual([
      { variable_id: variableId(PRODUTOS, 'codigo'), direction: 'desc' },
      { variable_id: variableId(PRODUTOS, 'vigencia_inicio'), direction: 'desc' },
    ]);
    await choose(user, 'Variável (critério 1)', 'preco · Decimal');
    await user.click(screen.getByRole('button', { name: 'Remover critério (critério 2)' }));
    expect(currentSource().order_by).toEqual([{ variable_id: variableId(PRODUTOS, 'preco'), direction: 'desc' }]);
  });

  it('muda o "Sem correspondência"', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await choose(user, scoped('Sem correspondência'), 'Manter vazio');
    expect(currentSource().no_match).toBe('keep_null');
    await choose(user, scoped('Sem correspondência'), 'Descartar o registro');
    expect(currentSource().no_match).toBe('discard');
  });

  it('pede a confirmação para aceitar a primeira linha e não muda nada ao cancelar', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    await choose(user, scoped('Mais de uma linha'), 'Aceitar a primeira linha');
    let dialog = await screen.findByRole('dialog', { name: 'Aceitar a primeira linha' });
    expect(dialog).toHaveAccessibleDescription('Você assume que vale a primeira linha pela ordenação. Isso fica registrado na auditoria.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentSource().multiple_rows).toBe('error');
    await waitFor(() => expect(screen.getByRole('combobox', { name: scoped('Mais de uma linha') })).toHaveFocus());

    await choose(user, scoped('Mais de uma linha'), 'Aceitar a primeira linha');
    dialog = await screen.findByRole('dialog', { name: 'Aceitar a primeira linha' });
    await user.click(within(dialog).getByRole('button', { name: 'Aceitar a primeira linha' }));
    expect(currentSource().multiple_rows).toBe('accept_first');

    // Back to "Gerar erro" needs no confirmation.
    await choose(user, scoped('Mais de uma linha'), 'Gerar erro');
    expect(currentSource().multiple_rows).toBe('error');
  });

  it('marca as variáveis da saída, troca o nome no workflow e não deixa o Linear sem saída', async () => {
    simulateApi();
    const { user } = renderSource();
    await loaded();

    const categoria = screen.getByRole('checkbox', { name: /^categoria/ });
    expect(categoria).toBeDisabled();
    expect(categoria).toHaveAccessibleDescription('A fonte linear precisa de pelo menos uma variável de saída');

    await user.click(screen.getByRole('checkbox', { name: /^preco/ }));
    expect(currentSource().outputs).toEqual([
      { variable_id: variableId(PRODUTOS, 'categoria'), name: 'categoria' },
      { variable_id: variableId(PRODUTOS, 'preco'), name: 'preco' },
    ]);

    const name = screen.getByRole('textbox', { name: 'Nome no workflow (preco)' });
    await user.clear(name);
    await user.type(name, 'Preço');
    expect(screen.getByText(/Use de 1 a 63 caracteres/)).toBeInTheDocument();
    expect(currentSource().outputs?.[1]?.name).toBe('preco');
    await user.clear(name);
    await user.type(name, 'cod_prod');
    expect(screen.getByText('Já existe uma variável com este nome. Escolha outro.')).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, 'preco_tabela');
    expect(currentSource().outputs?.[1]).toEqual({ variable_id: variableId(PRODUTOS, 'preco'), name: 'preco_tabela' });

    await user.click(screen.getByRole('checkbox', { name: /^categoria/ }));
    expect(currentSource().outputs).toEqual([{ variable_id: variableId(PRODUTOS, 'preco'), name: 'preco_tabela' }]);
  });

  it('mostra os problemas da saída no nome da variável', async () => {
    simulateApi();
    renderSource({
      draft: sourceDraft([produto()], {
        problems: [problem('duplicate_name', 'categoria já é uma variável do workflow.', 'root.nodes[0].outputs[0].name', 'produto')],
      }),
    });
    await loaded();
    expect(screen.getByRole('textbox', { name: 'Nome no workflow (categoria)' })).toHaveAccessibleDescription(/categoria já é uma variável do workflow\./);
  });

  it('em só leitura, desabilita todos os campos com o motivo', async () => {
    simulateApi();
    renderSource({ readOnly: true });
    await loaded();

    const reason = 'Você não tem permissão para editar este workflow';
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    for (const field of screen.getAllByRole('textbox')) expect(field).toBeDisabled();
    for (const field of screen.getAllByRole('combobox')) {
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(new RegExp(reason));
    }
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    for (const name of ['Incluir ligação', 'Incluir filtro', 'Incluir critério', 'Remover ligação (ligação 1)']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('mostra o carregamento e o erro do catálogo, com Tentar de novo', async () => {
    const fetch = simulateApi({ datasets: 'error', variables: { [PRODUTOS]: 'error' } });
    const { user } = renderSource();

    expect(await screen.findByText('Não foi possível carregar os datasets do catálogo.')).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível carregar as variáveis do dataset\./)).toBeInTheDocument();

    fetch.mockClear();
    simulateApi();
    const [datasetsRetry] = screen.getAllByRole('button', { name: 'Tentar de novo' });
    await user.click(datasetsRetry!);
    expect(await screen.findByRole('combobox', { name: scoped('Dataset') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('group', { name: 'Filtros' })).toBeInTheDocument();
  });

  it('mostra o esqueleto enquanto o catálogo carrega', async () => {
    simulateApi({ datasets: 'pending', variables: { [PRODUTOS]: 'pending' } });
    renderSource();
    expect(await screen.findByText('Carregando os datasets do catálogo')).toBeInTheDocument();
    expect(screen.getByText('Carregando as variáveis do dataset')).toBeInTheDocument();
  });

  it('abre um Filtro como a API o manda, sem os campos do Linear', async () => {
    simulateApi();
    renderSource({ id: 'campanha', draft: sourceDraft([campanha()]) });
    await loaded();
    expect(screen.getByRole('combobox', { name: scoped('Dataset') })).toHaveTextContent('Produtos da campanha · SQL');
    expect(screen.getByRole('radio', { name: 'EXISTE' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Variável (filtro 1)' })).toHaveTextContent('ativo · Booleano');
    expect(screen.getByRole('combobox', { name: 'Valor (filtro 1)' })).toHaveTextContent('Verdadeiro');
  });
});
