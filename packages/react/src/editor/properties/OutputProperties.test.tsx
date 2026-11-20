import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentDefinition, exampleDraft, problem, renderPanel, simulateApi } from './properties.test-support';

vi.mock('../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const OUTPUT = { type: 'output' } as const;

function fieldItem(name: string) {
  return screen.getByRole('group', { name: `Campo ${name}` });
}

describe('Propriedades da saída', () => {
  it('lista os campos com o nome e a variável; a variável vem só dos símbolos lineares', async () => {
    simulateApi();
    const { user } = renderPanel({ item: OUTPUT });

    expect(screen.getByRole('heading', { name: 'Saída' })).toBeInTheDocument();
    const pontos = fieldItem('pontos');
    expect(within(pontos).getByRole('textbox', { name: 'Nome' })).toHaveValue('pontos');
    expect(within(pontos).getByRole('combobox', { name: 'Variável' })).toHaveTextContent('pontos');

    await user.click(within(pontos).getByRole('combobox', { name: 'Variável' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'valor_item',
      'categoria',
      'fator',
      'pontos_historico',
      'pontos',
    ]);
    await user.click(screen.getByRole('option', { name: 'fator' }));
    expect(currentDefinition().root.output.fields).toEqual([{ name: 'pontos', variable: 'fator' }]);

    await user.type(within(pontos).getByRole('textbox', { name: 'Nome' }), '_total');
    expect(currentDefinition().root.output.fields).toEqual([{ name: 'pontos_total', variable: 'fator' }]);
  });

  it('inclui um campo com a primeira variável ainda fora da saída e põe o foco no nome', async () => {
    simulateApi();
    const { user } = renderPanel({ item: OUTPUT });

    await user.click(screen.getByRole('button', { name: 'Incluir campo' }));
    expect(currentDefinition().root.output.fields).toEqual([
      { name: 'pontos', variable: 'pontos' },
      { name: 'valor_item', variable: 'valor_item' },
    ]);
    await waitFor(() => expect(within(fieldItem('valor_item')).getByRole('textbox', { name: 'Nome' })).toHaveFocus());
  });

  it('reordena e remove campos', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.root.output.fields.push({ name: 'fator', variable: 'fator' });
    const { user } = renderPanel({ draft, item: OUTPUT });

    expect(within(fieldItem('pontos')).getByRole('button', { name: 'Mover para cima' })).toHaveAccessibleDescription('Já é o primeiro campo');
    await user.click(within(fieldItem('fator')).getByRole('button', { name: 'Mover para cima' }));
    expect(currentDefinition().root.output.fields.map((field) => field.name)).toEqual(['fator', 'pontos']);

    await user.click(within(fieldItem('fator')).getByRole('button', { name: 'Remover campo' }));
    expect(currentDefinition().root.output.fields.map((field) => field.name)).toEqual(['pontos']);
  });

  it('mostra cada problema junto do campo do seu path, e uma variável que sumiu continua escolhida', () => {
    simulateApi();
    const draft = exampleDraft({
      problems: [problem('unknown_variable', 'pontos_final não existe neste ponto do fluxo.', 'root.output.fields[0].variable')],
    });
    draft.definition.root.output.fields = [{ name: 'pontos', variable: 'pontos_final' }];
    renderPanel({ draft, item: OUTPUT });

    const variable = within(fieldItem('pontos')).getByRole('combobox', { name: 'Variável' });
    expect(variable).toHaveTextContent('pontos_final');
    expect(variable).toHaveAccessibleDescription(expect.stringContaining('pontos_final não existe neste ponto do fluxo.'));
    expect(within(fieldItem('pontos')).getByRole('textbox', { name: 'Nome' })).not.toHaveAttribute('aria-invalid');
  });

  it('com a análise a caminho, o problema acompanha o campo movido e some com o campo removido; o resto é o mesmo objeto', async () => {
    simulateApi(() => 'pending');
    const draft = exampleDraft({
      problems: [problem('unknown_variable', 'pontos_final não existe neste ponto do fluxo.', 'root.output.fields[1].variable')],
    });
    draft.definition.root.output.fields = [
      { name: 'pontos', variable: 'pontos' },
      { name: 'final', variable: 'pontos_final' },
      { name: 'fator', variable: 'fator' },
    ];
    const { user, editor } = renderPanel({ draft, item: OUTPUT });
    const [pontos, final, fator] = editor().definition.root.output.fields;
    const variableOf = (name: string) => within(fieldItem(name)).getByRole('combobox', { name: 'Variável' });

    await user.click(within(fieldItem('final')).getByRole('button', { name: 'Mover para cima' }));
    expect(editor().definition.root.output.fields).toEqual([final, pontos, fator]);
    expect(editor().definition.root.output.fields[0]).toBe(final);
    expect(editor().definition.root.output.fields[1]).toBe(pontos);
    expect(editor().definition.root.output.fields[2]).toBe(fator);
    expect(variableOf('final')).toHaveAccessibleDescription(expect.stringContaining('pontos_final não existe'));
    expect(variableOf('pontos')).not.toHaveAttribute('aria-invalid');

    await user.type(within(fieldItem('pontos')).getByRole('textbox', { name: 'Nome' }), 's');
    expect(editor().definition.root.output.fields[0]).toBe(final);
    expect(editor().definition.root.output.fields[2]).toBe(fator);

    await user.click(within(fieldItem('final')).getByRole('button', { name: 'Remover campo' }));
    expect(editor().definition.root.output.fields[0]?.name).toBe('pontoss');
    expect(editor().definition.root.output.fields[1]).toBe(fator);
    expect(screen.queryByText(/pontos_final não existe/)).not.toBeInTheDocument();
  });

  it('avisa o nome repetido de campo de saída já na digitação', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.root.output.fields.push({ name: 'fator', variable: 'fator' });
    const { user } = renderPanel({ draft, item: OUTPUT });

    const name = within(fieldItem('fator')).getByRole('textbox', { name: 'Nome' });
    await user.tripleClick(name);
    await user.paste('pontos');
    expect(currentDefinition().root.output.fields.map((field) => field.name)).toEqual(['pontos', 'pontos']);
    expect(name).toHaveAccessibleDescription(expect.stringContaining('Já existe um campo de saída com este nome.'));
  });

  it('sem campos, diz o que falta; sem variável linear, não deixa incluir e diz por quê', () => {
    simulateApi();
    const draft = exampleDraft({ symbols: [] });
    draft.definition.root.output.fields = [];
    renderPanel({ draft, item: OUTPUT });

    expect(screen.getByText('Nenhum campo de saída')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Incluir campo' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('Declare uma entrada ou crie um bloco para ter uma variável para a saída');
  });

  it('só leitura: tudo desabilitado, com o motivo', async () => {
    simulateApi();
    const { user } = renderPanel({ item: OUTPUT, readOnly: true });

    const reason = 'Você não tem permissão para editar este workflow';
    expect(screen.getByText(reason, { selector: 'p > span' })).toBeVisible();
    expect(within(fieldItem('pontos')).getByRole('textbox', { name: 'Nome' })).toBeDisabled();
    expect(within(fieldItem('pontos')).getByRole('combobox', { name: 'Variável' })).toBeDisabled();
    for (const name of ['Incluir campo', 'Remover campo', 'Mover para cima', 'Mover para baixo']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
    await user.click(screen.getByRole('button', { name: 'Remover campo' }));
    expect(currentDefinition().root.output.fields).toHaveLength(1);
  });
});
