import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelFileDetail, type ExcelFileDetailProps } from '.';
import { IN_USE_REASON } from './DeleteExcelFileDialog';
import { FILE_IN_USE_MESSAGE } from './messages';
import {
  EMPTY_SHEET,
  EXCEL_FILE,
  READ_ONLY_PERMISSIONS,
  SHEET_DATASET,
  json,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './files.test-support';

let api: SimulatedApi;
const FILE_ROUTE = `GET /v1/excel-files/${EXCEL_FILE.id}`;

beforeEach(() => {
  api = simulateApi();
  api.respond(FILE_ROUTE, json(EXCEL_FILE));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDetail(props: Partial<ExcelFileDetailProps> = {}) {
  const onBack = vi.fn();
  const onDeleted = vi.fn();
  const rendered = renderScreen(<ExcelFileDetail fileId={EXCEL_FILE.id} onBack={onBack} onDeleted={onDeleted} {...props} />);
  return { ...rendered, onBack, onDeleted };
}

const columnsOf = (sheet: string) => screen.getByRole('table', { name: `Colunas da aba ${sheet}` });
const rowOf = (table: HTMLElement, column: string) => within(table).getByRole('row', { name: new RegExp(column) });

describe('Arquivo Excel: detalhe', () => {
  it('mostra o esqueleto e depois o nome, o tamanho, as abas, a data de envio e o SHA-256', async () => {
    const pending = pendingResponse(() => json(EXCEL_FILE));
    api.respond(FILE_ROUTE, pending.promise);
    renderDetail();

    expect(screen.getByText('Carregando o arquivo')).toBeInTheDocument();
    pending.release();

    expect(await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' })).toBeInTheDocument();
    expect(screen.getByText(/^20 KB · 2 abas · enviado em \d{2}\/\d{2}\/2026 às \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByText(EXCEL_FILE.sha256)).toBeInTheDocument();
  });

  it('cada aba é uma aba da tela, com as colunas e os tipos inferidos', async () => {
    const { user } = renderDetail();

    const tabs = await screen.findByRole('tablist', { name: 'Abas de metas-2026.xlsx' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Vendas', 'Metas']);
    expect(within(tabs).getByRole('tab', { name: 'Vendas' })).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByText('3 colunas')).toBeInTheDocument();
    expect(screen.getByText('1.000 linhas lidas para inferir os tipos')).toBeInTheDocument();
    const sales = columnsOf('Vendas');
    expect(within(rowOf(sales, 'vendedor')).getByText('Texto')).toBeInTheDocument();
    expect(within(rowOf(sales, 'valor')).getByText('Decimal (2 casas)')).toBeInTheDocument();
    expect(within(rowOf(sales, 'valor')).getByText('Sim')).toBeInTheDocument();
    expect(within(rowOf(sales, 'data_venda')).getByText('Data')).toBeInTheDocument();

    await user.click(within(tabs).getByRole('tab', { name: 'Metas' }));
    const goals = columnsOf('Metas');
    expect(within(rowOf(goals, 'mes')).getByText('Inteiro')).toBeInTheDocument();
    expect(screen.getByText('12 linhas lidas para inferir os tipos')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Colunas da aba Vendas' })).not.toBeInTheDocument();
  });

  it('aba sem cabeçalho nem linhas: diz o que falta', async () => {
    api.respond(FILE_ROUTE, json({ ...EXCEL_FILE, sheets: [EMPTY_SHEET] }));
    renderDetail();

    expect(await screen.findByText('Nenhuma coluna')).toBeInTheDocument();
    expect(screen.getByText(/A primeira linha da aba está vazia/)).toBeInTheDocument();
    expect(screen.getByText('Nenhuma linha abaixo do cabeçalho; as colunas ficam como Texto')).toBeInTheDocument();
  });

  it('arquivo sem abas: estado vazio', async () => {
    api.respond(FILE_ROUTE, json({ ...EXCEL_FILE, sheets: [] }));
    renderDetail();

    expect(await screen.findByText('Nenhuma aba')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('"Voltar para Arquivos" chama onBack', async () => {
    const { user, onBack } = renderDetail();
    await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' });
    await user.click(screen.getByRole('button', { name: 'Voltar para Arquivos' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('aberto da lista: o foco vai para o título', async () => {
    renderDetail({ focusTitle: true });
    expect(await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' })).toHaveFocus();
  });

  it('arquivo que não existe mais: diz o motivo, sem "Tentar de novo"', async () => {
    api.respond(FILE_ROUTE, problem(404, 'not_found'));
    renderDetail();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o arquivo');
    expect(alert).toHaveTextContent('Este arquivo não existe mais neste tenant.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar para Arquivos' })).toBeInTheDocument();
  });

  it('id mal formado (422 invalid_data): também diz que não existe, sem "Tentar de novo"', async () => {
    api.respond(FILE_ROUTE, problem(422, 'invalid_data'));
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Este arquivo não existe mais neste tenant.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('erro passageiro: "Tentar de novo" busca de novo', async () => {
    api.respond(FILE_ROUTE, problem(500, 'internal_error'), json(EXCEL_FILE));
    const { user } = renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para internal_error.');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' })).toBeInTheDocument();
  });

  it('sem datasets.manage: abas e colunas só para leitura', async () => {
    api = simulateApi(READ_ONLY_PERMISSIONS);
    api.respond(FILE_ROUTE, json(EXCEL_FILE));
    renderDetail();

    expect(await screen.findByRole('table', { name: 'Colunas da aba Vendas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo dataset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover arquivo' })).not.toBeInTheDocument();
  });
});

describe('Arquivo Excel: novo dataset de uma aba', () => {
  it('cria o dataset da aba aberta (type excel) e abre o dataset criado', async () => {
    api.respond('POST /v1/datasets', json({ ...SHEET_DATASET, name: 'Metas mensais', sheet: 'Metas' }, 201));
    const onOpenDataset = vi.fn();
    const { user } = renderDetail({ onOpenDataset });

    await user.click(await screen.findByRole('tab', { name: 'Metas' }));
    await user.click(screen.getByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    expect(dialog).toHaveAccessibleDescription(/Da aba Metas do arquivo metas-2026.xlsx/);
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('Metas');

    await user.clear(name);
    await user.click(name);
    await user.paste('  Metas mensais ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onOpenDataset).toHaveBeenCalledWith(SHEET_DATASET.id));
    const [request] = api.callsTo('POST /v1/datasets');
    expect(await request!.json()).toEqual({ type: 'excel', excel_file_id: EXCEL_FILE.id, sheet: 'Metas', name: 'Metas mensais' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem onOpenDataset: a aba diz que o dataset foi criado e o foco volta ao botão', async () => {
    api.respond('POST /v1/datasets', json(SHEET_DATASET, 201));
    const { user } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Dataset Vendas criado a partir da aba Vendas.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo dataset' })).toHaveFocus());
  });

  it('nome vazio: avisa no campo e não chama a API', async () => {
    const { user } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe o nome do dataset')).toBeInTheDocument();
    expect(api.callsTo('POST /v1/datasets')).toHaveLength(0);
  });

  it('dataset_already_exists: o erro vai para o campo Nome', async () => {
    api.respond('POST /v1/datasets', problem(409, 'dataset_already_exists'));
    const { user } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await waitFor(() =>
      expect(name).toHaveAccessibleDescription(/Já existe um dataset com esse nome neste tenant. Escolha outro nome./),
    );
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('unknown_sheet: diz que a aba não existe mais', async () => {
    api.respond('POST /v1/datasets', problem(422, 'unknown_sheet', { fields: { sheet: "Não existe a aba 'Vendas'." } }));
    const { user } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A aba não existe mais no arquivo.');
  });

  it('arquivo removido nesse meio tempo (invalid_data em excel_file_id): diz que o arquivo não existe mais', async () => {
    api.respond('POST /v1/datasets', problem(422, 'invalid_data', { fields: { excel_file_id: 'Arquivo inexistente.' } }));
    const { user } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este arquivo não existe mais neste tenant.');
  });
});

describe('Arquivo Excel: remover', () => {
  it('pede confirmação, remove e avisa quem usa a tela', async () => {
    api.respond(`DELETE /v1/excel-files/${EXCEL_FILE.id}`, new Response(null, { status: 204 }));
    const { user, onDeleted, queryClient } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    expect(dialog).toHaveAccessibleDescription(/metas-2026.xlsx sai do catálogo/);
    expect(queryClient.getQueryData(['catalog', 'files', 'detail', EXCEL_FILE.id])).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Remover arquivo' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('metas-2026.xlsx'));
    expect(api.callsTo(`DELETE /v1/excel-files/${EXCEL_FILE.id}`)).toHaveLength(1);
    // The deleted file's detail is out of the cache.
    expect(queryClient.getQueryData(['catalog', 'files', 'detail', EXCEL_FILE.id])).toBeUndefined();
  });

  it('cancelar não remove e devolve o foco ao botão', async () => {
    const { user, onDeleted } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(api.callsTo(`DELETE /v1/excel-files/${EXCEL_FILE.id}`)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remover arquivo' })).toHaveFocus());
  });

  it('arquivo em uso (excel_file_in_use): diz o que fazer e bloqueia o botão com o motivo', async () => {
    api.respond(`DELETE /v1/excel-files/${EXCEL_FILE.id}`, problem(409, 'excel_file_in_use'));
    const { user, onDeleted } = renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover arquivo' }));

    expect(await within(dialog).findByText(FILE_IN_USE_MESSAGE)).toBeInTheDocument();
    const button = within(dialog).getByRole('button', { name: 'Remover arquivo' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(IN_USE_REASON);
    await user.click(button);
    expect(api.callsTo(`DELETE /v1/excel-files/${EXCEL_FILE.id}`)).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
