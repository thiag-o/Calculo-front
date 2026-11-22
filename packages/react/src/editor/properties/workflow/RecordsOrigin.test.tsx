import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEMS_DATASET,
  currentDefinition,
  exampleBatchSource,
  exampleDraft,
  problem,
  renderWithDraft,
  simulateApi,
} from '../../sources/batch-source/batch-source.test-support';
import { WorkflowProperties } from './WorkflowProperties';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const READ_ONLY_REASON = 'Você não tem permissão para editar este workflow';

function origin() {
  return screen.getByRole('radiogroup', { name: 'Origem dos valores' });
}

function option(name: 'Entradas declaradas' | 'Fonte do lote') {
  return within(origin()).getByRole('radio', { name });
}

describe('Origem dos valores no painel do workflow', () => {
  it('trocar para a fonte do lote pede confirmação; as entradas só saem ao escolher o dataset, num passo só', async () => {
    simulateApi();
    const { user } = renderWithDraft(<WorkflowProperties />);
    const before = currentDefinition();

    expect(option('Entradas declaradas')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Os valores de cada registro são digitados no Calcular.')).toBeVisible();

    await user.click(option('Fonte do lote'));
    let dialog = await screen.findByRole('dialog', { name: 'Usar a fonte do lote' });
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining('2 entradas declaradas saem do workflow quando você escolher o dataset'));
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(option('Entradas declaradas')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('searchbox', { name: 'Buscar dataset' })).not.toBeInTheDocument();

    await user.click(option('Fonte do lote'));
    dialog = await screen.findByRole('dialog', { name: 'Usar a fonte do lote' });
    await user.click(within(dialog).getByRole('button', { name: 'Usar a fonte do lote' }));
    const search = await screen.findByRole('searchbox', { name: 'Buscar dataset' });
    await waitFor(() => expect(search).toHaveFocus());
    expect(option('Fonte do lote')).toHaveAttribute('aria-checked', 'true');
    // Nothing changed yet: the inputs only leave with the dataset.
    expect(currentDefinition()).toEqual(before);

    await user.type(search, 'itens');
    const datasets = await screen.findByRole('list', { name: 'Datasets do catálogo' });
    expect(within(datasets).getAllByRole('button')).toHaveLength(1);
    await user.click(within(datasets).getByRole('button', { name: 'Itens de nota fiscal Tabela ou view' }));

    const definition = currentDefinition();
    // The version written (3) is the save's (draft/queries.test.ts); the edit leaves the one the draft was opened in.
    expect(definition.schema_version).toBe(before.schema_version);
    expect(definition.root.inputs).toEqual([]);
    expect(definition.root.batch_source).toEqual({ dataset_id: ITEMS_DATASET.id, key: [], filters: [], order_by: [], outputs: [] });
    expect(definition.root.nodes).toEqual(before.root.nodes);
    expect(await screen.findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' })).not.toBeChecked();
    expect(screen.getByText('Cada linha do dataset é um registro do lote.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(currentDefinition()).toEqual(before);
    expect(option('Entradas declaradas')).toHaveAttribute('aria-checked', 'true');
  });

  it('voltar às entradas declaradas pede confirmação, que diz o que se perde', async () => {
    simulateApi();
    const { user } = renderWithDraft(<WorkflowProperties />, { draft: exampleDraft({ batchSource: exampleBatchSource() }) });

    expect(option('Fonte do lote')).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();

    await user.click(option('Entradas declaradas'));
    let dialog = await screen.findByRole('dialog', { name: 'Usar entradas declaradas' });
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining('A fonte do lote sai do workflow, com 5 variáveis, a chave, os filtros e a ordenação.'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(currentDefinition().root.batch_source).toEqual(exampleBatchSource());

    await user.click(option('Entradas declaradas'));
    dialog = await screen.findByRole('dialog', { name: 'Usar entradas declaradas' });
    await user.click(within(dialog).getByRole('button', { name: 'Usar entradas declaradas' }));
    expect(currentDefinition().root.batch_source).toBeNull();
    expect(option('Entradas declaradas')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('group', { name: 'Variáveis trazidas' })).not.toBeInTheDocument();
  });

  it('sem entradas declaradas não há o que perder: a busca abre sem confirmação, e voltar não muda nada', async () => {
    simulateApi();
    const draft = exampleDraft();
    draft.definition.root.inputs = [];
    const { user } = renderWithDraft(<WorkflowProperties />, { draft });
    const before = currentDefinition();

    await user.click(option('Fonte do lote'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('searchbox', { name: 'Buscar dataset' })).toBeVisible();
    expect(screen.getByText('Escolha o dataset dos registros. As entradas declaradas saem quando você escolher.')).toBeVisible();

    await user.click(option('Entradas declaradas'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Buscar dataset' })).not.toBeInTheDocument();
    expect(currentDefinition()).toEqual(before);
  });

  it('a busca de datasets: carregando, catálogo vazio e erro com Tentar de novo', async () => {
    const draft = exampleDraft();
    draft.definition.root.inputs = [];

    simulateApi({ datasets: 'pending' });
    let rendered = renderWithDraft(<WorkflowProperties />, { draft });
    await rendered.user.click(option('Fonte do lote'));
    expect(screen.getByText('Carregando datasets')).toBeInTheDocument();
    rendered.unmount();

    simulateApi({ datasets: [] });
    rendered = renderWithDraft(<WorkflowProperties />, { draft });
    await rendered.user.click(option('Fonte do lote'));
    expect(await screen.findByText('Nenhum dataset no catálogo. Crie um em Catálogo › Datasets.')).toBeVisible();
    rendered.unmount();

    simulateApi({ datasets: 500 });
    rendered = renderWithDraft(<WorkflowProperties />, { draft });
    await rendered.user.click(option('Fonte do lote'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível listar os datasets');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();

    await rendered.user.type(screen.getByRole('searchbox', { name: 'Buscar dataset' }), 'x');
    expect(screen.getByRole('searchbox', { name: 'Buscar dataset' })).toHaveValue('x');
  });

  it('mostra inputs_with_batch_source no controle da origem', () => {
    simulateApi();
    const message = 'Com a fonte do lote, o workflow não pode ter entradas declaradas.';
    const draft = exampleDraft({ batchSource: exampleBatchSource(), problems: [problem('inputs_with_batch_source', message, 'root.inputs')] });
    renderWithDraft(<WorkflowProperties />, { draft });

    expect(origin()).toHaveAccessibleDescription(message);
    expect(origin()).toHaveAttribute('aria-invalid', 'true');
  });

  it('missing_batch_source_key sem path aparece só na chave, não no topo do workflow', async () => {
    simulateApi();
    const message = 'A fonte do lote precisa de uma chave com variáveis trazidas por ela.';
    const draft = exampleDraft({ batchSource: exampleBatchSource({ key: [] }), problems: [problem('missing_batch_source_key', message, null)] });
    renderWithDraft(<WorkflowProperties />, { draft });

    expect(screen.getByRole('group', { name: 'Chave do registro' })).toHaveAccessibleDescription(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Problemas' })).not.toBeInTheDocument();
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
  });

  it('só leitura: a origem desabilitada, com o motivo', async () => {
    simulateApi();
    renderWithDraft(<WorkflowProperties />, { draft: exampleDraft({ batchSource: exampleBatchSource() }), readOnly: true });

    expect(option('Entradas declaradas')).toBeDisabled();
    expect(option('Fonte do lote')).toBeDisabled();
    expect(origin()).toHaveAccessibleDescription(expect.stringContaining(READ_ONLY_REASON));
    expect(await screen.findByRole('checkbox', { name: 'valor_item Decimal (2 casas)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trocar dataset' })).toHaveAttribute('aria-disabled', 'true');
  });
});
