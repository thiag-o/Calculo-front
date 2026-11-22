import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../../api';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from '../properties.test-support';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

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

async function choose(user: UserEvent, label: string, option: string) {
  const select = screen.getByRole('combobox', { name: label });
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: option }));
  // The closed list gives the focus back to the select; under load that comes late and would take a click made after it.
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  if (select.isConnected) await waitFor(() => expect(select).toHaveFocus());
}

async function optionsOf(user: UserEvent, label: string): Promise<string[]> {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
  await user.keyboard('{Escape}');
  return options;
}

function lastParameter(): Parameter {
  const all = currentDefinition().parameters;
  return all[all.length - 1]!;
}

describe('Parâmetros do workflow', () => {
  it('sem parâmetros, diz o que falta e cria um com "Adicionar parâmetro"', async () => {
    simulateApi();
    const { user } = renderPanel();

    const section = screen.getByRole('group', { name: 'Parâmetros' });
    expect(within(section).getByText(/Nenhum parâmetro/)).toBeVisible();
    await user.click(within(section).getByRole('button', { name: 'Adicionar parâmetro' }));

    expect(currentDefinition().parameters).toEqual([parameter({ name: 'parametro_1' })]);
    expect(screen.getByRole('group', { name: 'Parâmetro parametro_1' })).toBeVisible();
    const name = screen.getByRole('textbox', { name: 'Nome (parametro_1)' });
    await user.tripleClick(name);
    await user.paste('periodo');
    expect(lastParameter().name).toBe('periodo');
  });

  it('cria um parâmetro de cada tipo, com os rótulos em pt-BR e o Período entre eles', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p' })]) });

    expect(await optionsOf(user, 'Tipo (p)')).toEqual(['Texto', 'Inteiro', 'Decimal', 'Data', 'Data e hora', 'Booleano', 'Período']);
    const expected: [string, Parameter['type'], number | null][] = [
      ['Inteiro', 'integer', null],
      ['Decimal', 'decimal', 2],
      ['Data', 'date', null],
      ['Data e hora', 'datetime', null],
      ['Booleano', 'boolean', null],
      ['Período', 'period', null],
      ['Texto', 'text', null],
    ];
    for (const [label, type, scale] of expected) {
      await choose(user, 'Tipo (p)', label);
      expect(lastParameter()).toMatchObject({ type, scale, list: false });
    }

    await choose(user, 'Tipo (p)', 'Decimal');
    const places = screen.getByRole('textbox', { name: 'Casas decimais (p)' });
    await user.tripleClick(places);
    await user.paste('4');
    expect(lastParameter().scale).toBe(4);
  });

  it('a Lista fica escondida no Período e no Booleano; os valores permitidos só em texto, inteiro e data', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p' })]) });

    const cases: [string, boolean, boolean][] = [
      ['Texto', true, true],
      ['Inteiro', true, true],
      ['Decimal', true, false],
      ['Data', true, true],
      ['Data e hora', true, false],
      ['Booleano', false, false],
      ['Período', false, false],
    ];
    for (const [label, list, allowed] of cases) {
      await choose(user, 'Tipo (p)', label);
      expect(screen.queryByRole('checkbox', { name: 'Lista (p)' }) !== null).toBe(list);
      expect(screen.queryByRole('group', { name: 'Valores permitidos' }) !== null).toBe(allowed);
      expect(screen.getByRole('checkbox', { name: 'Obrigatório (p)' })).toBeVisible();
    }
  });

  it('um parâmetro de lista que vira Período deixa de ser lista', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'lojas', list: true })]) });

    expect(screen.getByRole('checkbox', { name: 'Lista (lojas)' })).toBeChecked();
    await choose(user, 'Tipo (lojas)', 'Período');
    expect(lastParameter()).toMatchObject({ type: 'period', list: false });
    expect(screen.queryByRole('checkbox', { name: 'Lista (lojas)' })).not.toBeInTheDocument();
  });

  it('Obrigatório e Descrição vão para o rascunho', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p' })]) });

    await user.click(screen.getByRole('checkbox', { name: 'Obrigatório (p)' }));
    expect(lastParameter().required).toBe(true);
    await user.click(screen.getByRole('textbox', { name: 'Descrição (p)' }));
    await user.paste('Mês das notas');
    expect(lastParameter().description).toBe('Mês das notas');
    await user.clear(screen.getByRole('textbox', { name: 'Descrição (p)' }));
    expect(lastParameter().description).toBeNull();
  });

  it('o Relativo só aparece nos tipos que têm relativos, com só os rótulos que servem ao tipo', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p' })]) });
    const kinds = () => within(screen.getByRole('radiogroup', { name: 'Padrão (p)' })).getAllByRole('radio').map((radio) => radio.textContent);

    for (const label of ['Texto', 'Inteiro', 'Decimal', 'Booleano']) {
      await choose(user, 'Tipo (p)', label);
      expect(kinds()).toEqual(['Nenhum', 'Fixo']);
    }

    const relatives: [string, string[], string[]][] = [
      ['Data', ['Nenhum', 'Fixo', 'Relativo'], ['Hoje', 'Ontem', 'Primeiro dia do mês atual', 'Primeiro dia do mês anterior', 'Último dia do mês anterior']],
      // The Data e hora has no fixed default (D36): only Nenhum or Agora.
      ['Data e hora', ['Nenhum', 'Relativo'], ['Agora']],
      ['Período', ['Nenhum', 'Fixo', 'Relativo'], ['Mês atual', 'Mês anterior', 'Últimos 7 dias', 'Últimos 30 dias']],
    ];
    for (const [label, offered, options] of relatives) {
      await choose(user, 'Tipo (p)', label);
      expect(kinds()).toEqual(offered);
      await user.click(screen.getByRole('radio', { name: 'Relativo' }));
      expect(await optionsOf(user, 'Valor relativo (p)')).toEqual(options);
    }

    await choose(user, 'Valor relativo (p)', 'Mês anterior');
    expect(lastParameter().default).toEqual({ kind: 'relative', value: 'previous_month' });

    await user.click(screen.getByRole('radio', { name: 'Nenhum' }));
    expect(lastParameter().default).toBeNull();
  });

  it('a Data e hora não tem Fixo: um padrão fixo guardado pode só ser trocado', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p', type: 'datetime', default: { kind: 'fixed', value: '2026-10-01T08:00:00Z' } })]) });

    const kinds = within(screen.getByRole('radiogroup', { name: 'Padrão (p)' }));
    expect(kinds.getByRole('radio', { name: 'Fixo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Data e hora não tem padrão fixo. Escolha Nenhum ou Relativo.')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Valor padrão (p)' })).not.toBeInTheDocument();
    await user.click(kinds.getByRole('radio', { name: 'Relativo' }));
    expect(lastParameter().default).toEqual({ kind: 'relative', value: 'now' });
    expect(within(screen.getByRole('radiogroup', { name: 'Padrão (p)' })).queryByRole('radio', { name: 'Fixo' })).not.toBeInTheDocument();
  });

  it('numa lista de datas, o padrão não tem relativo', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p', type: 'date', default: { kind: 'relative', value: 'today' } })]) });

    await user.click(screen.getByRole('checkbox', { name: 'Lista (p)' }));
    expect(lastParameter()).toMatchObject({ list: true, default: null });
    expect(within(screen.getByRole('radiogroup', { name: 'Padrão (p)' })).queryByRole('radio', { name: 'Relativo' })).not.toBeInTheDocument();
  });

  it('o padrão fixo é digitado no padrão brasileiro e gravado como literal da linguagem', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'p' })]) });

    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: '' });
    await user.click(screen.getByRole('textbox', { name: 'Valor padrão (p)' }));
    await user.paste('A');
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: '"A"' });

    await choose(user, 'Tipo (p)', 'Decimal');
    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    const value = screen.getByRole('textbox', { name: 'Valor padrão (p)' });
    await user.click(value);
    await user.paste('1.500,50');
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: '1500.50' });
    await user.tripleClick(value);
    await user.paste('1500.50');
    expect(value).toHaveAccessibleDescription(expect.stringContaining('Use vírgula para separar os decimais'));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: '1500.50' });

    await choose(user, 'Tipo (p)', 'Data');
    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    fireEvent.change(screen.getByLabelText('Valor padrão (p)'), { target: { value: '2026-10-01' } });
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: 'DATA(2026, 10, 1)' });

    await choose(user, 'Tipo (p)', 'Booleano');
    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    await choose(user, 'Valor padrão (p)', 'Verdadeiro');
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: 'verdadeiro' });
  });

  it('o padrão fixo de um Período tem início e fim como DATA', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'periodo', type: 'period' })]) });

    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    fireEvent.change(screen.getByLabelText('Início (periodo)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Fim (periodo)'), { target: { value: '2026-10-31' } });
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: { start: 'DATA(2026, 10, 1)', end: 'DATA(2026, 10, 31)' } });
  });

  it('o padrão fixo mostra o literal guardado no padrão brasileiro', () => {
    simulateApi();
    renderPanel({
      draft: draftWith([
        parameter({ name: 'meta', type: 'decimal', scale: 2, default: { kind: 'fixed', value: '1500.00' } }),
        parameter({ name: 'inicio', type: 'date', default: { kind: 'fixed', value: 'DATA(2026, 10, 1)' } }),
      ]),
    });

    expect(screen.getByRole('textbox', { name: 'Valor padrão (meta)' })).toHaveValue('1.500,00');
    expect(screen.getByLabelText('Valor padrão (inicio)')).toHaveValue('2026-10-01');
  });

  it('numa lista, o padrão fixo tem um ou mais valores', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'categorias' })]) });

    await user.click(screen.getByRole('checkbox', { name: 'Lista (categorias)' }));
    await user.click(screen.getByRole('radio', { name: 'Fixo' }));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: [''] });
    const defaults = screen.getByRole('group', { name: 'Valores padrão' });
    expect(within(defaults).queryByRole('button', { name: /Remover valor padrão/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: 'Valor padrão 1 (categorias)' }));
    await user.paste('A');
    await user.click(within(defaults).getByRole('button', { name: 'Incluir valor padrão' }));
    await user.click(screen.getByRole('textbox', { name: 'Valor padrão 2 (categorias)' }));
    await user.paste('B');
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: ['"A"', '"B"'] });

    await user.click(within(defaults).getByRole('button', { name: 'Remover valor padrão 1 (categorias)' }));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: ['"B"'] });
  });

  it('os valores permitidos são uma lista opcional de literais do tipo', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'loja', type: 'integer' })]) });

    const allowed = screen.getByRole('group', { name: 'Valores permitidos' });
    expect(within(allowed).getByText('Sem restrição: aceita qualquer valor do tipo.')).toBeVisible();
    await user.click(within(allowed).getByRole('button', { name: 'Incluir valor permitido' }));
    await user.click(screen.getByRole('textbox', { name: 'Valor permitido 1 (loja)' }));
    await user.paste('1.010');
    await user.click(within(allowed).getByRole('button', { name: 'Incluir valor permitido' }));
    await user.click(screen.getByRole('textbox', { name: 'Valor permitido 2 (loja)' }));
    await user.paste('20');
    expect(lastParameter().allowed_values).toEqual(['1010', '20']);

    await user.click(within(allowed).getByRole('button', { name: 'Remover valor permitido 1 (loja)' }));
    await user.click(within(allowed).getByRole('button', { name: 'Remover valor permitido 1 (loja)' }));
    expect(lastParameter().allowed_values).toBeNull();
  });

  it('o nome segue a regra e não repete o de outro parâmetro (nada vai para o rascunho)', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'a' }), parameter({ name: 'b' })]) });

    const name = screen.getByRole('textbox', { name: 'Nome (b)' });
    await user.tripleClick(name);
    await user.paste('a');
    expect(name).toHaveAccessibleDescription(expect.stringContaining('Já existe um parâmetro com este nome.'));
    await user.tripleClick(name);
    await user.paste('Período');
    expect(name).toHaveAccessibleDescription(expect.stringContaining('Use de 1 a 63 caracteres'));
    expect(currentDefinition().parameters.map((item) => item.name)).toEqual(['a', 'b']);
  });

  it('remove um parâmetro e o Ctrl Z o traz de volta', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'a' }), parameter({ name: 'b' })]) });

    await user.click(screen.getByRole('button', { name: 'Remover parâmetro (a)' }));
    expect(currentDefinition().parameters.map((item) => item.name)).toEqual(['b']);
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(currentDefinition().parameters.map((item) => item.name)).toEqual(['a', 'b']);
  });

  it('o workflow aceita até 20 parâmetros', () => {
    simulateApi();
    renderPanel({ draft: draftWith(Array.from({ length: 20 }, (_, index) => parameter({ name: `p_${index}` }))) });

    const add = screen.getByRole('button', { name: 'Adicionar parâmetro' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('O workflow aceita até 20 parâmetros.');
  });

  it('mostra invalid_parameter_default no valor padrão e invalid_allowed_value no valor permitido certo', async () => {
    simulateApi();
    const draft = draftWith(
      [
        parameter({ name: 'meta', type: 'integer', default: { kind: 'fixed', value: '"abc"' } }),
        parameter({ name: 'categoria', allowed_values: ['"A"', '10', '"C"'] }),
        parameter({ name: 'lojas', type: 'integer', list: true, default: { kind: 'fixed', value: ['1', '"x"'] } }),
      ],
      [
        problem('invalid_parameter_default', 'O padrão de @meta não é um número inteiro.', 'parameters[0].default'),
        problem('invalid_allowed_value', 'O valor permitido 10 de @categoria não é um texto.', 'parameters[1].allowed_values[1]'),
        problem('invalid_parameter_default', 'O padrão "x" de @lojas não é um número inteiro.', 'parameters[2].default.value[1]'),
      ],
    );
    renderPanel({ draft, item: { type: 'workflow' }, field: 'parameters[1].allowed_values[1]' });

    expect(screen.getByRole('textbox', { name: 'Valor padrão (meta)' })).toHaveAccessibleDescription(
      expect.stringContaining('O padrão de @meta não é um número inteiro.'),
    );
    const second = screen.getByRole('textbox', { name: 'Valor permitido 2 (categoria)' });
    expect(second).toHaveAccessibleDescription(expect.stringContaining('O valor permitido 10 de @categoria não é um texto.'));
    expect(screen.getByRole('textbox', { name: 'Valor permitido 1 (categoria)' })).not.toHaveAccessibleDescription(expect.stringContaining('@categoria'));
    expect(screen.getByRole('textbox', { name: 'Valor padrão 2 (lojas)' })).toHaveAccessibleDescription(
      expect.stringContaining('O padrão "x" de @lojas não é um número inteiro.'),
    );
    expect(screen.getByRole('textbox', { name: 'Valor padrão 1 (lojas)' })).not.toHaveAccessibleDescription(expect.stringContaining('@lojas'));
    await waitFor(() => expect(second).toHaveFocus());
  });

  it('o problema de um padrão relativo aparece uma vez só, no Valor relativo, também no Período e na Data e hora', () => {
    simulateApi();
    const draft = draftWith(
      [
        parameter({ name: 'periodo', type: 'period', default: { kind: 'relative', value: 'current_month' } }),
        parameter({ name: 'momento', type: 'datetime', default: { kind: 'relative', value: 'now' } }),
        parameter({ name: 'dia', type: 'date', default: { kind: 'relative', value: 'today' } }),
      ],
      [
        problem('invalid_parameter_default', 'O padrão de @periodo não serve.', 'parameters[0].default'),
        problem('invalid_parameter_default', 'O padrão de @momento não serve.', 'parameters[1].default'),
        problem('invalid_parameter_default', 'O padrão de @dia não serve.', 'parameters[2].default'),
      ],
    );
    renderPanel({ draft });

    for (const [name, message] of [
      ['periodo', 'O padrão de @periodo não serve.'],
      ['momento', 'O padrão de @momento não serve.'],
      ['dia', 'O padrão de @dia não serve.'],
    ] as const) {
      expect(screen.getAllByText(message)).toHaveLength(1);
      expect(screen.getByRole('combobox', { name: `Valor relativo (${name})` })).toHaveAccessibleDescription(expect.stringContaining(message));
    }
  });

  it('uma data fora do calendário fica num campo de texto que diz o que digitar e volta ao calendário', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'inicio', type: 'date', default: { kind: 'fixed', value: 'hoje' } })]) });

    const field = screen.getByRole('textbox', { name: 'Valor padrão (inicio)' });
    expect(field).toHaveValue('hoje');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Digite-a como AAAA-MM-DD ou apague o campo para usar o calendário.'));
    await user.tripleClick(field);
    await user.paste('2026-02-30');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Digite a data como AAAA-MM-DD, por exemplo 2026-10-01.'));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: 'hoje' });

    await user.tripleClick(field);
    await user.paste('2026-10-01');
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: 'DATA(2026, 10, 1)' });
    const picker = screen.getByLabelText('Valor padrão (inicio)');
    expect(picker).toHaveAttribute('type', 'date');
    expect(picker).toHaveValue('2026-10-01');
    expect(picker).not.toHaveAccessibleDescription(expect.stringContaining('AAAA-MM-DD'));
  });

  it('apagar uma data fora do calendário devolve o calendário', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'inicio', type: 'date', default: { kind: 'fixed', value: 'hoje' } })]) });

    await user.clear(screen.getByRole('textbox', { name: 'Valor padrão (inicio)' }));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: '' });
    expect(screen.getByLabelText('Valor padrão (inicio)')).toHaveAttribute('type', 'date');
  });

  it('ao remover um valor da lista, o foco vai para o valor que ficou no lugar, e com a lista vazia para o Incluir', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'loja', allowed_values: ['"A"', '"B"', '"C"'] })]) });

    const allowed = screen.getByRole('group', { name: 'Valores permitidos' });
    await user.click(within(allowed).getByRole('button', { name: 'Remover valor permitido 2 (loja)' }));
    expect(lastParameter().allowed_values).toEqual(['"A"', '"C"']);
    await waitFor(() => expect(within(allowed).getByRole('button', { name: 'Remover valor permitido 2 (loja)' })).toHaveFocus());

    await user.keyboard('{Enter}');
    expect(lastParameter().allowed_values).toEqual(['"A"']);
    await waitFor(() => expect(within(allowed).getByRole('button', { name: 'Remover valor permitido 1 (loja)' })).toHaveFocus());

    await user.keyboard('{Enter}');
    expect(lastParameter().allowed_values).toBeNull();
    await waitFor(() => expect(within(allowed).getByRole('button', { name: 'Incluir valor permitido' })).toHaveFocus());
  });

  it('numa lista de padrões com um valor só, o foco vai para o campo que ficou', async () => {
    simulateApi();
    const { user } = renderPanel({ draft: draftWith([parameter({ name: 'lojas', list: true, default: { kind: 'fixed', value: ['"A"', '"B"'] } })]) });

    await user.click(screen.getByRole('button', { name: 'Remover valor padrão 2 (lojas)' }));
    expect(lastParameter().default).toEqual({ kind: 'fixed', value: ['"A"'] });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Valor padrão 1 (lojas)' })).toHaveFocus());
  });

  it('só leitura: tudo desabilitado, com o motivo', () => {
    simulateApi();
    renderPanel({
      readOnly: true,
      draft: draftWith([parameter({ name: 'categorias', list: true, default: { kind: 'fixed', value: ['"A"'] }, allowed_values: ['"A"'] })]),
    });

    const reason = 'Você não tem permissão para editar este workflow';
    const name = screen.getByRole('textbox', { name: 'Nome (categorias)' });
    expect(name).toBeDisabled();
    expect(name).toHaveAccessibleDescription(expect.stringContaining(reason));
    expect(screen.getByRole('combobox', { name: 'Tipo (categorias)' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Lista (categorias)' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Obrigatório (categorias)' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Obrigatório (categorias)' })).toHaveAccessibleDescription(expect.stringContaining(reason));
    for (const radio of within(screen.getByRole('radiogroup', { name: 'Padrão (categorias)' })).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Valor padrão 1 (categorias)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Valor permitido 1 (categorias)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Descrição (categorias)' })).toBeDisabled();
    for (const label of ['Adicionar parâmetro', 'Incluir valor padrão', 'Incluir valor permitido', 'Remover parâmetro (categorias)']) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription(reason);
    }
  });
});
