import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOALS_DATASET,
  ITEMS_DATASET,
  ITEM_VALUE,
  NF_ID,
  currentDefinition,
  exampleBatchSource,
  exampleDraft,
  problem,
  renderWithDraft,
  simulateApi,
} from './batch-source.test-support';
import { BatchSourceProperties } from './BatchSourceProperties';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const READ_ONLY_REASON = 'Você não tem permissão para editar este workflow';

function renderSource(batchSource = exampleBatchSource(), options: Parameters<typeof renderWithDraft>[1] = {}) {
  return renderWithDraft(<BatchSourceProperties />, { draft: exampleDraft({ batchSource }), ...options });
}

function part(name: string) {
  return screen.getByRole('group', { name });
}

describe('Propriedades da fonte do lote', () => {
  it('mostra o dataset com o tipo, as variáveis trazidas, a chave, os filtros e a ordenação', async () => {
    simulateApi();
    renderSource();

    expect(screen.getByRole('heading', { name: 'Fonte do lote' })).toBeInTheDocument();
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
    expect(screen.getByText('Tabela ou view')).toBeInTheDocument();

    const variables = part('Variáveis trazidas');
    const value = await within(variables).findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' });
    expect(value).toBeChecked();
    expect(within(variables).getByRole('textbox', { name: 'Nome no workflow (valor_item)' })).toHaveValue('valor_item');

    const key = part('Chave do registro');
    expect(within(key).getByRole('checkbox', { name: 'nf_id' })).toBeChecked();
    expect(within(key).getByRole('checkbox', { name: 'item_seq' })).toBeChecked();
    expect(within(key).getByRole('checkbox', { name: 'valor_item' })).not.toBeChecked();

    expect(within(part('Filtros')).getByText('status = "A"')).toBeInTheDocument();
    const order = part('Ordenação');
    expect(within(order).getByRole('combobox', { name: 'Variável (critério 1)' })).toHaveTextContent('data_emissao');
    expect(within(order).getByRole('combobox', { name: 'Direção (critério 1)' })).toHaveTextContent('Crescente');
    expect(within(order).getByText('A chave entra como último critério')).toBeVisible();
  });

  it('marcar uma variável a traz com o nome do catálogo; desmarcar tira também da chave e da ordenação', async () => {
    simulateApi();
    const { user } = renderSource(exampleBatchSource({ key: [], filters: [], order_by: [], outputs: [] }));

    const variables = part('Variáveis trazidas');
    await user.click(await within(variables).findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' }));
    await user.click(within(variables).getByRole('checkbox', { name: 'nf_id Inteiro' }));
    expect(currentDefinition().root.batch_source!.outputs).toEqual([
      { variable_id: ITEM_VALUE.id, name: 'valor_item' },
      { variable_id: NF_ID.id, name: 'nf_id' },
    ]);
    expect(within(variables).getByRole('textbox', { name: 'Nome no workflow (nf_id)' })).toHaveValue('nf_id');

    // The key: one or more of the variables brought.
    const key = part('Chave do registro');
    expect(within(key).getAllByRole('checkbox')).toEqual([
      within(key).getByRole('checkbox', { name: 'valor_item' }),
      within(key).getByRole('checkbox', { name: 'nf_id' }),
    ]);
    await user.click(within(key).getByRole('checkbox', { name: 'nf_id' }));
    expect(currentDefinition().root.batch_source!.key).toEqual(['nf_id']);

    await user.click(within(part('Ordenação')).getByRole('button', { name: 'Incluir critério' }));
    expect(currentDefinition().root.batch_source!.order_by).toEqual([{ variable: 'valor_item', direction: 'asc' }]);

    await user.click(within(variables).getByRole('checkbox', { name: 'nf_id Inteiro' }));
    await user.click(within(variables).getByRole('checkbox', { name: 'valor_item Decimal (2 casas)' }));
    expect(currentDefinition().root.batch_source).toEqual({ ...exampleBatchSource(), key: [], filters: [], order_by: [], outputs: [] });
    expect(within(key).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(key).getByText('Marque as variáveis trazidas para escolher a chave.')).toBeVisible();
  });

  it('trocar o nome no workflow leva a chave, os filtros e a ordenação junto; nome fora da regra não vai ao rascunho', async () => {
    simulateApi();
    const { user } = renderSource();

    const name = await screen.findByRole('textbox', { name: 'Nome no workflow (nf_id)' });
    await user.tripleClick(name);
    await user.paste('nota_id');
    const source = currentDefinition().root.batch_source!;
    expect(source.outputs[0]).toEqual({ variable_id: NF_ID.id, name: 'nota_id' });
    expect(source.key).toEqual(['nota_id', 'item_seq']);
    expect(within(part('Chave do registro')).getByRole('checkbox', { name: 'nota_id' })).toBeChecked();

    const status = screen.getByRole('textbox', { name: 'Nome no workflow (status)' });
    await user.tripleClick(status);
    await user.paste('situacao');
    expect(currentDefinition().root.batch_source!.filters).toEqual([{ variable: 'situacao', operator: '=', values: ['"A"'] }]);

    await user.tripleClick(name);
    await user.paste('Nota');
    expect(name).toHaveAccessibleDescription(expect.stringContaining('letras minúsculas sem acento'));
    expect(currentDefinition().root.batch_source!.outputs[0]!.name).toBe('nota_id');
  });

  it('reordena a ordenação pelas setas, troca a direção e remove um critério', async () => {
    simulateApi();
    const { user } = renderSource(
      exampleBatchSource({
        order_by: [
          { variable: 'data_emissao', direction: 'asc' },
          { variable: 'valor_item', direction: 'desc' },
        ],
      }),
    );
    const order = part('Ordenação');

    expect(within(order).getByRole('button', { name: 'Mover para cima (critério 1)' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(order).getByRole('button', { name: 'Mover para baixo (critério 2)' })).toHaveAttribute('aria-disabled', 'true');
    const down = within(order).getByRole('button', { name: 'Mover para baixo (critério 1)' });
    await user.click(down);
    expect(currentDefinition().root.batch_source!.order_by).toEqual([
      { variable: 'valor_item', direction: 'desc' },
      { variable: 'data_emissao', direction: 'asc' },
    ]);
    expect(within(order).getByRole('combobox', { name: 'Variável (critério 1)' })).toHaveTextContent('valor_item');

    await user.click(within(order).getByRole('button', { name: 'Mover para cima (critério 2)' }));
    expect(currentDefinition().root.batch_source!.order_by.map((item) => item.variable)).toEqual(['data_emissao', 'valor_item']);

    await user.click(within(order).getByRole('combobox', { name: 'Direção (critério 1)' }));
    await user.click(await screen.findByRole('option', { name: 'Decrescente' }));
    expect(currentDefinition().root.batch_source!.order_by[0]).toEqual({ variable: 'data_emissao', direction: 'desc' });

    await user.click(within(order).getByRole('button', { name: 'Remover critério (critério 2)' }));
    expect(currentDefinition().root.batch_source!.order_by).toEqual([{ variable: 'data_emissao', direction: 'desc' }]);
  });

  it('trocar o dataset pede confirmação e recomeça as variáveis, a chave, os filtros e a ordenação', async () => {
    simulateApi();
    const { user } = renderSource();

    await user.click(await screen.findByRole('button', { name: 'Trocar dataset' }));
    const search = screen.getByRole('searchbox', { name: 'Buscar dataset' });
    await waitFor(() => expect(search).toHaveFocus());
    const datasets = screen.getByRole('list', { name: 'Datasets do catálogo' });
    expect(within(datasets).getByRole('button', { name: 'Itens de nota fiscal Tabela ou view' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(datasets).getByRole('button', { name: 'Vendas do mês SQL livre' })).toBeInTheDocument();

    await user.type(search, 'metas');
    expect(within(datasets).getAllByRole('button').map((button) => button.textContent)).toEqual(['Metas por loja Excel']);
    await user.click(within(datasets).getByRole('button', { name: 'Metas por loja Excel' }));

    const dialog = await screen.findByRole('dialog', { name: 'Trocar dataset' });
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining('5 variáveis trazidas, a chave, os filtros e a ordenação saem'));
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(currentDefinition().root.batch_source!.dataset_id).toBe(ITEMS_DATASET.id);

    await user.click(within(datasets).getByRole('button', { name: 'Metas por loja Excel' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Trocar dataset' })).getByRole('button', { name: 'Trocar dataset' }));
    expect(currentDefinition().root.batch_source).toEqual({ dataset_id: GOALS_DATASET.id, key: [], filters: [], order_by: [], outputs: [] });
    expect(await screen.findByText('Metas por loja')).toBeInTheDocument();
    expect(await screen.findByText('Este dataset ainda não tem variáveis. Crie as variáveis em Catálogo › Datasets.')).toBeVisible();
  });

  it('mostra missing_batch_source_key na chave e leva o foco a ela pela aba Problemas', async () => {
    simulateApi();
    const message = 'A fonte do lote precisa de uma chave com variáveis trazidas por ela.';
    const draft = exampleDraft({
      batchSource: exampleBatchSource({ key: [] }),
      problems: [
        problem('missing_batch_source_key', message, 'root.batch_source.key'),
        problem('missing_order_by', 'A fonte do lote precisa de ordenação.', 'root.batch_source.order_by'),
        problem('unknown_dataset', 'O dataset não existe mais no catálogo.', 'root.batch_source.dataset_id'),
        problem('duplicate_name', 'O nome pontos já existe.', 'root.batch_source.outputs[2].name'),
      ],
    });
    renderWithDraft(<BatchSourceProperties />, { draft, item: { type: 'inputs' }, field: 'root.batch_source.key' });

    const key = part('Chave do registro');
    expect(key).toHaveAccessibleDescription(message);
    const first = within(key).getByRole('checkbox', { name: 'nf_id' });
    await waitFor(() => expect(first).toHaveFocus());
    expect(part('Ordenação')).toHaveAccessibleDescription(expect.stringContaining('A fonte do lote precisa de ordenação.'));
    expect(screen.getByText('O dataset não existe mais no catálogo.')).toBeVisible();
    expect(await screen.findByRole('textbox', { name: 'Nome no workflow (valor_item)' })).toHaveAccessibleDescription(
      expect.stringContaining('O nome pontos já existe.'),
    );
    expect(screen.queryByRole('list', { name: 'Problemas da fonte do lote' })).not.toBeInTheDocument();
  });

  it('casa missing_batch_source_key e missing_order_by pelo code, mesmo sem path ou com o path da fonte inteira', async () => {
    simulateApi();
    const keyMessage = 'A fonte do lote precisa de uma chave com variáveis trazidas por ela.';
    const orderMessage = 'A fonte do lote precisa de ordenação.';
    const draft = exampleDraft({
      batchSource: exampleBatchSource({ key: [], order_by: [] }),
      problems: [problem('missing_batch_source_key', keyMessage, null), problem('missing_order_by', orderMessage, 'root.batch_source')],
    });
    renderWithDraft(<BatchSourceProperties />, { draft });

    expect(part('Chave do registro')).toHaveAccessibleDescription(keyMessage);
    expect(part('Ordenação')).toHaveAccessibleDescription(expect.stringContaining(orderMessage));
    expect(screen.getAllByText(keyMessage)).toHaveLength(1);
    expect(screen.getAllByText(orderMessage)).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Problemas da fonte do lote' })).not.toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' })).toBeInTheDocument();
  });

  it('os estados da lista de variáveis: carregando e erro com Tentar de novo', async () => {
    simulateApi({ variables: { [ITEMS_DATASET.id]: 500 } });
    renderSource();

    expect(screen.getByText('Carregando variáveis do dataset')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível listar as variáveis do dataset');
    expect(within(part('Variáveis trazidas')).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('só leitura: tudo desabilitado, com o motivo', async () => {
    simulateApi();
    renderSource(exampleBatchSource(), { readOnly: true });

    expect(screen.getByText(READ_ONLY_REASON, { selector: 'p > span' })).toBeVisible();
    const value = await screen.findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' });
    expect(value).toBeDisabled();
    expect(value).toHaveAccessibleDescription(expect.stringContaining(READ_ONLY_REASON));
    expect(screen.getByRole('textbox', { name: 'Nome no workflow (valor_item)' })).toBeDisabled();
    for (const box of within(part('Chave do registro')).getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Variável (critério 1)' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Direção (critério 1)' })).toBeDisabled();
    for (const name of ['Trocar dataset', 'Incluir critério', 'Remover critério (critério 1)']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription(expect.stringContaining(READ_ONLY_REASON));
    }
  });
});
