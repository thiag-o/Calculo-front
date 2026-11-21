import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from '../properties.test-support';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function choose(user: UserEvent, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Propriedades do workflow', () => {
  it('com nada selecionado, mostra a política de erro e o arredondamento padrão', () => {
    simulateApi();
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Workflow' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toHaveTextContent('Gerar erro');
    const rounding = screen.getByRole('group', { name: 'Arredondamento padrão' });
    expect(within(rounding).getByRole('textbox', { name: 'Casas decimais' })).toHaveValue('2');
    expect(within(rounding).getByRole('combobox', { name: 'Modo de arredondamento' })).toHaveTextContent('Meio para cima');
  });

  it('cada mudança vai para o rascunho; o workflow não tem "Herdar do workflow"', async () => {
    simulateApi();
    const { user } = renderPanel();

    await user.click(screen.getByRole('combobox', { name: 'Política de erro' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Gerar erro',
      'Deixar vazio com aviso',
      'Usar valor padrão',
    ]);
    await user.click(screen.getByRole('option', { name: 'Usar valor padrão' }));
    expect(currentDefinition().settings.error_policy).toBe('default_value');

    await choose(user, 'Modo de arredondamento', 'Meio para o par');
    const scale = screen.getByRole('textbox', { name: 'Casas decimais' });
    await user.tripleClick(scale);
    await user.paste('4');
    expect(currentDefinition().settings).toEqual({ error_policy: 'default_value', rounding: { scale: 4, mode: 'half_even' } });

    await user.tripleClick(scale);
    await user.paste('x');
    expect(scale).toHaveAccessibleDescription(expect.stringContaining('Use um número inteiro de 0 a 18.'));
    expect(currentDefinition().settings.rounding.scale).toBe(4);
  });

  it('mostra o problema no campo do seu path e os do workflow sem campo no topo', async () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [
        problem('invalid_constant', 'As casas vão de 0 a 18.', 'settings.rounding.scale'),
        problem('cycle', 'Ciclo: a → b → a.', null),
      ],
    });
    renderPanel({ draft, item: { type: 'workflow' }, field: 'settings.rounding.scale' });

    const scale = screen.getByRole('textbox', { name: 'Casas decimais' });
    expect(scale).toHaveAccessibleDescription(expect.stringContaining('As casas vão de 0 a 18.'));
    expect(within(screen.getByRole('list', { name: 'Problemas' })).getByText('Ciclo: a → b → a.')).toBeInTheDocument();
    await waitFor(() => expect(scale).toHaveFocus());
  });

  it('só leitura: tudo desabilitado, com o motivo', () => {
    simulateApi();
    renderPanel({ readOnly: true });

    const reason = 'Você não tem permissão para editar este workflow';
    expect(screen.getByText(reason, { selector: 'p > span' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Casas decimais' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Casas decimais' })).toHaveAccessibleDescription(expect.stringContaining(reason));
    expect(screen.getByRole('combobox', { name: 'Política de erro' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Modo de arredondamento' })).toBeDisabled();
  });
});
