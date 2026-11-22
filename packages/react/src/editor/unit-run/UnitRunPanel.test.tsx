import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT,
  DRAFT_ROUTE,
  PROBLEM,
  RUN_ERROR,
  RUN_OK,
  RUN_ROUTE,
  RUN_WARNINGS,
  SAVE_ROUTE,
  json,
  problem,
  renderTab,
  session,
  simulateApi,
  testQueryClient,
  type SimulatedApi,
} from './unit-run.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const calculate = () => screen.getByRole('button', { name: 'Calcular' });

async function choose(user: ReturnType<typeof renderTab>['user'], field: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('aba Calcular: formulário', () => {
  it('gera um campo por entrada declarada, com o tipo de cada um', async () => {
    renderTab();
    expect(screen.getByRole('textbox', { name: 'valor_item' })).toHaveAccessibleDescription('Número com 2 casas');
    expect(screen.getByRole('textbox', { name: 'categoria' })).toHaveAccessibleDescription('Texto');
    expect(screen.getByRole('textbox', { name: 'quantidade' })).toHaveAccessibleDescription('Número inteiro');
    expect(screen.getByRole('combobox', { name: 'meta_atingida' })).toHaveTextContent('Vazio');
    expect(screen.getByLabelText('data_compra')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('momento')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByText('Lista vazia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Incluir item em pontuacoes' })).toBeInTheDocument();
    expect(screen.getByText('Nenhum cálculo ainda')).toBeInTheDocument();
  });

  it('envia os valores convertidos, com o vazio como nulo e a lista vazia', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await user.paste('1.500,00');
    await user.click(screen.getByRole('textbox', { name: 'categoria' }));
    await user.paste('A');
    await choose(user, 'meta_atingida', 'Falso');
    fireEvent.change(screen.getByLabelText('data_compra'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('momento'), { target: { value: '2026-11-20T10:30:15' } });

    await user.click(calculate());

    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([
      {
        revision: 3,
        inputs: {
          valor_item: '1500.00',
          categoria: 'A',
          meta_atingida: false,
          quantidade: null,
          data_compra: '2026-11-20',
          momento: new Date('2026-11-20T10:30:15').toISOString(),
          pontuacoes: [],
        },
        parameters: {},
      },
    ]);
  });

  it('a múltipla é uma tabela de itens, com incluir e remover', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    expect(screen.getByRole('textbox', { name: 'valor_compra do item 1' })).toHaveFocus();
    await user.paste('100,5');
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await user.click(screen.getByRole('textbox', { name: 'taxa do item 3' }));
    await user.paste('0,15');
    expect(screen.getByText('Lista com 3 itens')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover item 2 de pontuacoes' }));
    expect(screen.getByRole('button', { name: 'Incluir item em pontuacoes' })).toHaveFocus();
    expect(screen.getByRole('table', { name: 'pontuacoes' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'taxa do item 2' })).toHaveValue('0,15');

    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect((api.bodiesTo(RUN_ROUTE)[0] as { inputs: Record<string, unknown> }).inputs.pontuacoes).toEqual([
      { valor_compra: '100.5', taxa: null },
      { valor_compra: null, taxa: '0.15' },
    ]);
  });

  it('recusa 1500,005 numa entrada de 2 casas no próprio campo e não envia', async () => {
    const { user } = renderTab();
    const field = screen.getByRole('textbox', { name: 'valor_item' });
    await user.click(field);
    await user.paste('1500,005');
    expect(field).not.toHaveAttribute('aria-invalid');
    await user.tab();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Use no máximo 2 casas decimais.'));

    await user.click(calculate());
    expect(field).toHaveFocus();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });

  it('ponto com zero antes (0.500) pede vírgula e não envia 500', async () => {
    const { user } = renderTab();
    const field = screen.getByRole('textbox', { name: 'valor_item' });
    await user.click(field);
    await user.paste('0.500');
    await user.click(calculate());
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Use vírgula para separar os decimais'));
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('número só com espaços vai como nulo', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await user.paste('   ');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)[0]).toMatchObject({ inputs: { valor_item: null } });
  });

  it('data incompleta diz para completar e não vai como nula', async () => {
    const { user } = renderTab();
    const date = screen.getByLabelText('data_compra');
    // The browser keeps a half-typed date out of `value` and marks it as `badInput`.
    Object.defineProperty(date, 'validity', { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.blur(date);
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription(expect.stringContaining('Digite a data completa.'));

    await user.click(calculate());
    expect(date).toHaveFocus();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('data e hora incompletas dizem para completar e não vão como nulas', async () => {
    const { user } = renderTab();
    const moment = screen.getByLabelText('momento');
    Object.defineProperty(moment, 'validity', { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.blur(moment);
    expect(moment).toHaveAttribute('aria-invalid', 'true');
    expect(moment).toHaveAccessibleDescription(expect.stringContaining('Digite a data e a hora completas.'));

    await user.click(calculate());
    expect(moment).toHaveFocus();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('data incompleta num item da lista múltipla diz para completar, no campo certo, e não vai como nula', async () => {
    const draft: typeof DRAFT = {
      ...DRAFT,
      definition: {
        ...DRAFT.definition,
        root: {
          ...DRAFT.definition.root,
          inputs: [{ name: 'compras', cardinality: 'multiple', fields: [{ name: 'dia', type: 'date' }] }],
        },
      },
    };
    const { user } = renderTab({ draft });
    await user.click(screen.getByRole('button', { name: 'Incluir item em compras' }));
    const day = screen.getByLabelText('dia do item 1');
    Object.defineProperty(day, 'validity', { configurable: true, value: { badInput: true, valid: false } });
    fireEvent.blur(day);
    expect(day).toHaveAttribute('aria-invalid', 'true');
    expect(day).toHaveAccessibleDescription(expect.stringContaining('Digite a data completa.'));

    await user.click(calculate());
    expect(day).toHaveFocus();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('os nomes do resultado vêm da definição já salva, não de uma renderização atrás', async () => {
    let release: (response: Response) => void = () => {};
    let saves = 0;
    // The first save waits; the one the rename asks for answers at once.
    api.respond(SAVE_ROUTE, () => (saves++ === 0 ? new Promise<Response>((resolve) => (release = resolve)) : Promise.resolve(json({ ...DRAFT, revision: 5 }))));
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Mudar a fórmula' }));
    await user.click(calculate());
    expect(await screen.findByText('Calculando')).toBeInTheDocument();
    // The block is renamed in the same instant the save answers: the run must name it as it is now.
    const rename = screen.getByRole('button', { name: 'Renomear Pontos' });
    await act(async () => {
      fireEvent.click(rename);
      release(json({ ...DRAFT, revision: 4 }));
    });

    await screen.findByRole('heading', { name: 'Resultado' });
    expect(screen.getByRole('button', { name: 'Pontos renomeado: selecionar no canvas' })).toBeInTheDocument();
  });

  it('o erro de um item da lista aparece depois de Calcular, no campo certo', async () => {
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await user.click(screen.getByRole('textbox', { name: 'taxa do item 1' }));
    await user.paste('0,12345');
    await user.click(calculate());
    const taxa = screen.getByRole('textbox', { name: 'taxa do item 1' });
    expect(taxa).toHaveAttribute('aria-invalid', 'true');
    expect(taxa).toHaveFocus();
    expect(screen.getByText('Use no máximo 4 casas decimais.')).toBeInTheDocument();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });
});

describe('aba Calcular: botão', () => {
  it('fica desabilitado com o motivo enquanto houver problema', async () => {
    const { user } = renderTab({ draft: { ...DRAFT, problems: [PROBLEM] } });
    const button = calculate();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Resolva 1 problema para calcular');
    expect(screen.getByText('Resolva 1 problema para calcular')).toBeVisible();
    await user.click(button);
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('diz quantos problemas há, no plural', () => {
    renderTab({ draft: { ...DRAFT, problems: [PROBLEM, { ...PROBLEM, start: 0, end: 3 }] } });
    expect(calculate()).toHaveAccessibleDescription('Resolva 2 problemas para calcular');
  });

  it('salva o rascunho pendente antes de rodar, e roda a revisão salva', async () => {
    api.respond(SAVE_ROUTE, json({ ...DRAFT, revision: 4 }));
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Mudar a fórmula' }));
    await user.click(calculate());

    await screen.findByRole('heading', { name: 'Resultado' });
    const routes = api.routes().filter((route) => route === SAVE_ROUTE || route === RUN_ROUTE);
    expect(routes).toEqual([SAVE_ROUTE, RUN_ROUTE]);
    expect(api.bodiesTo(RUN_ROUTE)[0]).toMatchObject({ revision: 4 });
  });

  it('trava os valores enquanto salva e envia os valores da tela depois de salvar', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(SAVE_ROUTE, () => new Promise<Response>((resolve) => (release = resolve)));
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    const field = screen.getByRole('textbox', { name: 'valor_item' });
    await user.click(field);
    await user.paste('10,00');
    await user.click(screen.getByRole('button', { name: 'Mudar a fórmula' }));
    await user.click(calculate());

    expect(await screen.findByText('Calculando')).toBeInTheDocument();
    expect(field).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Incluir item em pontuacoes' })).toBeDisabled();
    await act(async () => release(json({ ...DRAFT, revision: 4 })));

    await screen.findByRole('heading', { name: 'Resultado' });
    expect(field).toBeEnabled();
    expect(api.bodiesTo(RUN_ROUTE)[0]).toMatchObject({ revision: 4, inputs: { valor_item: '10.00' } });
  });

  it('sem nada pendente, roda direto, sem salvar', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });

  it('se o rascunho não salvar, não roda e diz o porquê', async () => {
    api.respond(SAVE_ROUTE, problem(500, 'unexpected_error'));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Mudar a fórmula' }));
    await user.click(calculate());
    expect(await screen.findByText('O rascunho não foi salvo')).toBeInTheDocument();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('com o draft_conflict ao salvar, não roda e pede para recarregar', async () => {
    api.respond(SAVE_ROUTE, problem(409, 'draft_conflict', { current_revision: 5 }));
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Mudar a fórmula' }));
    await user.click(calculate());
    expect(await screen.findByText('O rascunho não foi salvo')).toBeInTheDocument();
    expect(calculate()).toHaveAccessibleDescription('Recarregue o rascunho para calcular');
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('só leitura (simulations.run) roda a revisão aberta, sem salvar', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab({ readOnly: true });
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)[0]).toMatchObject({ revision: 3 });
    expect(api.bodiesTo(SAVE_ROUTE)).toEqual([]);
  });
});

describe('aba Calcular: resultado', () => {
  it('ok: status, saídas no padrão brasileiro e cada bloco com os valores e a regra', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(calculate());

    await screen.findByRole('heading', { name: 'Resultado' });
    const outputs = screen.getByRole('region', { name: 'Saídas' });
    expect(within(outputs).getByText('pontos').nextSibling).toHaveTextContent('1.225,50');
    expect(within(outputs).getByText('elegivel').nextSibling).toHaveTextContent('verdadeiro');

    const blocks = screen.getByRole('region', { name: 'Blocos' });
    const items = within(blocks).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('ok');
    expect(items[0]).toHaveTextContent('Elegibilidade');
    expect(items[0]).toHaveTextContent('Regra 2');
    expect(within(items[0]!).getByText('fator').nextSibling).toHaveTextContent('0,1500');
    expect(within(items[1]!).getByText('pontos_historico').nextSibling).toHaveTextContent('12,00');
    expect(items[1]).not.toHaveTextContent('Regra');
    expect(screen.getByText('Resultado do cálculo: ok')).toBeInTheDocument();
  });

  it('o nome do bloco seleciona-o no canvas', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    await user.click(calculate());
    await user.click(await screen.findByRole('button', { name: 'Pontos: selecionar no canvas' }));
    expect(screen.getByRole('status', { name: 'Seleção' })).toHaveTextContent('node:calc_pontos');
  });

  it('ok_with_warnings: status com avisos e o aviso no bloco', async () => {
    api.respond(RUN_ROUTE, json(RUN_WARNINGS));
    const { user } = renderTab();
    await user.click(calculate());

    await screen.findByRole('heading', { name: 'Resultado' });
    expect(screen.getByText('Resultado do cálculo: com avisos')).toBeInTheDocument();
    const historico = within(screen.getByRole('region', { name: 'Blocos' })).getAllByRole('listitem')[1]!;
    expect(historico).toHaveTextContent('com avisos');
    const warnings = within(historico).getByRole('list', { name: 'Avisos de Pontos já ganhos' });
    expect(warnings).toHaveTextContent('null_result');
    expect(warnings).toHaveTextContent('O resultado foi nulo; o valor ficou vazio, como pede a política.');
    expect(within(screen.getByRole('region', { name: 'Saídas' })).getByText('pontos').nextSibling).toHaveTextContent('—');
  });

  it('error: o erro no bloco que falhou e os seguintes não rodados, em cinza', async () => {
    api.respond(RUN_ROUTE, json(RUN_ERROR));
    const { user } = renderTab();
    await user.click(calculate());

    await screen.findByRole('heading', { name: 'Resultado' });
    expect(screen.getByText('Resultado do cálculo: erro')).toBeInTheDocument();
    expect(screen.getByText('Sem saídas: o registro deu erro.')).toBeInTheDocument();
    const [table, historico, pontos] = within(screen.getByRole('region', { name: 'Blocos' })).getAllByRole('listitem');
    expect(table).toHaveTextContent('erro');
    expect(table).toHaveTextContent('no_rule_matched');
    expect(table).toHaveTextContent('Nenhuma regra casou com os valores do registro.');
    for (const node of [historico!, pontos!]) {
      expect(node).toHaveTextContent('não rodado');
      expect(node).toHaveClass('fc-unit-run-node-not-run');
    }
    expect(table).not.toHaveClass('fc-unit-run-node-not-run');
  });

  it('marca o resultado de valores anteriores quando os campos mudam depois do cálculo', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab();
    const field = screen.getByRole('textbox', { name: 'valor_item' });
    await user.click(field);
    await user.paste('10');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    const stale = 'Resultado de valores anteriores. Calcule de novo para ver o dos valores atuais.';
    expect(screen.queryByText(stale)).not.toBeInTheDocument();

    await user.click(field);
    await user.paste('5');
    expect(screen.getByText(stale)).toBeInTheDocument();
    // Back to the values that ran: the result is of them again.
    await user.clear(field);
    await user.paste('10');
    expect(screen.queryByText(stale)).not.toBeInTheDocument();
  });

  it('mostra o carregando enquanto calcula', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(RUN_ROUTE, () => new Promise<Response>((resolve) => (release = resolve)));
    const { user } = renderTab();
    await user.click(calculate());
    expect(await screen.findByText('Calculando')).toBeInTheDocument();
    expect(calculate()).toHaveAttribute('aria-busy', 'true');
    await act(async () => release(json(RUN_OK)));
    await screen.findByRole('heading', { name: 'Resultado' });
  });
});

describe('aba Calcular: recusas da API', () => {
  it('invalid_inputs marca o campo pelo fields, inclusive o item da lista', async () => {
    api.respond(
      RUN_ROUTE,
      problem(422, 'invalid_inputs', {
        fields: { valor_item: 'Valor com mais casas que a entrada.', 'pontuacoes[0].taxa': 'Valor de outro tipo.', extra: 'Entrada não declarada.' },
      }),
    );
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await user.click(calculate());

    expect(await screen.findByText('Alguns valores foram recusados')).toBeInTheDocument();
    const valor = screen.getByRole('textbox', { name: 'valor_item' });
    expect(valor).toHaveAttribute('aria-invalid', 'true');
    expect(valor).toHaveAccessibleDescription(expect.stringContaining('Valor com mais casas que a entrada.'));
    await waitFor(() => expect(valor).toHaveFocus());
    const taxa = screen.getByRole('textbox', { name: 'taxa do item 1' });
    expect(taxa).toHaveAccessibleDescription(expect.stringContaining('Valor de outro tipo.'));
    expect(screen.getByRole('textbox', { name: 'categoria' })).not.toHaveAttribute('aria-invalid');
    // A path with no field on screen is listed in the note.
    expect(screen.getByText('extra')).toBeInTheDocument();

    // Editing the field takes the API's error away.
    await user.click(valor);
    await user.paste('1');
    expect(valor).not.toHaveAttribute('aria-invalid');
  });

  it('editar um campo de um item só tira o erro daquele campo', async () => {
    api.respond(
      RUN_ROUTE,
      problem(422, 'invalid_inputs', {
        fields: { 'pontuacoes[0].valor_compra': 'Valor recusado.', 'pontuacoes[0].taxa': 'Valor de outro tipo.' },
      }),
    );
    const { user } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await user.click(calculate());
    expect(await screen.findByText('Alguns valores foram recusados')).toBeInTheDocument();

    const valor = screen.getByRole('textbox', { name: 'valor_compra do item 1' });
    const taxa = screen.getByRole('textbox', { name: 'taxa do item 1' });
    await user.click(valor);
    await user.paste('1');
    expect(valor).not.toHaveAttribute('aria-invalid');
    expect(taxa).toHaveAttribute('aria-invalid', 'true');
    expect(taxa).toHaveAccessibleDescription(expect.stringContaining('Valor de outro tipo.'));

    // Including an item renumbers the list: the API's errors of the list go away.
    await user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    expect(screen.getByRole('textbox', { name: 'taxa do item 1' })).not.toHaveAttribute('aria-invalid');
  });

  it('draft_conflict mostra o aviso e Recarregar rascunho traz a versão nova', async () => {
    api.respond(RUN_ROUTE, problem(409, 'draft_conflict', { current_revision: 5 }));
    api.respond(DRAFT_ROUTE, json({ ...DRAFT, revision: 5 }));
    const { user } = renderTab();
    await user.click(calculate());

    expect(await screen.findByText('Este rascunho mudou em outra aba ou por outra pessoa')).toBeInTheDocument();
    expect(calculate()).toHaveAccessibleDescription('Recarregue o rascunho para calcular');
    await user.click(screen.getByRole('button', { name: 'Recarregar rascunho' }));
    await waitFor(() => expect(screen.queryByText('Este rascunho mudou em outra aba ou por outra pessoa')).not.toBeInTheDocument());

    api.respond(RUN_ROUTE, json(RUN_OK));
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)[1]).toMatchObject({ revision: 5 });
  });

  it('draft_has_problems diz quantos problemas o rascunho salvo tem', async () => {
    api.respond(RUN_ROUTE, problem(422, 'draft_has_problems', { problems: [PROBLEM] }));
    const { user } = renderTab();
    await user.click(calculate());
    expect(await screen.findByText('O rascunho salvo tem problemas')).toBeInTheDocument();
    expect(screen.getByText('Resolva 1 problema na aba Problemas e calcule de novo.')).toBeInTheDocument();
  });

  it('outra falha mostra a mensagem da API', async () => {
    api.respond(RUN_ROUTE, problem(500, 'unexpected_error'));
    const { user } = renderTab();
    await user.click(calculate());
    expect(await screen.findByText('Texto do servidor para unexpected_error.')).toBeInTheDocument();
  });
});

describe('aba Calcular: valores só na memória', () => {
  it('os últimos valores ficam na memória do módulo, por workflow, sem localStorage nem sessionStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const queryClient = testQueryClient();

    const first = renderTab({ queryClient });
    // The values are kept under the person and the tenant: the editor only opens after the session.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await first.user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await first.user.paste('1.500,00');
    await first.user.click(screen.getByRole('button', { name: 'Incluir item em pontuacoes' }));
    await first.user.paste('10,00');
    first.unmount();

    // The editor opens again in the same module: the values are there.
    renderTab({ queryClient });
    expect(await screen.findByDisplayValue('1.500,00')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'valor_compra do item 1' })).toHaveValue('10,00');

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('outra pessoa que entra no mesmo módulo não vê os valores', async () => {
    const queryClient = testQueryClient();
    const first = renderTab({ queryClient });
    await first.user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await first.user.paste('7');
    first.unmount();

    queryClient.setQueryData(['session'], session('7b7b7b7b-0000-4000-8000-000000000001'));
    renderTab({ queryClient });
    expect(screen.getByRole('textbox', { name: 'valor_item' })).toHaveValue('');
  });

  it('outro módulo (outro QueryClient) não vê os valores', async () => {
    const first = renderTab();
    await first.user.click(screen.getByRole('textbox', { name: 'valor_item' }));
    await first.user.paste('7');
    first.unmount();

    renderTab();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'valor_item' })).toHaveValue(''));
  });
});
