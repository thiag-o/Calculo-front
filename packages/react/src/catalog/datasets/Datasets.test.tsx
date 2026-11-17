import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasets } from '.';
import {
  EXCEL_DATASET,
  EXCEL_FILE,
  POSTGRES,
  READ_ONLY_PERMISSIONS,
  SQL_DATASET,
  SQL_SERVER,
  TABLE_DATASET,
  json,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }));
  api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole('table', { name: 'Datasets do tenant' });
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('Datasets: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json({ items: [TABLE_DATASET] }));
    api.respond('GET /v1/datasets', pending.promise);
    renderScreen(<Datasets />);

    expect(screen.getByRole('heading', { level: 2, name: 'Datasets' })).toBeInTheDocument();
    expect(table()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando datasets do tenant');

    pending.release();
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
    expect(table()).not.toHaveAttribute('aria-busy');
  });

  it('mostra nome, tipo, origem e a data das colunas de cada tipo de dataset', async () => {
    api.respond('GET /v1/datasets', json({ items: [TABLE_DATASET, SQL_DATASET, EXCEL_DATASET] }));
    renderScreen(<Datasets />);

    expect(await screen.findByText('3 datasets')).toBeInTheDocument();
    const tableRow = rowOf('Itens de nota fiscal');
    expect(within(tableRow).getByText('Tabela ou view')).toBeInTheDocument();
    expect(await within(tableRow).findByText('Postgres de exemplo')).toBeInTheDocument();
    expect(within(tableRow).getByText('public.itens_nf')).toBeInTheDocument();
    expect(within(tableRow).getByText(/^\d{2}\/\d{2}\/2026 às \d{2}:\d{2}$/)).toBeInTheDocument();

    const sqlRow = rowOf('Campanhas ativas');
    expect(within(sqlRow).getByText('SQL livre')).toBeInTheDocument();
    expect(within(sqlRow).getByText('ERP SQL Server')).toBeInTheDocument();

    const excelRow = rowOf('Metas por vendedor');
    expect(within(excelRow).getByText('Excel')).toBeInTheDocument();
    expect(await within(excelRow).findByText('metas-2026.xlsx')).toBeInTheDocument();
    expect(within(excelRow).getByText('Aba Vendas')).toBeInTheDocument();
  });

  it('não busca os arquivos Excel quando nenhum dataset vem de Excel', async () => {
    api.respond('GET /v1/datasets', json({ items: [TABLE_DATASET] }));
    renderScreen(<Datasets />);

    expect(await screen.findByText('Postgres de exemplo')).toBeInTheDocument();
    expect(api.callsTo('GET /v1/excel-files')).toHaveLength(0);
  });

  it('abre o detalhe pelo nome quando a tela recebe onOpenDataset', async () => {
    api.respond('GET /v1/datasets', json({ items: [TABLE_DATASET] }));
    const onOpenDataset = vi.fn();
    const { user } = renderScreen(<Datasets onOpenDataset={onOpenDataset} />);

    await user.click(await screen.findByRole('button', { name: 'Itens de nota fiscal' }));
    expect(onOpenDataset).toHaveBeenCalledWith(TABLE_DATASET.id);
  });

  it('sem onOpenDataset, o nome é só texto', async () => {
    api.respond('GET /v1/datasets', json({ items: [TABLE_DATASET] }));
    renderScreen(<Datasets />);

    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Itens de nota fiscal' })).not.toBeInTheDocument();
  });

  it('mostra o estado vazio com a ação Novo dataset', async () => {
    api.respond('GET /v1/datasets', json({ items: [] }));
    renderScreen(<Datasets />);

    expect(await screen.findByText('Nenhum dataset ainda')).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'Novo dataset' })).toHaveLength(2);
  });

  it('mostra o erro com Tentar de novo e recarrega', async () => {
    api.respond('GET /v1/datasets', problem(503, 'unavailable'), json({ items: [TABLE_DATASET] }));
    const { user } = renderScreen(<Datasets />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os datasets');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Itens de nota fiscal')).toBeInTheDocument();
  });

  it('sem permissão, explica e não oferece Tentar de novo', async () => {
    api.respond('GET /v1/datasets', problem(403, 'no_permission'));
    renderScreen(<Datasets />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para no_permission.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('sem datasets.manage, a lista é só de leitura', async () => {
    api = simulateApi(READ_ONLY_PERMISSIONS);
    api.respond('GET /v1/connections', json({ items: [POSTGRES] }));
    api.respond('GET /v1/datasets', json({ items: [] }));
    renderScreen(<Datasets />);

    expect(await screen.findByText('Quem gerencia datasets no tenant ainda não criou nenhum.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo dataset' })).not.toBeInTheDocument();
  });
});
