import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connections } from '.';
import {
  ERP,
  INTEGRATOR,
  OK_TEST,
  SECRET,
  bodyOf,
  cacheContent,
  json,
  problem,
  renderConnections,
  simulateApi,
  write,
} from './connections.test-support';

const CREDENTIAL_ROUTE = `PUT /v1/connections/${ERP.id}/credential`;
const TEST_ROUTE = 'POST /v1/connections/tests';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Opens "Trocar credencial" on the ERP detail. */
async function openDialog(permissions: readonly string[] = INTEGRATOR) {
  const api = simulateApi(permissions);
  api.respond(`GET /v1/connections/${ERP.id}`, json(ERP));
  const parts = renderConnections(<Connections connectionId={ERP.id} />);
  await parts.user.click(await screen.findByRole('button', { name: `Mais ações para ${ERP.name}` }));
  await parts.user.click(await screen.findByRole('menuitem', { name: 'Trocar credencial' }));
  const dialog = await screen.findByRole('dialog', { name: 'Trocar credencial' });
  return { ...parts, api, dialog };
}

function expectSecretGone(queryClient: Parameters<typeof cacheContent>[0]) {
  expect(cacheContent(queryClient)).not.toContain(SECRET);
  expect(document.body.innerHTML).not.toContain(SECRET);
  expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();
}

describe('Conexões: trocar credencial', () => {
  it('o destino vem preenchido e a senha vazia', async () => {
    const { dialog } = await openDialog();
    const form = within(dialog);

    expect(form.getByLabelText('Host')).toHaveValue('db.erp.exemplo.com.br');
    expect(form.getByLabelText('Porta')).toHaveValue('5432');
    expect(form.getByLabelText('Banco')).toHaveValue('faturamento');
    expect(form.getByLabelText('Usuário')).toHaveValue('leitura_fluxo');
    expect(form.getByLabelText('Senha')).toHaveValue('');
    expect(form.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('salvar exige os cinco campos: sem a senha, não chama a API', async () => {
    const { user, dialog, api } = await openDialog();
    await user.clear(within(dialog).getByLabelText('Banco'));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe a senha')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o nome do banco')).toBeInTheDocument();
    expect(api.callsTo(CREDENTIAL_ROUTE)).toHaveLength(0);
  });

  it('salva os cinco campos, fecha e a senha não fica no cache nem no DOM', async () => {
    const { user, dialog, api, queryClient } = await openDialog();
    api.respond(CREDENTIAL_ROUTE, json({ ...ERP, last_test: { ...OK_TEST, tested_at: new Date(2026, 10, 17, 10, 0).toISOString() } }));
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(CREDENTIAL_ROUTE)[0])).toEqual({
      host: 'db.erp.exemplo.com.br',
      port: 5432,
      database: 'faturamento',
      username: 'leitura_fluxo',
      password: SECRET,
    });
    expect(await screen.findByText('17/11/2026 às 10:00')).toBeInTheDocument();
    expectSecretGone(queryClient);
  });

  it('cancelar descarta o que foi digitado', async () => {
    const { user, dialog, queryClient } = await openDialog();
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectSecretGone(queryClient);
    expect(screen.getByRole('button', { name: `Mais ações para ${ERP.name}` })).toHaveFocus();
  });

  it('Testar confere a credencial nova sem salvar, com o tipo da conexão', async () => {
    const { user, dialog, api, queryClient } = await openDialog();
    api.respond(TEST_ROUTE, json(OK_TEST));
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));

    expect(await within(dialog).findByText('Resultado do teste')).toBeInTheDocument();
    expect(within(dialog).getByText('PostgreSQL 16.4')).toBeInTheDocument();
    expect(await bodyOf(api.callsTo(TEST_ROUTE)[0])).toEqual({
      type: 'postgres',
      credential: { host: 'db.erp.exemplo.com.br', port: 5432, database: 'faturamento', username: 'leitura_fluxo', password: SECRET },
    });
    expect(api.callsTo(CREDENTIAL_ROUTE)).toHaveLength(0);
    expect(cacheContent(queryClient)).not.toContain(SECRET);
  });

  it('usuário que pode escrever (connection_not_read_only): mensagem e privilégios, sem salvar', async () => {
    const { user, dialog, api } = await openDialog();
    api.respond(
      CREDENTIAL_ROUTE,
      problem(422, 'connection_not_read_only', {
        detail: 'O usuário do banco pode alterar dados. Use um usuário só de leitura.',
        privileges: ['UPDATE em dbo.pedidos'],
      }),
    );
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('O usuário do banco pode alterar dados.');
    expect(within(alert).getByRole('listitem')).toHaveTextContent('UPDATE em dbo.pedidos');
    expect(screen.getByRole('dialog', { name: 'Trocar credencial' })).toBeInTheDocument();
  });

  it.each([
    ['connection_failed', 'O banco recusou o usuário ou a senha.'],
    ['connection_without_tls', 'O banco não aceitou uma conexão com TLS, que é obrigatória.'],
    ['connection_target_not_allowed', 'Este endereço de banco não é permitido.'],
  ])('%s: mostra a mensagem da API', async (code, detail) => {
    const { user, dialog, api } = await openDialog();
    api.respond(CREDENTIAL_ROUTE, problem(422, code, { detail }));
    await write(user, within(dialog).getByLabelText('Senha'), SECRET);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail);
  });

  it('só com credentials.manage (sem connections.manage): troca a credencial, sem Testar', async () => {
    const { dialog } = await openDialog(['connections.view', 'credentials.manage']);

    expect(within(dialog).queryByRole('button', { name: 'Testar' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});
