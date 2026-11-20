import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connections } from '.';
import {
  CONNECTIONS,
  ERP,
  INTEGRATOR,
  MANAGER_WITHOUT_CREDENTIALS,
  SECRET,
  json,
  problem,
  renderConnections,
  simulateApi,
  withoutCredentials,
  write,
} from './connections.test-support';
import type { Connection } from './queries';

const DETAIL_ROUTE = `GET /v1/connections/${ERP.id}`;
const TEST_ROUTE = `POST /v1/connections/${ERP.id}/test`;
const RENAME_ROUTE = `PUT /v1/connections/${ERP.id}`;
const CREDENTIAL_ROUTE = `PUT /v1/connections/${ERP.id}/credential`;
const UNREADABLE = 'Texto do servidor para connection_credential_unreadable.';
const CHANGED = 'Texto do servidor para connection_changed.';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openDetail(permissions: readonly string[], seen: Connection = ERP) {
  const api = simulateApi(permissions);
  api.respond('GET /v1/connections', json({ items: CONNECTIONS }));
  api.respond(DETAIL_ROUTE, json(seen));
  const parts = renderConnections(<Connections connectionId={ERP.id} />);
  await screen.findByRole('heading', { level: 2, name: ERP.name });
  // The permissions arrive with the session, after the detail.
  await screen.findByRole('button', { name: 'Testar' });
  return { ...parts, api };
}

async function openMenuItem(user: Awaited<ReturnType<typeof openDetail>>['user'], item: string) {
  await user.click(await screen.findByRole('button', { name: `Mais ações para ${ERP.name}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('Conexões: credencial ilegível ao testar', () => {
  it('com credentials.manage: mostra a mensagem e oferece Trocar credencial', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(TEST_ROUTE, problem(409, 'connection_credential_unreadable'));
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent(UNREADABLE);
    await user.click(within(notice.parentElement!).getByRole('button', { name: 'Trocar credencial' }));
    expect(await screen.findByRole('dialog', { name: 'Trocar credencial' })).toBeInTheDocument();
  });

  it('sem credentials.manage: só a mensagem', async () => {
    const { user, api } = await openDetail(MANAGER_WITHOUT_CREDENTIALS, withoutCredentials(ERP));
    api.respond(TEST_ROUTE, problem(409, 'connection_credential_unreadable'));
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trocar credencial' })).not.toBeInTheDocument();
  });
});

describe('Conexões: conflito de versão (connection_changed)', () => {
  it('ao testar: mostra a mensagem e Recarregar busca a conexão sem testar de novo', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(TEST_ROUTE, problem(409, 'connection_changed'));
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByText(CHANGED)).not.toBeInTheDocument());
    expect(api.callsTo(DETAIL_ROUTE)).toHaveLength(2);
    expect(api.callsTo(TEST_ROUTE)).toHaveLength(1);
  });

  it('ao renomear: mostra a mensagem e Recarregar busca a conexão, fecha e não reenvia', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(RENAME_ROUTE, problem(409, 'connection_changed'));
    await openMenuItem(user, 'Renomear conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Renomear conexão' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(CHANGED)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(DETAIL_ROUTE)).toHaveLength(2);
    expect(api.callsTo(RENAME_ROUTE)).toHaveLength(1);
  });

  it('ao trocar a credencial: mostra a mensagem e Recarregar busca a conexão, fecha e não reenvia', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(CREDENTIAL_ROUTE, problem(409, 'connection_changed'));
    await openMenuItem(user, 'Trocar credencial');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar credencial' });
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(CHANGED)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(DETAIL_ROUTE)).toHaveLength(2);
    expect(api.callsTo(CREDENTIAL_ROUTE)).toHaveLength(1);
  });
});

describe('Conexões: Recarregar que falha', () => {
  it('ao renomear: a recarga falha, o diálogo não fecha, o texto fica e dá para tentar de novo', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(RENAME_ROUTE, problem(409, 'connection_changed'));
    await openMenuItem(user, 'Renomear conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Renomear conexão' });
    const name = within(dialog).getByLabelText('Nome');
    await write(user, name, ' novo');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await within(dialog).findByText(CHANGED);

    api.respond(DETAIL_ROUTE, problem(500, 'internal_error'), json(ERP));
    await user.click(within(dialog).getByRole('button', { name: 'Recarregar' }));

    expect(await within(dialog).findByText(/Não foi possível recarregar agora/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Renomear conexão' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome')).toHaveValue(`${ERP.name} novo`);

    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem mensagem da API, o aviso de conflito do detalhe usa um texto padrão em pt-BR', async () => {
    const { user, api } = await openDetail(INTEGRATOR);
    api.respond(
      TEST_ROUTE,
      new Response(JSON.stringify({ type: 'about:blank', title: '', status: 409, detail: '', code: 'connection_changed' }), {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findByText(/Os dados mudaram desde que você abriu esta tela/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
  });
});

describe('Conexões: destino nulo', () => {
  it('com credentials.manage e target nulo: o detalhe aparece sem o destino e Trocar credencial abre com os campos vazios', async () => {
    const { user } = await openDetail(INTEGRATOR, { ...ERP, target: null });

    expect(screen.getByRole('heading', { level: 2, name: ERP.name })).toBeInTheDocument();
    expect(screen.queryByText('Host', { selector: 'dt' })).not.toBeInTheDocument();
    await openMenuItem(user, 'Trocar credencial');
    const dialog = await screen.findByRole('dialog', { name: 'Trocar credencial' });
    expect(within(dialog).getByLabelText('Host')).toHaveValue('');
  });

  it('a lista continua mostrando a conexão com target nulo', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond('GET /v1/connections', json({ items: [{ ...ERP, target: null }] }));
    renderConnections(<Connections />);

    expect(await screen.findByRole('button', { name: ERP.name })).toBeInTheDocument();
  });
});
