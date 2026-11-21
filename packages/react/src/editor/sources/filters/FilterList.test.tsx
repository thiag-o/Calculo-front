import { cleanup, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUTOS,
  choose,
  currentSource,
  problem,
  produto,
  renderSource,
  simulateApi,
  sourceDraft,
  variableId,
} from '../source-block/source-block.test-support';
import type { SourceFilter } from '../source-block/sourceNode';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The Source block "Produto" with these filters. */
function withFilters(filters: SourceFilter[], problems: ReturnType<typeof problem>[] = []) {
  return sourceDraft([produto({ filters })], { problems });
}

async function operatorsOf(user: UserEvent, name: string): Promise<string[]> {
  await user.click(screen.getByRole('combobox', { name }));
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
  await user.keyboard('{Escape}');
  return options;
}

const filters = () => currentSource().filters;

describe('filtros da fonte', () => {
  it('inclui um filtro com a primeira variável, = e o valor vazio, e o remove', async () => {
    simulateApi();
    const { user } = renderSource();
    await screen.findByRole('group', { name: 'Filtros' });

    await user.click(screen.getByRole('button', { name: 'Incluir filtro' }));
    expect(filters()).toEqual([{ variable_id: variableId(PRODUTOS, 'codigo'), operator: '=', values: [''] }]);
    expect(screen.getByRole('combobox', { name: 'Variável (filtro 1)' })).toHaveTextContent('codigo · Texto');

    await user.click(screen.getByRole('button', { name: 'Remover filtro (filtro 1)' }));
    expect(filters()).toEqual([]);
  });

  it('oferece o operador pelo tipo da variável: num texto, só =, ≠, EM e os de nulo', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'categoria'), operator: '=', values: ['"A"'] }]) });
    await screen.findByRole('combobox', { name: 'Variável (filtro 1)' });

    expect(await operatorsOf(user, 'Operador (filtro 1)')).toEqual(['=', '≠', 'EM (lista)', 'É NULO', 'NÃO É NULO']);

    await choose(user, 'Variável (filtro 1)', 'preco · Decimal');
    expect(await operatorsOf(user, 'Operador (filtro 1)')).toEqual(['=', '≠', '>', '>=', '<', '<=', 'ENTRE', 'EM (lista)', 'É NULO', 'NÃO É NULO']);
    // The text literal does not serve a number: the value is emptied.
    expect(filters()).toEqual([{ variable_id: variableId(PRODUTOS, 'preco'), operator: '=', values: [''] }]);

    await choose(user, 'Operador (filtro 1)', '>=');
    await choose(user, 'Variável (filtro 1)', 'ativo · Booleano');
    // ">=" does not serve a boolean: it goes back to "=".
    expect(filters()[0]?.operator).toBe('=');
    expect(await operatorsOf(user, 'Operador (filtro 1)')).toEqual(['=', '≠', 'É NULO', 'NÃO É NULO']);
  });

  it('lê o número no padrão brasileiro e guarda o literal com ponto; o mal escrito fica só no campo', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'preco'), operator: '>', values: [''] }]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await user.type(value, '1.500,50');
    expect(filters()[0]?.values).toEqual(['1500.50']);
    expect(value).toHaveValue('1.500,50');

    await user.clear(value);
    await user.type(value, '1500.5');
    expect(value).toHaveAccessibleDescription(/Use vírgula para separar os decimais, como 1\.500,50\. Enquanto o campo tiver erro, a mudança não é salva\./);
    // "1500" was still a number while it was typed: the draft keeps it, not the text with the dot.
    expect(filters()[0]?.values).toEqual(['1500']);

    await user.clear(value);
    await user.type(value, '10,555');
    expect(value).toHaveAccessibleDescription(/Use no máximo 2 casas decimais\./);
  });

  it('guarda o texto entre aspas e mostra sem elas', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'categoria'), operator: '=', values: ['"A"'] }]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });
    expect(value).toHaveValue('A');
    await user.type(value, 'B');
    expect(filters()[0]?.values).toEqual(['"AB"']);
  });

  it('no ENTRE, mostra dois campos, De e Até', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'estoque'), operator: '=', values: ['5'] }]) });
    await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await choose(user, 'Operador (filtro 1)', 'ENTRE');
    expect(filters()[0]).toMatchObject({ operator: 'between', values: ['5', ''] });
    expect(screen.queryByRole('textbox', { name: 'Valor (filtro 1)' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'De (filtro 1)' })).toHaveValue('5');
    await user.type(screen.getByRole('textbox', { name: 'Até (filtro 1)' }), '1.000');
    expect(filters()[0]?.values).toEqual(['5', '1000']);
  });

  it('no EM, mostra a lista de valores, com Incluir valor e sem tirar o último', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'categoria'), operator: '=', values: ['"A"'] }]) });
    await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await choose(user, 'Operador (filtro 1)', 'EM (lista)');
    const list = screen.getByRole('list', { name: 'Valores (filtro 1)' });
    expect(within(list).getByRole('textbox', { name: 'Valor 1 (filtro 1)' })).toHaveValue('A');
    expect(screen.getByRole('button', { name: 'Remover valor 1 (filtro 1)' })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: 'Incluir valor (filtro 1)' }));
    await user.type(screen.getByRole('textbox', { name: 'Valor 2 (filtro 1)' }), 'B');
    expect(filters()[0]).toMatchObject({ operator: 'in', values: ['"A"', '"B"'] });

    await user.click(screen.getByRole('button', { name: 'Remover valor 1 (filtro 1)' }));
    expect(filters()[0]?.values).toEqual(['"B"']);
  });

  it('nos de nulo, não pede valor', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'categoria'), operator: '=', values: ['"A"'] }]) });
    await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await choose(user, 'Operador (filtro 1)', 'NÃO É NULO');
    expect(filters()[0]).toMatchObject({ operator: 'is_not_null', values: [] });
    expect(screen.queryByRole('textbox', { name: /filtro 1/ })).not.toBeInTheDocument();
  });

  it('com @, guarda o parâmetro como digitado e avisa que parâmetros chegam no épico 6', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'preco'), operator: '>', values: [''] }]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await user.type(value, '@preco_minimo');
    expect(filters()[0]?.values).toEqual(['@preco_minimo']);
    expect(screen.getByText('Parâmetros chegam no épico 6')).toBeInTheDocument();
  });

  it('usa o calendário na data e guarda DATA(a, m, d)', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'vigencia_inicio'), operator: '>=', values: ['DATA(2026, 1, 15)'] }]) });
    const value = await screen.findByLabelText('Valor (filtro 1)');
    expect(value).toHaveAttribute('type', 'date');
    expect(value).toHaveValue('2026-01-15');
    await user.clear(value);
    await user.type(value, '2026-10-01');
    expect(filters()[0]?.values).toEqual(['DATA(2026, 10, 1)']);
  });

  it('na data e hora, só aceita ISO 8601 com fuso e avisa no próprio campo', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'atualizado_em'), operator: '>=', values: [''] }]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await user.type(value, '2026-10-01T08:00:00');
    expect(value).toHaveAccessibleDescription(/Use data e hora em ISO 8601 com fuso, como 2026-10-01T08:00:00-03:00\. Enquanto o campo tiver erro, a mudança não é salva\./);
    expect(filters()[0]?.values).toEqual(['']);

    await user.type(value, '-03:00');
    expect(value).not.toHaveAccessibleDescription(/ISO 8601/);
    expect(filters()[0]?.values).toEqual(['2026-10-01T08:00:00-03:00']);
  });

  it('escolhe Verdadeiro ou Falso no booleano', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([{ variable_id: variableId(PRODUTOS, 'ativo'), operator: '=', values: ['verdadeiro'] }]) });
    await screen.findByRole('combobox', { name: 'Valor (filtro 1)' });
    await choose(user, 'Valor (filtro 1)', 'Falso');
    expect(filters()[0]?.values).toEqual(['falso']);
  });

  it('mostra cada problema do filtro no campo dele', async () => {
    simulateApi();
    renderSource({
      draft: withFilters(
        [{ variable_id: variableId(PRODUTOS, 'preco'), operator: 'between', values: ['@periodo', '10'] }],
        [
          problem('parameter_not_available', 'Parâmetros de execução chegam no épico 6.', 'root.nodes[0].filters[0].values[0]', 'produto'),
          problem('filter_type_mismatch', 'O operador não serve ao tipo da variável.', 'root.nodes[0].filters[0].operator', 'produto'),
          problem('unknown_catalog_variable', 'A variável não existe mais no catálogo.', 'root.nodes[0].filters[0].variable_id', 'produto'),
        ],
      ),
    });
    expect(await screen.findByRole('textbox', { name: 'De (filtro 1)' })).toHaveAccessibleDescription('Parâmetros de execução chegam no épico 6.');
    expect(screen.getByRole('combobox', { name: 'Operador (filtro 1)' })).toHaveAccessibleDescription('O operador não serve ao tipo da variável.');
    expect(screen.getByRole('combobox', { name: 'Variável (filtro 1)' })).toHaveAccessibleDescription('A variável não existe mais no catálogo.');
    expect(screen.queryByRole('list', { name: 'Problemas' })).not.toBeInTheDocument();
  });

  it('em só leitura, os campos do filtro ficam desabilitados', async () => {
    simulateApi();
    renderSource({ readOnly: true, draft: withFilters([{ variable_id: variableId(PRODUTOS, 'preco'), operator: 'in', values: ['10', '20'] }]) });
    expect(await screen.findByRole('textbox', { name: 'Valor 1 (filtro 1)' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Operador (filtro 1)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Incluir valor (filtro 1)' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Remover filtro (filtro 1)' })).toHaveAttribute('aria-disabled', 'true');
  });
});
