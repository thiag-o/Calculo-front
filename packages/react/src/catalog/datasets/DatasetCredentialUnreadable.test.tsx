import { cleanup, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetDetail, Datasets } from '.';
import {
  POSTGRES,
  SQL_DATASET,
  SQL_SERVER,
  TABLE_DATASET,
  json,
  object,
  problem,
  renderScreen,
  setCsrfCookie,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

const UNREADABLE = 'Texto do servidor para connection_credential_unreadable.';
const OBJECTS = `GET /v1/connections/${POSTGRES.id}/objects`;
const OBJECT_COLUMNS = `GET /v1/connections/${POSTGRES.id}/objects/columns`;
const REFRESH = `POST /v1/datasets/${TABLE_DATASET.id}/column-refresh`;

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('token-csrf');
  api.respond('GET /v1/datasets', json({ items: [SQL_DATASET] }));
  api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }));
  api.respond(`GET /v1/datasets/${TABLE_DATASET.id}`, json(TABLE_DATASET));
  api.respond(`GET /v1/datasets/${TABLE_DATASET.id}/variables`, json({ items: [] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openDialog(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
  const dialog = await screen.findByRole('dialog', { name: 'Novo dataset' });
  await user.click(await screen.findByRole('combobox', { name: 'Conexão' }));
  await user.click(await screen.findByRole('option', { name: 'Postgres de exemplo' }));
  return dialog;
}

describe('Novo dataset: credencial ilegível', () => {
  it('ao abrir os objetos: mostra a mensagem e o link abre a conexão', async () => {
    api.respond(OBJECTS, problem(409, 'connection_credential_unreadable'));
    const onOpenConnection = vi.fn();
    const { user } = renderScreen(<Datasets onOpenConnection={onOpenConnection} />);
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText(UNREADABLE)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abrir conexão' }));
    expect(onOpenConnection).toHaveBeenCalledWith(POSTGRES.id);
  });

  it('ao ver as colunas: mostra a mensagem e o link abre a conexão', async () => {
    api.respond(OBJECTS, json({ items: [object('itens_nf')], next_cursor: null }));
    api.respond(OBJECT_COLUMNS, problem(409, 'connection_credential_unreadable'));
    const onOpenConnection = vi.fn();
    const { user } = renderScreen(<Datasets onOpenConnection={onOpenConnection} />);
    const dialog = await openDialog(user);
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));

    expect(await within(dialog).findByText(UNREADABLE)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abrir conexão' }));
    // An object is chosen: leaving discards the form, so it asks first.
    await user.click(within(await screen.findByRole('dialog', { name: 'Descartar o novo dataset?' })).getByRole('button', { name: 'Descartar e abrir conexão' }));
    expect(onOpenConnection).toHaveBeenCalledWith(POSTGRES.id);
  });

  it('com algo preenchido: pede confirmação antes de abrir a conexão, e Continuar editando mantém o formulário', async () => {
    api.respond(OBJECTS, json({ items: [object('itens_nf')], next_cursor: null }));
    api.respond(OBJECT_COLUMNS, problem(409, 'connection_credential_unreadable'));
    const onOpenConnection = vi.fn();
    const { user } = renderScreen(<Datasets onOpenConnection={onOpenConnection} />);
    const dialog = await openDialog(user);
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Abrir conexão' }));

    const confirm = await screen.findByRole('dialog', { name: 'Descartar o novo dataset?' });
    expect(onOpenConnection).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Continuar editando' }));

    expect(screen.queryByRole('dialog', { name: 'Descartar o novo dataset?' })).not.toBeInTheDocument();
    expect(onOpenConnection).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Novo dataset' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Novo dataset' })).getByLabelText('Nome')).toHaveValue('itens_nf');
    // The focus goes back to where the person was, not to the top of the form.
    expect(within(screen.getByRole('dialog', { name: 'Novo dataset' })).getByRole('button', { name: 'Abrir conexão' })).toHaveFocus();
  });

  it('ao criar o dataset: mostra a mensagem e o link abre a conexão', async () => {
    api.respond(OBJECTS, json({ items: [object('itens_nf')], next_cursor: null }));
    api.respond(OBJECT_COLUMNS, json({ items: [] }));
    api.respond('POST /v1/datasets', problem(409, 'connection_credential_unreadable'));
    const onOpenConnection = vi.fn();
    const { user } = renderScreen(<Datasets onOpenConnection={onOpenConnection} />);
    const dialog = await openDialog(user);
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(UNREADABLE)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abrir conexão' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Descartar o novo dataset?' })).getByRole('button', { name: 'Descartar e abrir conexão' }));
    expect(onOpenConnection).toHaveBeenCalledWith(POSTGRES.id);
  });

  it('sem como abrir a conexão: só a mensagem', async () => {
    api.respond(OBJECTS, problem(409, 'connection_credential_unreadable'));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText(UNREADABLE)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Abrir conexão' })).not.toBeInTheDocument();
  });
});

describe('Detalhe do dataset: credencial ilegível', () => {
  it('ao atualizar as colunas: mostra a mensagem e o link abre a conexão do dataset', async () => {
    api.respond(REFRESH, problem(409, 'connection_credential_unreadable'));
    const onOpenConnection = vi.fn();
    const { user } = renderScreen(<DatasetDetail datasetId={TABLE_DATASET.id} onOpenConnection={onOpenConnection} />);
    await user.click(await screen.findByRole('button', { name: 'Atualizar colunas' }));

    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir conexão' }));
    expect(onOpenConnection).toHaveBeenCalledWith(POSTGRES.id);
  });
});
