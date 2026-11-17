import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelFileList } from '.';
import {
  EXCEL_FILE,
  OTHER_FILE,
  READ_ONLY_PERMISSIONS,
  json,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './files.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole('table', { name: 'Arquivos do tenant' });
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('Arquivos: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json({ items: [EXCEL_FILE] }));
    api.respond('GET /v1/excel-files', pending.promise);
    renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Arquivos' })).toBeInTheDocument();
    expect(table()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando arquivos do tenant')).toBeInTheDocument();

    pending.release();
    expect(await screen.findByRole('button', { name: 'metas-2026.xlsx' })).toBeInTheDocument();
    expect(table()).not.toHaveAttribute('aria-busy');
  });

  it('mostra nome, abas, tamanho e data de envio de cada arquivo', async () => {
    api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE, OTHER_FILE] }));
    renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    expect(await screen.findByText('2 arquivos')).toBeInTheDocument();
    const row = rowOf('metas-2026.xlsx');
    expect(within(row).getByText('2 abas')).toBeInTheDocument();
    expect(within(row).getByText('Vendas, Metas')).toBeInTheDocument();
    expect(within(row).getByText('20 KB')).toBeInTheDocument();
    expect(within(row).getByText(/^\d{2}\/\d{2}\/2026 às \d{2}:\d{2}$/)).toBeInTheDocument();

    const other = rowOf('comissoes-outubro');
    expect(within(other).getByText('1 aba')).toBeInTheDocument();
    expect(within(other).getByText('1,2 MB')).toBeInTheDocument();
  });

  it('abre o detalhe pelo nome do arquivo', async () => {
    api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE] }));
    const onOpen = vi.fn();
    const { user } = renderScreen(<ExcelFileList onOpen={onOpen} />);

    await user.click(await screen.findByRole('button', { name: 'metas-2026.xlsx' }));
    expect(onOpen).toHaveBeenCalledWith(EXCEL_FILE.id);
  });

  it('volta do detalhe com o foco no nome do arquivo', async () => {
    api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE, OTHER_FILE] }));
    renderScreen(<ExcelFileList onOpen={vi.fn()} focusFileId={OTHER_FILE.id} />);

    const link = await screen.findByRole('button', { name: OTHER_FILE.file_name });
    expect(link).toHaveFocus();
  });

  it('diz que o arquivo removido no detalhe saiu', async () => {
    api.respond('GET /v1/excel-files', json({ items: [] }));
    renderScreen(<ExcelFileList onOpen={vi.fn()} deletedFileName="metas-2026.xlsx" />);

    expect(await screen.findByText('Arquivo metas-2026.xlsx removido.')).toBeInTheDocument();
  });

  it('vazio, com datasets.manage: aponta para a área de envio', async () => {
    api.respond('GET /v1/excel-files', json({ items: [] }));
    renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    expect(await screen.findByText('Nenhum arquivo ainda')).toBeInTheDocument();
    expect(screen.getByText(/Arraste uma planilha .xlsx para a área acima ou use Enviar arquivo/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Área para soltar o arquivo Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar arquivo' })).toBeInTheDocument();
  });

  it('sem datasets.manage: lista só para leitura, sem área de envio', async () => {
    api = simulateApi(READ_ONLY_PERMISSIONS);
    api.respond('GET /v1/excel-files', json({ items: [] }));
    renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    expect(await screen.findByText('Quem gerencia datasets no tenant ainda não enviou nenhuma planilha.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Área para soltar o arquivo Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });

  it('erro ao carregar: diz o que houve e tenta de novo', async () => {
    api.respond('GET /v1/excel-files', problem(500, 'internal_error'), json({ items: [EXCEL_FILE] }));
    const { user } = renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os arquivos');
    expect(alert).toHaveTextContent('Texto do servidor para internal_error.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: 'metas-2026.xlsx' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro de permissão: sem "Tentar de novo"', async () => {
    api.respond('GET /v1/excel-files', problem(403, 'no_permission'));
    renderScreen(<ExcelFileList onOpen={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para no_permission.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});
