import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetDetail } from '.';
import {
  ITEM_VALUE_VARIABLE,
  POSTGRES,
  SQL_SERVER,
  TABLE_DATASET,
  json,
  problem,
  renderScreen,
  setCsrfCookie,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

const DETAIL = `GET /v1/datasets/${TABLE_DATASET.id}`;
const RENAME = `PUT /v1/datasets/${TABLE_DATASET.id}`;
const REFRESH = `POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`;
const CREATE_VARIABLE = `POST /v1/datasets/${TABLE_DATASET.id}/variables`;
const UPDATE_VARIABLE = `PUT /v1/variables/${ITEM_VALUE_VARIABLE.id}`;
const CHANGED = 'Texto do servidor para dataset_changed.';
const UNREADABLE = 'Texto do servidor para connection_credential_unreadable.';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('token-csrf');
  api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }));
  api.respond(DETAIL, json(TABLE_DATASET));
  api.respond(`GET /v1/datasets/${TABLE_DATASET.id}/variables`, json({ items: [ITEM_VALUE_VARIABLE] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openRename(user: ReturnType<typeof renderScreen>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Renomear dataset' }));
  return screen.findByRole('dialog', { name: 'Renomear dataset' });
}

describe('Renomear dataset: erros do PUT', () => {
  it('connection_credential_unreadable: mostra a mesma mensagem das outras telas de dataset', async () => {
    api.respond(RENAME, problem(409, 'connection_credential_unreadable'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    const dialog = await openRename(user);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(UNREADABLE)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Renomear dataset' })).toBeInTheDocument();
  });

  it('dataset_changed: mostra a mensagem da API e Recarregar busca o dataset, fecha e não reenvia', async () => {
    api.respond(RENAME, problem(409, 'dataset_changed'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    const dialog = await openRename(user);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByText(CHANGED)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(DETAIL).length).toBeGreaterThanOrEqual(2);
    expect(api.callsTo(RENAME)).toHaveLength(1);
  });

  it('a recarga falha: o diálogo não fecha, o texto fica e há Tentar de novo', async () => {
    api.respond(RENAME, problem(409, 'dataset_changed'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    const dialog = await openRename(user);
    await user.click(within(dialog).getByLabelText('Nome'));
    await user.paste('-2');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await within(dialog).findByText(CHANGED);

    api.respond(DETAIL, problem(500, 'internal_error'), json(TABLE_DATASET));
    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    expect(await within(dialog).findByText(/Não foi possível recarregar agora/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome')).toHaveValue(`${TABLE_DATASET.name}-2`);
    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Detalhe do dataset: conflitos de versão', () => {
  it('ao atualizar as colunas: dataset_changed mostra a mensagem e Recarregar busca de novo sem reenviar', async () => {
    api.respond(REFRESH, problem(409, 'dataset_changed'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByText(CHANGED)).not.toBeInTheDocument());
    expect(api.callsTo(REFRESH)).toHaveLength(1);
  });

  it('ao editar uma variável: variable_changed mostra a mensagem e Recarregar fecha depois de buscar', async () => {
    api.respond(UPDATE_VARIABLE, problem(409, 'variable_changed'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    await user.click(await screen.findByRole('button', { name: `Mais ações para ${ITEM_VALUE_VARIABLE.name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByText('Texto do servidor para variable_changed.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(UPDATE_VARIABLE)).toHaveLength(1);
  });

  it('ao editar uma variável: se a recarga falha, o diálogo fica com o texto digitado', async () => {
    api.respond(UPDATE_VARIABLE, problem(409, 'dataset_changed'));
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} />);
    await user.click(await screen.findByRole('button', { name: `Mais ações para ${ITEM_VALUE_VARIABLE.name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('_novo');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await within(dialog).findByText(CHANGED);

    api.respond(DETAIL, problem(500, 'internal_error'));
    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    expect(await within(dialog).findByText(/Não foi possível recarregar agora/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar variável' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveValue(`${ITEM_VALUE_VARIABLE.name}_novo`);
    expect(api.callsTo(CREATE_VARIABLE)).toHaveLength(0);
  });
});
