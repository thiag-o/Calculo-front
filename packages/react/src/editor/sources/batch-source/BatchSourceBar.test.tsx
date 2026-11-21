import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftSymbol } from '../../draft';
import { exampleBatchSource, renderWithDraft, simulateApi } from './batch-source.test-support';
import { BatchSourceBar } from './BatchSourceBar';

vi.mock('../../../formula', () => ({ FormulaEditor: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function symbol(name: string, type: DraftSymbol['type'], scale: number | null = null): DraftSymbol {
  return { name, type, scale, cardinality: 'linear', list: null, origin: 'batch_source', node_id: null, group_id: null };
}

const SYMBOLS = [symbol('nf_id', 'integer'), symbol('item_seq', 'integer'), symbol('valor_item', 'decimal', 2), symbol('status', 'text')];

describe('Barra Fonte do lote do canvas', () => {
  it('mostra o dataset, as variáveis com o tipo e a chave com o ícone', async () => {
    simulateApi();
    renderWithDraft(
      <BatchSourceBar
        source={exampleBatchSource()}
        symbols={SYMBOLS}
        renderHandle={(row) => <span data-testid={`porta-${row.name}`} />}
      />,
    );

    expect(screen.getByText('Fonte do lote')).toBeInTheDocument();
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
    expect(screen.getByText('· Tabela ou view')).toBeInTheDocument();

    const rows = within(screen.getByRole('list', { name: 'Variáveis da fonte do lote' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['nf_idinteger', 'item_seqinteger', 'valor_itemdecimal(2)', 'statustext', 'data_emissao']);
    expect(within(rows[0]!).getByRole('img', { name: 'chave' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('img', { name: 'chave' })).toBeInTheDocument();
    expect(within(rows[2]!).queryByRole('img', { name: 'chave' })).not.toBeInTheDocument();
    expect(screen.getByTestId('porta-valor_item')).toBeInTheDocument();
  });

  it('sem variáveis trazidas diz que não há variável; dataset fora do catálogo é dito', async () => {
    simulateApi({ datasets: [] });
    renderWithDraft(<BatchSourceBar source={exampleBatchSource({ outputs: [], key: [] })} symbols={[]} />);

    expect(screen.getByText('Nenhuma variável')).toBeInTheDocument();
    expect(await screen.findByText('Dataset fora do catálogo')).toBeInTheDocument();
  });

  it('sem permissão para ver o catálogo diz o motivo, sem carregar para sempre, e segue mostrando as variáveis pelo nome', async () => {
    simulateApi({ datasets: 403 });
    renderWithDraft(<BatchSourceBar source={exampleBatchSource()} symbols={SYMBOLS} />);

    expect(await screen.findByText('Sem permissão para ver o dataset')).toBeInTheDocument();
    expect(screen.queryByText('Carregando dataset')).not.toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Variáveis da fonte do lote' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toContain('nf_idinteger');
    expect(within(rows[0]!).getByRole('img', { name: 'chave' })).toBeInTheDocument();
  });

  it('outro erro de leitura diz que não foi possível carregar o dataset, com o motivo', async () => {
    simulateApi({ datasets: 500 });
    renderWithDraft(<BatchSourceBar source={exampleBatchSource()} symbols={SYMBOLS} />);

    expect(await screen.findByText(/Não foi possível carregar o dataset\. Falha ao ler o catálogo\./)).toBeInTheDocument();
    expect(screen.queryByText('Carregando dataset')).not.toBeInTheDocument();
  });
});
