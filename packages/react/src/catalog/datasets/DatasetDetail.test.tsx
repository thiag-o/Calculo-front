import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetDetail, Datasets } from '.';
import { COLUMNS_REFRESHED_MESSAGE } from './DatasetDetail';
import { DELETE_NOT_FOUND_REASON } from './DeleteDatasetDialog';
import {
  DATASET_ALREADY_EXISTS_MESSAGE,
  DATASET_NOT_FOUND_MESSAGE,
  REFRESH_INVALID_SQL_MESSAGE,
  REFRESH_UNKNOWN_OBJECT_MESSAGE,
} from './messages';
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
  setCsrfCookie,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

let api: SimulatedApi;

const DETAIL = `GET /v1/datasets/${TABLE_DATASET.id}`;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('token-csrf');
  api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }));
  api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE] }));
  api.respond(DETAIL, json(TABLE_DATASET));
  respondNoVariables(api);
});

/** Every dataset of these tests starts without variables (DatasetVariables.test.tsx covers them). */
function respondNoVariables(simulated: SimulatedApi) {
  for (const dataset of [TABLE_DATASET, SQL_DATASET, EXCEL_DATASET]) {
    simulated.respond(`GET /v1/datasets/${dataset.id}/variables`, json({ items: [] }));
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const columnsTable = () => screen.getByRole('table', { name: `Colunas do dataset ${TABLE_DATASET.name}` });

describe('Detalhe do dataset', () => {
  it('mostra o carregamento e depois o nome, a origem e as colunas com tipo de origem, tipo e anulável', async () => {
    const pending = pendingResponse(() => json(TABLE_DATASET));
    api.respond(DETAIL, pending.promise);
    renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o dataset');
    pending.release();

    expect(await screen.findByRole('heading', { level: 1, name: 'Itens de nota fiscal' })).toBeInTheDocument();
    expect(screen.getByText('Tabela ou view')).toBeInTheDocument();
    expect(await screen.findByText('Postgres de exemplo')).toBeInTheDocument();
    expect(screen.getByText('public.itens_nf')).toBeInTheDocument();
    expect(screen.getByText(/^Colunas lidas em \d{2}\/\d{2}\/2026 às \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Colunas' })).toBeInTheDocument();
    expect(screen.getByText('3 colunas')).toBeInTheDocument();

    const headers = within(columnsTable()).getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Nome', 'Tipo de origem', 'Tipo', 'Anulável', 'Variáveis']);
    const decimal = within(columnsTable()).getByRole('row', { name: /vl_itm/ });
    expect(within(decimal).getByText('numeric(12,2)')).toBeInTheDocument();
    expect(within(decimal).getByText('Decimal (2 casas)')).toBeInTheDocument();
    expect(within(decimal).getByText('Sim')).toBeInTheDocument();
    const integer = within(columnsTable()).getByRole('row', { name: /nf_id/ });
    expect(within(integer).getByText('Inteiro')).toBeInTheDocument();
    expect(within(integer).getByText('Não')).toBeInTheDocument();
  });

  it('coluna sem tipo correspondente aparece como sem suporte, com a explicação', async () => {
    renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    const unsupported = within(await screen.findByRole('table', { name: /Colunas do dataset/ })).getByRole('row', { name: /busca/ });
    expect(within(unsupported).getByText('Sem suporte')).toBeInTheDocument();
    expect(within(unsupported).getByText('tsvector')).toBeInTheDocument();
    expect(screen.getByText(/não podem virar variável/)).toBeInTheDocument();
  });

  it('mostra o SQL de um dataset de SQL e a aba de um dataset de Excel', async () => {
    api.respond(`GET /v1/datasets/${SQL_DATASET.id}`, json(SQL_DATASET));
    renderScreen(<DatasetDetail datasetId={SQL_DATASET.id} />);

    expect(await screen.findByRole('heading', { level: 2, name: 'SQL' })).toBeInTheDocument();
    expect(screen.getByText(SQL_DATASET.sql!)).toBeInTheDocument();
    expect(await screen.findByText('ERP SQL Server')).toBeInTheDocument();
    cleanup();

    api.respond(`GET /v1/datasets/${EXCEL_DATASET.id}`, json(EXCEL_DATASET));
    renderScreen(<DatasetDetail datasetId={EXCEL_DATASET.id} />);
    expect(await screen.findByText('metas-2026.xlsx')).toBeInTheDocument();
    expect(screen.getByText('Aba Vendas')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma coluna')).toBeInTheDocument();
  });

  it('dataset que não existe: explica e oferece voltar', async () => {
    api.respond(DETAIL, problem(404, 'not_found'));
    const onBack = vi.fn();
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} onBack={onBack} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(DATASET_NOT_FOUND_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar para datasets' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('erro passageiro: Tentar de novo carrega o dataset', async () => {
    api.respond(DETAIL, problem(503, 'unavailable'), json(TABLE_DATASET));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Itens de nota fiscal' })).toBeInTheDocument();
  });

  it('sem datasets.manage, mostra só para leitura', async () => {
    api = simulateApi(READ_ONLY_PERMISSIONS);
    api.respond('GET /v1/connections', json({ items: [POSTGRES] }));
    api.respond(DETAIL, json(TABLE_DATASET));
    respondNoVariables(api);
    renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    expect(await screen.findByText('vl_itm')).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo('GET /v1/session')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Atualizar colunas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renomear dataset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover dataset' })).not.toBeInTheDocument();
  });
});

describe('Detalhe do dataset: Atualizar colunas', () => {
  it('lê as colunas de novo e mostra as novas', async () => {
    const refreshed = {
      ...TABLE_DATASET,
      columns: [...TABLE_DATASET.columns, { name: 'qtd', source_type: 'integer', type: 'integer' as const, scale: null, nullable: false }],
    };
    api.respond(`POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`, json(refreshed));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));
    expect(await within(columnsTable()).findByText('qtd')).toBeInTheDocument();
    expect(screen.getByText(COLUMNS_REFRESHED_MESSAGE)).toBeInTheDocument();
    expect(api.callsTo(`POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`)[0]!.headers.get('X-CSRF-Token')).toBe('token-csrf');
  });

  it('o aviso da atualização some ao abrir outra ação', async () => {
    api.respond(`POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`, json(TABLE_DATASET));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));
    expect(await screen.findByText(COLUMNS_REFRESHED_MESSAGE)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Renomear dataset' }));

    expect(await screen.findByRole('dialog', { name: 'Renomear dataset' })).toBeInTheDocument();
    expect(screen.queryByText(COLUMNS_REFRESHED_MESSAGE)).not.toBeInTheDocument();
  });

  it('unknown_object: explica que a tabela sumiu da origem', async () => {
    api.respond(`POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`, problem(422, 'unknown_object'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível atualizar as colunas');
    expect(alert).toHaveTextContent(REFRESH_UNKNOWN_OBJECT_MESSAGE);
  });

  it('invalid_sql: mostra o motivo da recusa pelo banco', async () => {
    api.respond(`GET /v1/datasets/${SQL_DATASET.id}`, json(SQL_DATASET));
    api.respond(
      `POST /v1/datasets/${SQL_DATASET.id}/column-refresh`,
      problem(422, 'invalid_sql', { fields: { sql: 'O banco não encontrou uma tabela ou coluna do SQL.' } }),
    );
    const { user } = renderScreen(<DatasetDetail datasetId={SQL_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(REFRESH_INVALID_SQL_MESSAGE);
    expect(alert).toHaveTextContent('O banco não encontrou uma tabela ou coluna do SQL.');
  });
});

describe('Detalhe do dataset: renomear', () => {
  it('troca o nome e mostra o novo título', async () => {
    api.respond(`PUT /v1/datasets/${TABLE_DATASET.id}`, json({ ...TABLE_DATASET, name: 'Itens de NF' }));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Renomear dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear dataset' });
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('Itens de nota fiscal');
    await user.clear(name);
    await user.type(name, '  Itens de NF ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Itens de NF' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Renomear dataset' })).toHaveFocus();
    const [request] = api.callsTo(`PUT /v1/datasets/${TABLE_DATASET.id}`);
    expect(JSON.parse(await request!.text())).toEqual({ name: 'Itens de NF' });
  });

  it('dataset_already_exists: aponta o nome', async () => {
    api.respond(`PUT /v1/datasets/${TABLE_DATASET.id}`, problem(409, 'dataset_already_exists'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Renomear dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await waitFor(() => expect(name).toHaveAccessibleDescription(DATASET_ALREADY_EXISTS_MESSAGE));
  });

  it('pede o nome', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Renomear dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear dataset' });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe o nome do dataset')).toBeInTheDocument();
    expect(api.callsTo(`PUT /v1/datasets/${TABLE_DATASET.id}`)).toHaveLength(0);
  });
});

describe('Detalhe do dataset: remover', () => {
  it('confirma avisando que as variáveis também saem, remove e avisa quem usa a tela', async () => {
    api.respond(`DELETE /v1/datasets/${TABLE_DATASET.id}`, new Response(null, { status: 204 }));
    const onDeleted = vi.fn();
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} onDeleted={onDeleted} />);

    await user.click(await screen.findByRole('button', { name: 'Remover dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover dataset' });
    expect(dialog).toHaveAccessibleDescription(/as variáveis dele também são removidas/);
    await user.click(within(dialog).getByRole('button', { name: 'Remover dataset' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { level: 1, name: 'Dataset removido' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo(DETAIL)).toHaveLength(1);
  });

  it('Cancelar não remove', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Remover dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Remover dataset' })).toHaveFocus();
    expect(api.callsTo(`DELETE /v1/datasets/${TABLE_DATASET.id}`)).toHaveLength(0);
  });

  it('not_found: explica e desabilita a remoção com o motivo', async () => {
    api.respond(`DELETE /v1/datasets/${TABLE_DATASET.id}`, problem(404, 'not_found'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);

    await user.click(await screen.findByRole('button', { name: 'Remover dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover dataset' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(DATASET_NOT_FOUND_MESSAGE);
    expect(within(dialog).getByRole('button', { name: 'Remover dataset' })).toHaveAccessibleDescription(DELETE_NOT_FOUND_REASON);
  });

  it('depois de remover, a lista de datasets é buscada de novo', async () => {
    api.respond('GET /v1/datasets', json({ items: [TABLE_DATASET] }), json({ items: [] }));
    api.respond(`DELETE /v1/datasets/${TABLE_DATASET.id}`, new Response(null, { status: 204 }));
    const { user } = renderScreen(
      <>
        <Datasets />
        <DatasetDetail datasetId={TABLE_DATASET.id} />
      </>,
    );

    expect(await screen.findByText('1 dataset')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Remover dataset' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover dataset' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover dataset' }));

    expect(await screen.findByText('Nenhum dataset ainda')).toBeInTheDocument();
  });
});
