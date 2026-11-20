import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionTableProperties } from './DecisionTableProperties';
import { TABLE_ID, cellsOf, problemAt, renderWithDraft } from './decision-table.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderProperties(options: Parameters<typeof renderWithDraft>[1] = {}) {
  const onOpenTable = vi.fn();
  const rendered = renderWithDraft(<DecisionTableProperties nodeId={TABLE_ID} onOpenTable={onOpenTable} />, options);
  return { ...rendered, onOpenTable };
}

/** Picks an option of a design-system Select (Radix) by keyboard and click. */
async function choose(user: UserEvent, label: string | RegExp, option: string, scope: HTMLElement = document.body) {
  const trigger = within(scope).getByRole('combobox', { name: label });
  trigger.focus();
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('option', { name: option }));
}

function resultGroup(number: number): HTMLElement {
  return screen.getByRole('group', { name: `Resultado ${number}` });
}

describe('DecisionTableProperties', () => {
  it('"Abrir tabela" pede a grade, com o resumo das regras', async () => {
    const { user, onOpenTable } = renderProperties();
    expect(screen.getByText('3 regras')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir tabela' }));
    expect(onOpenTable).toHaveBeenCalledTimes(1);
  });

  it('a política de acerto troca entre "Primeira" e "Única"', async () => {
    const { user, probe } = renderProperties();
    const policy = screen.getByRole('combobox', { name: 'Política de acerto' });
    expect(policy).toHaveTextContent('Primeira');
    expect(screen.getByText('Vale a primeira regra que casa, de cima para baixo.')).toBeInTheDocument();

    await choose(user, 'Política de acerto', 'Única');
    expect(probe.table().hit_policy).toBe('unique');
    expect(policy).toHaveTextContent('Única');
    expect(screen.getByText('Mais de uma regra casando é erro do registro.')).toBeInTheDocument();

    await choose(user, 'Política de acerto', 'Primeira');
    expect(probe.table().hit_policy).toBe('first');
  });

  it('o arredondamento e a política de erro têm "Herdar do workflow", que guarda nulo', async () => {
    const { user, probe } = renderProperties();
    expect(screen.getByRole('combobox', { name: 'Modo de arredondamento' })).toHaveTextContent('Herdar do workflow');
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toHaveTextContent('Herdar do workflow');

    await choose(user, 'Modo de arredondamento', 'Meio para o par');
    expect(probe.table().rounding_mode).toBe('half_even');
    await choose(user, 'Modo de arredondamento', 'Cortar');
    expect(probe.table().rounding_mode).toBe('down');
    await choose(user, 'Modo de arredondamento', 'Herdar do workflow');
    expect(probe.table().rounding_mode).toBeNull();

    await choose(user, 'Política de erro', 'Deixar vazio com aviso');
    expect(probe.table().error_policy).toBe('null_with_warning');
    await choose(user, 'Política de erro', 'Herdar do workflow');
    expect(probe.table().error_policy).toBeNull();
  });

  it('o nome e a descrição vão para o rascunho; um nome vazio fica no campo com o erro, sem ir para o rascunho', async () => {
    const { user, probe } = renderProperties();
    const name = screen.getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    expect(name).toHaveAccessibleDescription('Informe o nome da tabela.');
    expect(probe.table().name).toBe('Elegibilidade');
    await user.type(name, 'Elegível?');
    expect(probe.table().name).toBe('Elegível?');
    expect(name).not.toHaveAccessibleDescription();

    const description = screen.getByRole('textbox', { name: 'Descrição curta' });
    await user.click(description);
    await user.paste('Diz se o item entra na campanha');
    expect(probe.table().description).toBe('Diz se o item entra na campanha');
    await user.clear(description);
    expect(probe.table().description).toBeNull();
  });

  it('edita, inclui e remove condições, com a célula de cada regra', async () => {
    const { user, probe } = renderProperties();
    const first = screen.getByRole('textbox', { name: 'Condição 1' });
    expect(first).toHaveValue('categoria');
    await user.clear(first);
    await user.paste('MAIÚSCULAS(categoria)');
    expect(probe.table().conditions[0]).toEqual({ expression: 'MAIÚSCULAS(categoria)' });

    await user.click(screen.getByRole('button', { name: 'Incluir condição' }));
    expect(probe.table().conditions).toHaveLength(3);
    expect(probe.table().rules.every((rule) => rule.when.length === 3 && rule.when[2] === '')).toBe(true);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Condição 3' })).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Remover condição 1' }));
    expect(probe.table().conditions.map((condition) => condition.expression)).toEqual(['meta_atingida', '']);
    expect(cellsOf(probe.table())[0]).toEqual(['verdadeiro', '', 'verdadeiro', '0.15']);
  });

  it('inclui e remove resultados; o nome segue a regra de variável; o tipo decimal pede as casas', async () => {
    const { user, probe } = renderProperties();
    await user.click(screen.getByRole('button', { name: 'Incluir resultado' }));
    expect(probe.table().results[2]).toEqual({ name: 'resultado_2', type: 'decimal', scale: 2, default_value: null });
    expect(probe.table().rules.every((rule) => rule.then.length === 3)).toBe(true);
    const name = within(resultGroup(3)).getByRole('textbox', { name: 'Nome da variável' });
    await waitFor(() => expect(name).toHaveFocus());

    await user.clear(name);
    await user.paste('Bônus');
    expect(name).toHaveValue('Bônus');
    expect(name).toHaveAccessibleDescription('Use letras minúsculas, números e _, começando por uma letra (até 63 caracteres).');
    expect(probe.table().results[2]!.name).toBe('resultado_2');
    await user.clear(name);
    await user.paste('bonus');
    expect(probe.table().results[2]!.name).toBe('bonus');

    expect(within(resultGroup(3)).getByRole('combobox', { name: 'Casas' })).toHaveTextContent('2');
    await choose(user, 'Casas', '4', resultGroup(3));
    expect(probe.table().results[2]!.scale).toBe(4);

    // Another type has no decimal places (the key goes away: `scale` only exists on decimal).
    await choose(user, 'Tipo', 'Texto', resultGroup(3));
    expect(probe.table().results[2]).toEqual({ name: 'bonus', type: 'text', default_value: null });
    expect(within(resultGroup(3)).queryByRole('combobox', { name: 'Casas' })).not.toBeInTheDocument();
    await choose(user, 'Tipo', 'Decimal', resultGroup(3));
    expect(probe.table().results[2]!.scale).toBe(2);

    await user.click(within(resultGroup(1)).getByRole('button', { name: 'Remover resultado 1' }));
    expect(probe.table().results.map((result) => result.name)).toEqual(['fator', 'bonus']);
    expect(cellsOf(probe.table())[0]).toEqual(['"A"', 'verdadeiro', '0.15', '']);
  });

  it('o valor padrão aparece só com "Usar valor padrão" na política da tabela', async () => {
    const { user, probe } = renderProperties();
    expect(screen.queryByRole('textbox', { name: 'Valor padrão' })).not.toBeInTheDocument();

    await choose(user, 'Política de erro', 'Usar valor padrão');
    const fator = within(resultGroup(2)).getByRole('textbox', { name: 'Valor padrão' });
    await user.click(fator);
    await user.paste('0');
    expect(probe.table().results[1]!.default_value).toBe('0');
    await user.clear(fator);
    expect(probe.table().results[1]!.default_value).toBeNull();

    await choose(user, 'Política de erro', 'Gerar erro');
    expect(screen.queryByRole('textbox', { name: 'Valor padrão' })).not.toBeInTheDocument();

  });

  it('com "Usar valor padrão" herdado do workflow, o valor padrão também aparece', () => {
    renderProperties({ workflowErrorPolicy: 'default_value' });
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toHaveTextContent('Herdar do workflow');
    expect(within(resultGroup(1)).getByRole('textbox', { name: 'Valor padrão' })).toHaveValue('');
  });

  it('mostra cada problema no campo dele, pelo path, e o da tabela inteira no topo', async () => {
    const problems = [
      problemAt('.results[1].name', 'fator já existe neste workflow.', 'duplicate_name'),
      problemAt('.conditions[0].expression', 'categorias não existe neste ponto do fluxo.', 'unknown_variable'),
      problemAt('.rules', 'A tabela precisa de pelo menos uma regra.', 'empty_decision_table'),
      problemAt('.rules[0].when[1]', 'operador > não serve para booleano.', 'operator_not_allowed'),
      problemAt('.name', 'Outro problema de nome.', 'reserved_name'),
    ];
    const { probe } = renderProperties({ problems });

    expect(within(resultGroup(2)).getByRole('textbox', { name: 'Nome da variável' })).toHaveAccessibleDescription('fator já existe neste workflow.');
    expect(within(resultGroup(1)).getByRole('textbox', { name: 'Nome da variável' })).not.toHaveAccessibleDescription();
    expect(screen.getByRole('textbox', { name: 'Condição 1' })).toHaveAccessibleDescription('categorias não existe neste ponto do fluxo.');
    expect(screen.getByRole('textbox', { name: 'Nome', description: 'Outro problema de nome.' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Problemas da tabela' })).getByText('A tabela precisa de pelo menos uma regra.')).toBeInTheDocument();
    // The problem of a cell is counted here and shown in the grid.
    expect(screen.getByText('3 regras · 1 problema nas regras')).toBeInTheDocument();

    // A problem chosen in the Problems tab focuses its field.
    act(() => probe.select({ type: 'node', id: TABLE_ID }, 'root.nodes[1].results[1].name'));
    await waitFor(() => expect(within(resultGroup(2)).getByRole('textbox', { name: 'Nome da variável' })).toHaveFocus());
  });

  it('só leitura: tudo desabilitado, sem incluir nem remover, com o motivo; "Abrir tabela" continua', async () => {
    const { user, onOpenTable } = renderProperties({ readOnly: true });
    expect(screen.getByText('Você não tem permissão para editar este workflow')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Condição 1' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Política de acerto' })).toBeDisabled();
    expect(within(resultGroup(1)).getByRole('combobox', { name: 'Tipo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Incluir condição' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incluir resultado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir tabela' }));
    expect(onOpenTable).toHaveBeenCalled();
  });
});
