import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { READ_ONLY_REASON } from '../draft';
import { currentDefinition, exampleDraft, problem, renderPanel } from '../properties/properties.test-support';
import { DATASETS, PRODUTOS, PRODUTOS_2024, VARIABLES, variableId } from '../sources/source-block/source-block.test-support';
import { QUERY_PARAMETER_REFUSAL } from './parameterRules';

vi.mock('../../formula', async (original) => ({ ...(await original<typeof import('../../formula')>()), FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Parameter = Schemas['WorkflowParameter'];

function parameter(changes: Partial<Parameter>): Parameter {
  return { name: 'p', type: 'text', required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...changes };
}

function draftWith(parameters: Parameter[], problems: Schemas['WorkflowProblem'][] = []) {
  const draft = exampleDraft({ problems });
  draft.definition.parameters = parameters;
  return draft;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The catalog (datasets and their variables) and the editor's routes (analysis without problems, the save). */
function simulateApi({ analysisPending = false }: { analysisPending?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/v1/datasets') return json({ items: DATASETS });
      const variables = /^\/v1\/datasets\/([^/]+)\/variables$/.exec(url.pathname);
      if (request.method === 'GET' && variables) return json({ items: VARIABLES[variables[1]!] ?? [] });
      // With `analysisPending` the analysis of a change never comes back: what shows is what the screen decides by itself.
      if (url.pathname.endsWith('/draft/analysis')) {
        return analysisPending ? new Promise<Response>(() => {}) : json({ problems: [], symbols: [], dependencies: [], order: [], groups: [] });
      }
      if (request.method === 'PUT' && url.pathname.endsWith('/draft')) {
        const body = JSON.parse(await request.clone().text());
        return json({ ...exampleDraft(), revision: 4, definition: body.definition });
      }
      return new Response(`rota não simulada: ${request.method} ${url.pathname}`, { status: 599 });
    }),
  );
}

// Under load the catalog answers late (F43): the waits for it get a longer time.
const SLOW = { timeout: 4000 };

async function choose(user: UserEvent, label: string, option: string) {
  const select = await screen.findByRole('combobox', { name: label }, SLOW);
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: option }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
}

async function optionsOf(user: UserEvent, label: string): Promise<string[]> {
  await user.click(await screen.findByRole('combobox', { name: label }));
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  return options;
}

function allowed(): Parameter['allowed_values'] {
  return currentDefinition().parameters[0]!.allowed_values;
}

const QUERY = { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'categoria'), filters: [] } satisfies Schemas['AllowedValuesQuery'];


describe('Valores permitidos: Nenhum | Lista | Consulta', () => {
  it('começa em Nenhum; a Consulta escolhe o dataset e só depois da variável vai para o rascunho', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria' })]) });

    const kinds = screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' });
    expect(within(kinds).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Nenhum', 'Lista', 'Consulta']);
    expect(within(kinds).getByRole('radio', { name: 'Nenhum' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(kinds).getByRole('radio', { name: 'Consulta' }));
    await user.click(await screen.findByRole('button', { name: /^Produtos Tabela ou view/ }, SLOW));
    expect(allowed()).toBeNull();
    expect(await screen.findByText('A consulta vai para o rascunho quando você escolher a variável.', undefined, SLOW)).toBeVisible();

    await choose(user, 'Variável (categoria)', 'categoria');
    expect(allowed()).toEqual(QUERY);
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeVisible();
  });

  it('a variável só lista as do tipo do parâmetro', async () => {
    simulateApi();
    const { user } = renderPanel({
      draft: draftWith([
        parameter({ name: 'texto', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'codigo'), filters: [] } }),
        parameter({ name: 'numero', type: 'integer', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'estoque'), filters: [] } }),
        parameter({ name: 'dia', type: 'date', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'vigencia_inicio'), filters: [] } }),
      ]),
    });

    expect(await optionsOf(user, 'Variável (texto)')).toEqual(['codigo', 'categoria']);
    expect(await optionsOf(user, 'Variável (numero)')).toEqual(['estoque']);
    expect(await optionsOf(user, 'Variável (dia)')).toEqual(['vigencia_inicio']);
  });

  it('um dataset sem variável do tipo diz o que fazer', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'dia', type: 'date' })]) });

    await user.click(within(screen.getByRole('radiogroup', { name: 'Valores permitidos (dia)' })).getByRole('radio', { name: 'Consulta' }));
    await user.click(await screen.findByRole('button', { name: /^Produtos 2024/ }, SLOW));
    expect(await screen.findByText(/O dataset não tem variáveis do tipo Data/, undefined, SLOW)).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Variável (dia)' })).not.toBeInTheDocument();
    expect(allowed()).toBeNull();
  });

  it('trocar Lista por Consulta pede confirmação, e a lista só sai quando a variável é escolhida', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: ['"A"', '"B"'] })]) });

    const kinds = screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' });
    expect(within(kinds).getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(kinds).getByRole('radio', { name: 'Consulta' }));
    let dialog = await screen.findByRole('dialog', { name: 'Usar consulta' });
    expect(dialog).toHaveTextContent('Os 2 valores da lista saem do parâmetro categoria quando você escolher a variável da consulta');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(within(kinds).getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true');
    expect(allowed()).toEqual(['"A"', '"B"']);

    await user.click(within(kinds).getByRole('radio', { name: 'Consulta' }));
    dialog = await screen.findByRole('dialog', { name: 'Usar consulta' });
    await user.click(within(dialog).getByRole('button', { name: 'Usar consulta' }));
    await user.click(await screen.findByRole('button', { name: /^Produtos Tabela ou view/ }, SLOW));
    expect(allowed()).toEqual(['"A"', '"B"']);
    await choose(user, 'Variável (categoria)', 'categoria');
    expect(allowed()).toEqual(QUERY);

    // One change, one undo step: the list comes back.
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(allowed()).toEqual(['"A"', '"B"']);
  });

  it('trocar Consulta por Lista pede confirmação e começa a lista com um valor vazio', async () => {
    simulateApi();
    const filters = [{ variable_id: variableId(PRODUTOS, 'ativo'), operator: '=', values: ['verdadeiro'] }] satisfies Schemas['SourceFilter'][];
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: { ...QUERY, filters } })]) });

    await user.click(within(screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' })).getByRole('radio', { name: 'Lista' }));
    const dialog = await screen.findByRole('dialog', { name: 'Usar lista' });
    await waitFor(() => expect(dialog).toHaveTextContent('A consulta ao dataset Produtos sai do parâmetro categoria, com a variável e o filtro.'), SLOW);
    await user.click(within(dialog).getByRole('button', { name: 'Usar lista' }));
    expect(allowed()).toEqual(['']);
    expect(screen.getByRole('textbox', { name: 'Valor permitido 1 (categoria)' })).toBeVisible();
  });

  it('Nenhum tira a restrição, sem confirmação (o Ctrl Z desfaz)', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: QUERY })]) });

    await user.click(within(screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' })).getByRole('radio', { name: 'Nenhum' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(allowed()).toBeNull();
    expect(screen.getByText('Sem restrição: aceita qualquer valor do tipo.')).toBeVisible();
  });

  it('trocar o dataset da consulta só grava com a variável nova, e os filtros do dataset anterior saem', async () => {
    simulateApi();
    const filters = [{ variable_id: variableId(PRODUTOS, 'ativo'), operator: '=', values: ['verdadeiro'] }] satisfies Schemas['SourceFilter'][];
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: { ...QUERY, filters } })]) });

    await user.click(await screen.findByRole('button', { name: 'Trocar dataset (categoria)' }));
    await user.click(await screen.findByRole('button', { name: /^Produtos 2024/ }, SLOW));
    expect(await screen.findByText('A consulta muda quando você escolher a variável. O filtro do dataset atual sai.', undefined, SLOW)).toBeVisible();
    expect(allowed()).toEqual({ ...QUERY, filters });
    await choose(user, 'Variável (categoria)', 'codigo');
    expect(allowed()).toEqual({ dataset_id: PRODUTOS_2024, variable_id: variableId(PRODUTOS_2024, 'codigo'), filters: [] });
  });
});

describe('filtros da consulta', () => {
  it('recusam @: nada de parâmetro oferecido, e o @ digitado fica só no campo', async () => {
    simulateApi();
    const draft = draftWith([
      parameter({ name: 'periodo', type: 'period' }),
      parameter({
        name: 'categoria',
        allowed_values: { ...QUERY, filters: [{ variable_id: variableId(PRODUTOS, 'vigencia_inicio'), operator: '=', values: [''] }] },
      }),
    ]);
    const { user } = renderPanel({ draft });

    const filters = await screen.findByRole('group', { name: 'Filtros' }, SLOW);
    // A date filter of a Source has "Usar parâmetro"; the query's does not.
    expect(within(filters).queryByRole('button', { name: /Usar parâmetro/ })).not.toBeInTheDocument();

    await user.click(within(filters).getByRole('button', { name: 'Incluir filtro' }));
    const value = within(filters).getByRole('textbox', { name: 'Valor (filtro 2)' });
    await user.click(value);
    await user.paste('@periodo');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(value).toHaveAccessibleDescription(expect.stringContaining(QUERY_PARAMETER_REFUSAL));
    expect(currentDefinition().parameters[1]!.allowed_values).toMatchObject({ filters: [{}, { variable_id: variableId(PRODUTOS, 'codigo'), values: [''] }] });

    await user.tripleClick(value);
    await user.paste('A');
    expect(currentDefinition().parameters[1]!.allowed_values).toMatchObject({ filters: [{}, { values: ['"A"'] }] });
  });

  it('o limite de 20 filtros fala da consulta, não da fonte', async () => {
    simulateApi();
    const filters = Array.from({ length: 20 }, () => ({ variable_id: variableId(PRODUTOS, 'codigo'), operator: '=', values: ['"A"'] })) satisfies Schemas['SourceFilter'][];
    renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: { ...QUERY, filters } })]) });

    const group = await screen.findByRole('group', { name: 'Filtros' }, SLOW);
    expect(within(group).getByRole('button', { name: 'Incluir filtro' })).toHaveAccessibleDescription('A consulta aceita até 20 filtros.');
  });

  it('o @ recusado continua no campo, com o motivo, quando outra mudança do rascunho chega', async () => {
    simulateApi();
    const draft = draftWith([
      parameter({ name: 'periodo', type: 'period' }),
      parameter({
        name: 'categoria',
        allowed_values: { ...QUERY, filters: [{ variable_id: variableId(PRODUTOS, 'vigencia_inicio'), operator: '=', values: [''] }] },
      }),
    ]);
    const { user } = renderPanel({ draft });

    const filters = await screen.findByRole('group', { name: 'Filtros' }, SLOW);
    await user.click(within(filters).getByRole('button', { name: 'Incluir filtro' }));
    const value = within(filters).getByRole('textbox', { name: 'Valor (filtro 2)' });
    await user.click(value);
    await user.paste('@periodo');
    expect(value).toHaveAccessibleDescription(expect.stringContaining(QUERY_PARAMETER_REFUSAL));

    // Another field of the draft changes (a new definition) and, with it, the analysis comes back: the refusal stays.
    const description = screen.getByRole('textbox', { name: 'Descrição (periodo)' });
    await user.click(description);
    await user.paste('Mês fechado');
    await user.tab();
    await waitFor(() => expect(currentDefinition().parameters[0]!.description).toBe('Mês fechado'));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const again = within(await screen.findByRole('group', { name: 'Filtros' })).getByRole('textbox', { name: 'Valor (filtro 2)' });
    expect(again).toHaveValue('@periodo');
    expect(again).toHaveAccessibleDescription(expect.stringContaining(QUERY_PARAMETER_REFUSAL));
  });
});

describe('problemas da consulta no campo certo', () => {
  it('unknown_dataset no dataset, allowed_values_type_mismatch e variable_not_from_dataset na variável, parameter_in_allowed_values no filtro', async () => {
    simulateApi();
    const draft = draftWith(
      [
        parameter({ name: 'sumido', allowed_values: { dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c99', variable_id: variableId(PRODUTOS, 'codigo'), filters: [] } }),
        parameter({ name: 'loja', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'estoque'), filters: [] } }),
        parameter({ name: 'outra', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS_2024, 'codigo'), filters: [] } }),
        parameter({
          name: 'categoria',
          allowed_values: { ...QUERY, filters: [{ variable_id: variableId(PRODUTOS, 'codigo'), operator: '=', values: ['@periodo'] }] },
        }),
      ],
      [
        problem('unknown_dataset', 'O dataset dos valores permitidos de @sumido não existe mais no catálogo.', 'parameters[0].allowed_values.dataset_id'),
        problem('allowed_values_type_mismatch', 'A variável dos valores permitidos de @loja não é do tipo texto.', 'parameters[1].allowed_values.variable_id'),
        problem('variable_not_from_dataset', 'A variável dos valores permitidos de @outra não é do dataset Produtos.', 'parameters[2].allowed_values.variable_id'),
        problem('parameter_in_allowed_values', 'A consulta dos valores permitidos de @categoria não aceita @periodo.', 'parameters[3].allowed_values.filters[0].values[0]'),
      ],
    );
    renderPanel({ draft });

    expect(await screen.findByRole('button', { name: 'Trocar dataset (sumido)' })).toHaveAccessibleDescription(
      expect.stringContaining('O dataset dos valores permitidos de @sumido não existe mais no catálogo.'),
    );
    await waitFor(() => expect(screen.getAllByText('Dataset fora do catálogo')[0]).toBeVisible(), SLOW);

    const loja = await screen.findByRole('combobox', { name: 'Variável (loja)' }, SLOW);
    expect(loja).toHaveAccessibleDescription(expect.stringContaining('A variável dos valores permitidos de @loja não é do tipo texto.'));
    expect(loja).toHaveTextContent('Variável de outro tipo');

    const outra = await screen.findByRole('combobox', { name: 'Variável (outra)' }, SLOW);
    expect(outra).toHaveAccessibleDescription(expect.stringContaining('A variável dos valores permitidos de @outra não é do dataset Produtos.'));
    expect(outra).toHaveTextContent('Variável fora do dataset');

    const categoria = within(screen.getByRole('group', { name: 'Parâmetro categoria' }));
    const value = await categoria.findByRole('textbox', { name: 'Valor (filtro 1)' }, SLOW);
    expect(value).toHaveAccessibleDescription(expect.stringContaining('A consulta dos valores permitidos de @categoria não aceita @periodo.'));
  });

  it('a aba Problemas leva o foco à variável da consulta', async () => {
    simulateApi();
    const draft = draftWith(
      [parameter({ name: 'loja', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'estoque'), filters: [] } })],
      [problem('allowed_values_type_mismatch', 'A variável dos valores permitidos de @loja não é do tipo texto.', 'parameters[0].allowed_values.variable_id')],
    );
    renderPanel({ draft, item: { type: 'workflow' }, field: 'parameters[0].allowed_values.variable_id' });

    const loja = await screen.findByRole('combobox', { name: 'Variável (loja)' }, SLOW);
    await waitFor(() => expect(loja).toHaveFocus(), SLOW);
  });
});

describe('só leitura', () => {
  it('tudo desabilitado, com o motivo', async () => {
    simulateApi();
    const filters = [{ variable_id: variableId(PRODUTOS, 'ativo'), operator: '=', values: ['verdadeiro'] }] satisfies Schemas['SourceFilter'][];
    renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: { ...QUERY, filters } })]), readOnly: true });

    for (const radio of within(screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' })).getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    const swap = await screen.findByRole('button', { name: 'Trocar dataset (categoria)' });
    expect(swap).toHaveAttribute('aria-disabled', 'true');
    expect(swap).toHaveAccessibleDescription(expect.stringContaining(READ_ONLY_REASON));
    expect(await screen.findByRole('combobox', { name: 'Variável (categoria)' }, SLOW)).toBeDisabled();
    const filterGroup = screen.getByRole('group', { name: 'Filtros' });
    expect(within(filterGroup).getByRole('button', { name: 'Incluir filtro' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(filterGroup).getByRole('combobox', { name: 'Variável (filtro 1)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /Alerta de campos vazios/ })).toBeDisabled();
  });
});

describe('seletor Nenhum | Lista | Consulta: só a escolha confirmada grava', () => {
  it('as setas só movem o foco: nada vai ao rascunho nem o foco sai do seletor', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria' })]) });

    const kinds = screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' });
    const none = within(kinds).getByRole('radio', { name: 'Nenhum' });
    const list = within(kinds).getByRole('radio', { name: 'Lista' });
    none.focus();
    await user.keyboard('{ArrowRight}');

    expect(list).toHaveFocus();
    expect(none).toHaveAttribute('aria-checked', 'true');
    expect(allowed()).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Valor permitido 1/ })).not.toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(within(kinds).getByRole('radio', { name: 'Consulta' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(none).toHaveFocus();
    expect(allowed()).toBeNull();

    await user.keyboard('{ArrowRight}{Enter}');
    expect(list).toHaveAttribute('aria-checked', 'true');
    expect(allowed()).toEqual(['']);
  });

  it('as setas não abrem a confirmação de trocar a Lista pela Consulta', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categoria', allowed_values: ['"A"'] })]) });

    const kinds = screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' });
    within(kinds).getByRole('radio', { name: 'Lista' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(kinds).getByRole('radio', { name: 'Consulta' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(allowed()).toEqual(['"A"']);
  });
});

describe('marcas de problema velhas da consulta (ADR 0044)', () => {
  it('a marca da variável some quando a variável muda, sem esperar a análise', async () => {
    simulateApi({ analysisPending: true });
    const draft = draftWith(
      [parameter({ name: 'loja', allowed_values: { dataset_id: PRODUTOS, variable_id: variableId(PRODUTOS, 'estoque'), filters: [] } })],
      [problem('allowed_values_type_mismatch', 'A variável dos valores permitidos de @loja não é do tipo texto.', 'parameters[0].allowed_values.variable_id')],
    );
    const { user } = renderPanel({ draft });

    const variable = await screen.findByRole('combobox', { name: 'Variável (loja)' }, SLOW);
    expect(variable).toHaveAccessibleDescription(expect.stringContaining('não é do tipo texto'));

    await choose(user, 'Variável (loja)', 'codigo');
    expect(allowed()).toMatchObject({ variable_id: variableId(PRODUTOS, 'codigo') });
    expect(screen.getByRole('combobox', { name: 'Variável (loja)' })).not.toHaveAccessibleDescription(expect.stringContaining('não é do tipo texto'));
  });

  it('a marca do dataset some quando o dataset muda, sem esperar a análise', async () => {
    simulateApi({ analysisPending: true });
    const draft = draftWith(
      [parameter({ name: 'sumido', allowed_values: { dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c99', variable_id: variableId(PRODUTOS, 'codigo'), filters: [] } })],
      [problem('unknown_dataset', 'O dataset dos valores permitidos de @sumido não existe mais no catálogo.', 'parameters[0].allowed_values.dataset_id')],
    );
    const { user } = renderPanel({ draft });

    const swap = await screen.findByRole('button', { name: 'Trocar dataset (sumido)' });
    expect(swap).toHaveAccessibleDescription(expect.stringContaining('não existe mais no catálogo'));

    await user.click(swap);
    await user.click(await screen.findByRole('button', { name: /^Produtos Tabela ou view/ }, SLOW));
    await choose(user, 'Variável (sumido)', 'codigo');
    expect(allowed()).toMatchObject({ dataset_id: PRODUTOS });
    expect(await screen.findByRole('button', { name: 'Trocar dataset (sumido)' })).not.toHaveAccessibleDescription(
      expect.stringContaining('não existe mais no catálogo'),
    );
  });
});

describe('problemas dos valores permitidos enquanto se escolhe a consulta', () => {
  it('o problema da lista continua na tela até a variável ser escolhida', async () => {
    simulateApi();
    const draft = draftWith(
      [parameter({ name: 'categoria', allowed_values: ['"A"'] })],
      [problem('invalid_allowed_value', 'Os valores permitidos de @categoria têm um valor que não serve.', 'parameters[0].allowed_values')],
    );
    const { user } = renderPanel({ draft });

    const kinds = screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' });
    expect(screen.getByText('Os valores permitidos de @categoria têm um valor que não serve.')).toBeVisible();
    await user.click(within(kinds).getByRole('radio', { name: 'Consulta' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Usar consulta' })).getByRole('button', { name: 'Usar consulta' }));

    expect(await screen.findByText('Os valores permitidos de @categoria têm um valor que não serve.')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: /Valor permitido 1/ })).not.toBeInTheDocument();
  });
});

describe('foco adiado ao desmontar', () => {
  it('o quadro à espera do foco de "Incluir valor permitido" é cancelado com a seção', async () => {
    simulateApi();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    const cancelled: number[] = [];
    vi.stubGlobal('cancelAnimationFrame', (id: number) => void cancelled.push(id));
    const { user, unmount } = renderPanel({ draft: draftWith([parameter({ name: 'categoria' })]) });

    await user.click(within(screen.getByRole('radiogroup', { name: 'Valores permitidos (categoria)' })).getByRole('radio', { name: 'Lista' }));
    expect(frames).toHaveLength(1);
    unmount();

    expect(cancelled).toEqual([1]);
  });
});
