import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../../api';
import { PRODUTOS, currentSource, problem, produto, renderSource, simulateApi, sourceDraft, variableId } from '../source-block/source-block.test-support';
import type { SourceFilter } from '../source-block/sourceNode';

// The run parameters in the filter values (E6-18; D35): the list of the ones that serve, "Usar parâmetro" in the date and
// the boolean, the help when a typed one would not serve, and the problems of the analysis on the field.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function parameter(name: string, type: Schemas['ParameterType'], changes: Partial<Schemas['WorkflowParameter']> = {}): Schemas['WorkflowParameter'] {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...changes };
}

const PARAMETERS = [
  parameter('periodo', 'period', { required: true }),
  parameter('data_corte', 'date'),
  parameter('meta_minima', 'decimal', { scale: 2 }),
  parameter('lojas', 'integer', { list: true }),
  parameter('categorias', 'text', { list: true }),
  parameter('somente_ativos', 'boolean'),
];

/** The Source block "Produto" with these filters, in a draft with `parameters`. */
function withFilters(filters: SourceFilter[], parameters = PARAMETERS, problems: ReturnType<typeof problem>[] = []) {
  const draft = sourceDraft([produto({ filters })], { problems });
  return { ...draft, definition: { ...draft.definition, parameters } };
}

const filter = (name: string, operator: SourceFilter['operator'], values: string[]): SourceFilter => ({
  variable_id: variableId(PRODUTOS, name),
  operator,
  values,
});

const values = () => currentSource().filters[0]?.values;
const options = () => screen.getAllByRole('option').map((option) => option.querySelector('.fc-suggestions-label')?.textContent);

describe('parâmetros nos valores dos filtros', () => {
  it('@ abre a lista só com os parâmetros que servem ao tipo e ao operador, e Enter escolhe', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('preco', '>', [''])]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });
    expect(value).toHaveAttribute('aria-autocomplete', 'list');

    await user.type(value, '@');
    // A decimal under ">": the decimal; not the integer list (only in EM), nor the dates and the boolean.
    expect(screen.getByRole('listbox', { name: 'Parâmetros (Valor, filtro 1)' })).toBeInTheDocument();
    expect(options()).toEqual(['@meta_minima']);
    expect(screen.getByRole('option', { name: /^@meta_minima/ })).toHaveTextContent('decimal(2)');
    expect(value).toHaveAttribute('aria-activedescendant', screen.getByRole('option').id);

    await user.keyboard('{Enter}');
    expect(values()).toEqual(['@meta_minima']);
    expect(value).toHaveValue('@meta_minima');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('aceita @lojas no EM, escolhido da lista pelo clique', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('estoque', 'in', [''])]) });
    const value = await screen.findByRole('textbox', { name: 'Valor 1 (filtro 1)' });

    await user.type(value, '@');
    // In EM, a list of the type serves, and a number of another place too (integer and decimal compare by value).
    expect(options()).toEqual(['@meta_minima', '@lojas']);
    await user.type(value, 'lo');
    expect(options()).toEqual(['@lojas']);
    await user.click(screen.getByRole('option', { name: /^@lojas/ }));
    expect(values()).toEqual(['@lojas']);
    expect(value).toHaveFocus();
    expect(value).not.toHaveAccessibleDescription(/lista/);
  });

  it('Esc fecha a lista e o texto digitado continua', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('estoque', 'in', [''])]) });
    const value = await screen.findByRole('textbox', { name: 'Valor 1 (filtro 1)' });
    await user.type(value, '@lo');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(values()).toEqual(['@lo']);
  });

  it('explica abaixo do campo, sem bloquear, quando o @ digitado não serve', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('categoria', '=', [''])]) });
    const value = await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });

    await user.type(value, '@lojas');
    expect(value).toHaveAccessibleDescription('@lojas é uma lista: só serve no operador EM (lista).');
    // Only a hint: the value goes to the draft, and the analysis decides.
    expect(values()).toEqual(['@lojas']);
    expect(value).not.toHaveAttribute('aria-invalid');

    const hints: [string, string][] = [
      ['@periodo', '@periodo é um período: use @periodo.inicio ou @periodo.fim.'],
      ['@periodo.meio', 'Um período só tem as partes .inicio e .fim: use @periodo.inicio ou @periodo.fim.'],
      ['@meta_minima', '@meta_minima é Decimal, e a variável é Texto.'],
      ['@meta_minima.inicio', '@meta_minima não é um período: use @meta_minima, sem .inicio.'],
      ['@periodo.inicio', '@periodo.inicio é Data, e a variável é Texto.'],
      ['@xyz', '@xyz não é um parâmetro do workflow.'],
    ];
    for (const [typed, hint] of hints) {
      await user.clear(value);
      await user.type(value, typed);
      expect(value).toHaveAccessibleDescription(hint);
      expect(values()).toEqual([typed]);
    }
  });

  it('na data, "Usar parâmetro" lista os que servem; no ENTRE, o início de um período em De preenche Até com o fim', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('vigencia_inicio', 'between', ['', ''])]) });
    expect(await screen.findByLabelText('De (filtro 1)')).toHaveAttribute('type', 'date');

    await user.click(screen.getByRole('button', { name: 'Usar parâmetro (De, filtro 1)' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['@periodo.inicio', '@periodo.fim', '@data_corte']);
    await user.click(screen.getByRole('menuitem', { name: '@periodo.inicio' }));

    expect(values()).toEqual(['@periodo.inicio', '@periodo.fim']);
    // Both stay editable, as text.
    const from = screen.getByRole('textbox', { name: 'De (filtro 1)' });
    const to = screen.getByRole('textbox', { name: 'Até (filtro 1)' });
    expect(from).toHaveValue('@periodo.inicio');
    expect(to).toHaveValue('@periodo.fim');

    // Changing the value goes back to a fixed value: emptied, Até is the date picker again.
    await user.clear(to);
    expect(values()).toEqual(['@periodo.inicio', '']);
    expect(screen.getByLabelText('Até (filtro 1)')).toHaveAttribute('type', 'date');
    await user.type(screen.getByLabelText('Até (filtro 1)'), '2026-10-31');
    expect(values()).toEqual(['@periodo.inicio', 'DATA(2026, 10, 31)']);
  });

  it('em Até, ou fora do ENTRE, o parâmetro escolhido entra só no campo dele', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('vigencia_inicio', 'between', ['DATA(2026, 1, 1)', ''])]) });
    await user.click(await screen.findByRole('button', { name: 'Usar parâmetro (Até, filtro 1)' }));
    await user.click(await screen.findByRole('menuitem', { name: '@data_corte' }));
    expect(values()).toEqual(['DATA(2026, 1, 1)', '@data_corte']);
    expect(screen.getByLabelText('De (filtro 1)')).toHaveValue('2026-01-01');
  });

  it('no booleano, "Usar parâmetro" troca Verdadeiro/Falso pelo parâmetro, e esvaziar volta à lista', async () => {
    simulateApi();
    const { user } = renderSource({ draft: withFilters([filter('ativo', '=', ['verdadeiro'])]) });
    await screen.findByRole('combobox', { name: 'Valor (filtro 1)' });

    await user.click(screen.getByRole('button', { name: 'Usar parâmetro (Valor, filtro 1)' }));
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual(['@somente_ativos']);
    await user.click(screen.getByRole('menuitem', { name: '@somente_ativos' }));
    expect(values()).toEqual(['@somente_ativos']);

    const value = screen.getByRole('textbox', { name: 'Valor (filtro 1)' });
    expect(value).toHaveValue('@somente_ativos');
    await user.clear(value);
    expect(values()).toEqual(['']);
    expect(screen.getByRole('combobox', { name: 'Valor (filtro 1)' })).toBeInTheDocument();
  });

  it('"Usar parâmetro" desabilitado diz o motivo: sem parâmetros, nenhum que sirva ou só leitura', async () => {
    simulateApi();
    renderSource({ draft: withFilters([filter('ativo', '=', [''])], []) });
    expect(await screen.findByRole('button', { name: 'Usar parâmetro (Valor, filtro 1)' })).toHaveAccessibleDescription(
      'O workflow não tem parâmetros. Declare-os nas propriedades do workflow.',
    );
    cleanup();

    simulateApi();
    renderSource({ draft: withFilters([filter('ativo', '=', [''])], [parameter('data_corte', 'date')]) });
    const button = await screen.findByRole('button', { name: 'Usar parâmetro (Valor, filtro 1)' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Nenhum parâmetro do workflow serve a este campo.');
    cleanup();

    simulateApi();
    renderSource({ readOnly: true, draft: withFilters([filter('vigencia_inicio', '>=', [''])]) });
    expect(await screen.findByRole('button', { name: 'Usar parâmetro (Valor, filtro 1)' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Valor (filtro 1)')).not.toHaveAttribute('aria-autocomplete');
  });

  it('nos outros tipos não há "Usar parâmetro": o @ se digita', async () => {
    simulateApi();
    renderSource({ draft: withFilters([filter('preco', '>', [''])]) });
    await screen.findByRole('textbox', { name: 'Valor (filtro 1)' });
    expect(screen.queryByRole('button', { name: /Usar parâmetro/ })).not.toBeInTheDocument();
  });

  it('mostra unknown_parameter, period_without_part e list_outside_in no campo que o back aponta', async () => {
    simulateApi();
    renderSource({
      draft: withFilters(
        [filter('vigencia_inicio', 'between', ['@periodo', '@data_corte_x']), filter('preco', '>', ['@lojas'])],
        PARAMETERS,
        [
          problem('period_without_part', '@periodo é um período: use @periodo.inicio ou @periodo.fim.', 'root.nodes[0].filters[0].values[0]', 'produto'),
          problem('unknown_parameter', '@data_corte_x não existe entre os parâmetros. Você quis dizer @data_corte?', 'root.nodes[0].filters[0].values[1]', 'produto'),
          problem('list_outside_in', '@lojas é uma lista: só entra no filtro EM.', 'root.nodes[0].filters[1].values[0]', 'produto'),
        ],
      ),
    });
    const from = await screen.findByRole('textbox', { name: 'De (filtro 1)' });
    expect(from).toHaveAttribute('aria-invalid', 'true');
    // The error of the analysis takes the place of the front's hint: the message is said once.
    expect(from).toHaveAccessibleDescription('@periodo é um período: use @periodo.inicio ou @periodo.fim.');
    expect(screen.getByRole('textbox', { name: 'Até (filtro 1)' })).toHaveAccessibleDescription(
      '@data_corte_x não existe entre os parâmetros. Você quis dizer @data_corte?',
    );
    const value = screen.getByRole('textbox', { name: 'Valor (filtro 2)' });
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAccessibleDescription('@lojas é uma lista: só entra no filtro EM.');
    expect(screen.queryByText('@lojas é uma lista: só serve no operador EM (lista).')).not.toBeInTheDocument();
  });
});
