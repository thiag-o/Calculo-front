import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionList } from '.';
import {
  write,
  ERP,
  FAILED_TEST,
  NEW,
  OK_TEST,
  SECRET,
  bodyOf,
  cacheContent,
  json,
  problem,
  renderConnections,
  simulateApi,
  type SimulatedApi,
} from './connections.test-support';
import { ALREADY_EXISTS_MESSAGE } from './messages';

const LIST_ROUTE = 'GET /v1/connections';
const CREATE_ROUTE = 'POST /v1/connections';
const TEST_ROUTE = 'POST /v1/connections/tests';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  api.respond(LIST_ROUTE, json({ items: [ERP] }), json({ items: [ERP, NEW] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

async function openDialog() {
  const screenParts = renderConnections(<ConnectionList onOpen={() => {}} />);
  await screenParts.user.click(await screen.findByRole('button', { name: 'Nova conexão' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nova conexão' });
  return { ...screenParts, dialog };
}

/** Fills the form with the `Estoque` connection (PostgreSQL) and the secret password. */
async function fill(user: UserEvent, dialog: HTMLElement) {
  const form = within(dialog);
  await write(user, form.getByLabelText('Nome'), 'Estoque');
  await write(user, form.getByLabelText('Host'), 'estoque.interno');
  await write(user, form.getByLabelText('Banco'), 'estoque');
  await write(user, form.getByLabelText('Usuário'), 'leitura');
  await write(user, form.getByLabelText('Senha'), SECRET);
}

/** The secret is in no query, no mutation, no browser storage, no URL and nowhere on screen. */
function expectSecretGone(queryClient: Parameters<typeof cacheContent>[0]) {
  expect(cacheContent(queryClient)).not.toContain(SECRET);
  expect(document.body.innerHTML).not.toContain(SECRET);
  expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();
  expect(JSON.stringify({ ...localStorage })).not.toContain(SECRET);
  expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRET);
  expect(window.location.href).not.toContain(SECRET);
}

describe('Nova conexão: formulário', () => {
  it('tem tipo, nome, host, porta, banco, usuário e senha só de escrita', async () => {
    const { dialog } = await openDialog();
    const form = within(dialog);

    expect(form.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('PostgreSQL');
    for (const label of ['Nome', 'Host', 'Porta', 'Banco', 'Usuário']) expect(form.getByLabelText(label)).toBeInTheDocument();
    const password = form.getByLabelText('Senha');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveValue('');
    // "Testar" comes before "Salvar".
    const actions = form.getAllByRole('button').map((button) => button.textContent);
    expect(actions.indexOf('Testar')).toBeLessThan(actions.indexOf('Salvar'));
  });

  it('a porta começa em 5432 e segue o tipo (1433 no SQL Server) enquanto ninguém a mudou', async () => {
    const { user, dialog } = await openDialog();
    const form = within(dialog);
    const port = form.getByLabelText('Porta');
    expect(port).toHaveValue('5432');

    await user.click(form.getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'SQL Server' }));
    expect(port).toHaveValue('1433');

    await user.click(form.getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'PostgreSQL' }));
    expect(port).toHaveValue('5432');

    await user.clear(port);
    await user.type(port, '6543');
    await user.click(form.getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'SQL Server' }));
    expect(port).toHaveValue('6543');
  });

  it('confere os campos no cliente antes de chamar a API', async () => {
    const { user, dialog } = await openDialog();
    const form = within(dialog);
    await user.clear(form.getByLabelText('Porta'));
    await user.type(form.getByLabelText('Porta'), '70000');
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    expect(await form.findByText('Informe o nome da conexão')).toBeInTheDocument();
    expect(form.getByText('Informe o host do banco')).toBeInTheDocument();
    expect(form.getByText('Informe uma porta de 1 a 65535')).toBeInTheDocument();
    expect(form.getByText('Informe o nome do banco')).toBeInTheDocument();
    expect(form.getByText('Informe o usuário do banco')).toBeInTheDocument();
    expect(form.getByText('Informe a senha')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Testar' }));
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(0);
    expect(api.callsTo(TEST_ROUTE)).toHaveLength(0);
  });
});

describe('Nova conexão: Testar', () => {
  it('testa sem salvar e mostra versão, TLS, somente leitura e tempo', async () => {
    api.respond(TEST_ROUTE, json(OK_TEST));
    const { user, dialog, queryClient } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));

    const result = await within(dialog).findByText('Resultado do teste');
    const box = result.parentElement!;
    expect(within(box).getByText('ok')).toBeInTheDocument();
    expect(within(box).getByText('PostgreSQL 16.4')).toBeInTheDocument();
    expect(within(box).getByText('TLS').nextElementSibling).toHaveTextContent('Sim');
    expect(within(box).getByText('Somente leitura').nextElementSibling).toHaveTextContent('Sim');
    expect(within(box).getByText('182 ms')).toBeInTheDocument();
    expect(await bodyOf(api.callsTo(TEST_ROUTE)[0])).toEqual({
      type: 'postgres',
      credential: { host: 'estoque.interno', port: 5432, database: 'estoque', username: 'leitura', password: SECRET },
    });
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(0);
    // Even while the dialog is open, the credential is not in the cache.
    expect(cacheContent(queryClient)).not.toContain(SECRET);
  });

  it('teste que não passa: "falhou" e a mensagem da API como vem', async () => {
    api.respond(TEST_ROUTE, json(FAILED_TEST));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));

    expect(await within(dialog).findByText('falhou')).toBeInTheDocument();
    expect(within(dialog).getByText('O banco não respondeu a tempo.')).toBeInTheDocument();
    expect(within(dialog).getByText('5 s')).toBeInTheDocument();
    expect(within(dialog).queryByText('Versão')).not.toBeInTheDocument();
  });

  it('destino bloqueado (connection_target_not_allowed): mostra a mensagem da API', async () => {
    api.respond(TEST_ROUTE, problem(422, 'connection_target_not_allowed', { detail: 'Este endereço de banco não é permitido.' }));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este endereço de banco não é permitido.');
  });

  it('mudar um campo descarta o resultado do teste anterior', async () => {
    api.respond(TEST_ROUTE, json(OK_TEST));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));
    expect(await within(dialog).findByText('Resultado do teste')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Host'), '2');
    expect(within(dialog).queryByText('Resultado do teste')).not.toBeInTheDocument();
  });
});

describe('Nova conexão: Salvar', () => {
  it('salva, fecha o diálogo, atualiza a lista e a senha não fica no cache nem no DOM', async () => {
    api.respond(CREATE_ROUTE, json(NEW, 201));
    const { user, dialog, queryClient } = await openDialog();
    await user.click(within(dialog).getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'SQL Server' }));
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(CREATE_ROUTE)[0])).toEqual({
      name: 'Estoque',
      type: 'sqlserver',
      credential: { host: 'estoque.interno', port: 1433, database: 'estoque', username: 'leitura', password: SECRET },
    });
    expect(await screen.findByRole('button', { name: NEW.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova conexão' })).toHaveFocus();
    expectSecretGone(queryClient);
  });

  it('cancelar descarta o formulário: a senha não fica no cache nem no DOM', async () => {
    api.respond(TEST_ROUTE, json(OK_TEST));
    const { user, dialog, queryClient } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Testar' }));
    expect(await within(dialog).findByText('Resultado do teste')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectSecretGone(queryClient);
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(0);

    // Opening again starts empty.
    await user.click(screen.getByRole('button', { name: 'Nova conexão' }));
    const again = await screen.findByRole('dialog', { name: 'Nova conexão' });
    expect(within(again).getByLabelText('Senha')).toHaveValue('');
    expect(within(again).getByLabelText('Nome')).toHaveValue('');
    expect(within(again).queryByText('Resultado do teste')).not.toBeInTheDocument();
  });

  it('fechar com Esc também descarta o formulário', async () => {
    const { user, dialog, queryClient } = await openDialog();
    await fill(user, dialog);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectSecretGone(queryClient);
  });

  it('usuário que pode escrever (connection_not_read_only): mensagem e a lista de privilégios', async () => {
    api.respond(
      CREATE_ROUTE,
      problem(422, 'connection_not_read_only', {
        detail: 'O usuário do banco pode alterar dados. Use um usuário só de leitura.',
        privileges: ['INSERT em public.notas_fiscais', 'CREATE no banco'],
      }),
    );
    const { user, dialog, queryClient } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('O usuário do banco pode alterar dados. Use um usuário só de leitura.');
    const privileges = within(alert).getByRole('list', { name: 'Privilégios encontrados' });
    expect(within(privileges).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'INSERT em public.notas_fiscais',
      'CREATE no banco',
    ]);
    expect(screen.getByRole('dialog', { name: 'Nova conexão' })).toBeInTheDocument();
    expect(cacheContent(queryClient)).not.toContain(SECRET);
  });

  it.each([
    ['connection_without_tls', 'O banco não aceitou uma conexão com TLS, que é obrigatória.'],
    ['connection_failed', 'O banco recusou o usuário ou a senha.'],
    ['connection_target_not_allowed', 'Este endereço de banco não é permitido.'],
  ])('%s: mostra a mensagem da API e não fecha', async (code, detail) => {
    api.respond(CREATE_ROUTE, problem(422, code, { detail }));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail);
    expect(screen.getByRole('dialog', { name: 'Nova conexão' })).toBeInTheDocument();
  });

  it('nome repetido (connection_already_exists): erro no campo Nome', async () => {
    api.respond(CREATE_ROUTE, problem(409, 'connection_already_exists'));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(ALREADY_EXISTS_MESSAGE)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });

  it('dados inválidos (invalid_data): o erro vai para o campo da credencial', async () => {
    api.respond(CREATE_ROUTE, problem(422, 'invalid_data', { fields: { 'credential.port': 'Informe um número inteiro.' } }));
    const { user, dialog } = await openDialog();
    await fill(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe um número inteiro.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Porta')).toHaveAttribute('aria-invalid', 'true');
  });
});
