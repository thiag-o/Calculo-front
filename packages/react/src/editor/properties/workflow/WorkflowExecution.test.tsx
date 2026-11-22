import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from '../properties.test-support';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Execução do workflow', () => {
  it('mostra o limite de erro e o nível do trace, cada um com a sua explicação', () => {
    simulateApi();
    renderPanel();

    const section = screen.getByRole('group', { name: 'Execução' });
    const limit = within(section).getByRole('textbox', { name: 'Limite de erro (%)' });
    expect(limit).toHaveValue('5');
    expect(limit).toHaveAccessibleDescription(expect.stringContaining('registros com erro passam deste percentual'));
    const trace = within(section).getByRole('combobox', { name: 'Nível do trace' });
    expect(trace).toHaveTextContent('Padrão');
    expect(trace).toHaveAccessibleDescription(expect.stringContaining('Guarda os valores das entradas'));
  });

  it('o limite é digitado no padrão brasileiro, de 0 a 100 com até 2 casas', async () => {
    simulateApi();
    const { user } = renderPanel();

    const limit = screen.getByRole('textbox', { name: 'Limite de erro (%)' });
    await user.tripleClick(limit);
    await user.paste('2,5');
    expect(currentDefinition().settings.error_limit_percent).toBe('2.5');

    await user.tripleClick(limit);
    await user.paste('150');
    expect(limit).toHaveAccessibleDescription(expect.stringContaining('Use um percentual de 0 a 100, com até 2 casas, como 2,5.'));
    expect(currentDefinition().settings.error_limit_percent).toBe('2.5');
  });

  it('o nível do trace oferece Mínimo, Padrão e Completo e troca a explicação', async () => {
    simulateApi();
    const { user } = renderPanel();

    const trace = screen.getByRole('combobox', { name: 'Nível do trace' });
    await user.click(trace);
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Mínimo', 'Padrão', 'Completo']);
    await user.click(screen.getByRole('option', { name: 'Mínimo' }));
    expect(currentDefinition().settings.trace_level).toBe('minimal');
    expect(trace).toHaveAccessibleDescription(expect.stringContaining('Guarda só os hashes'));
  });

  it('mostra o problema no campo do seu path, e não no topo', async () => {
    simulateApi();
    const draft = exampleDraft({ problems: [problem('definition_invalid', 'Este campo não é mais aceito. Corrija-o e salve de novo.', 'settings.error_limit_percent')] });
    renderPanel({ draft, item: { type: 'workflow' }, field: 'settings.error_limit_percent' });

    const limit = screen.getByRole('textbox', { name: 'Limite de erro (%)' });
    expect(limit).toHaveAccessibleDescription(expect.stringContaining('Este campo não é mais aceito.'));
    expect(screen.queryByRole('list', { name: 'Problemas' })).not.toBeInTheDocument();
    await waitFor(() => expect(limit).toHaveFocus());
  });

  it('só leitura: os dois campos desabilitados, com o motivo', () => {
    simulateApi();
    renderPanel({ readOnly: true });

    const reason = 'Você não tem permissão para editar este workflow';
    const limit = screen.getByRole('textbox', { name: 'Limite de erro (%)' });
    expect(limit).toBeDisabled();
    expect(limit).toHaveAccessibleDescription(expect.stringContaining(reason));
    expect(screen.getByRole('combobox', { name: 'Nível do trace' })).toBeDisabled();
  });
});
