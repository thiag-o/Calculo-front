import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UNKNOWN_ROLE_MESSAGE,
  NO_PERMISSION_MESSAGE,
  LAST_ADMIN_MESSAGE,
  USER_ALREADY_EXISTS_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from './messages';
import {
  ANA,
  BRUNO,
  ROLES,
  ADMIN_ROLE,
  AUDITOR_ROLE,
  CONFIGURATOR_ROLE,
  setCsrfCookie,
  json,
  problem,
  renderUsers,
  pendingResponse,
  simulateApi,
  type SimulatedApi,
} from './users.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  api.respond('GET /v1/roles', json({ items: ROLES }));
  setCsrfCookie('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const dialog = (name: string) => screen.getByRole('dialog', { name });

async function openNew(user: UserEvent) {
  await screen.findByText('Ana Beatriz Souza');
  const top = screen.getByRole('heading', { level: 2, name: 'Usuários' }).closest('header')!;
  await user.click(within(top).getByRole('button', { name: 'Novo usuário' }));
  const panel = await screen.findByRole('dialog', { name: 'Novo usuário' });
  await within(panel).findByRole('checkbox', { name: 'Admin' });
  return panel;
}

async function openEdit(user: UserEvent, name: string) {
  await screen.findByText(name);
  await user.click(screen.getByRole('button', { name: `Mais ações para ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Editar usuário' }));
  const panel = await screen.findByRole('dialog', { name: 'Editar usuário' });
  await within(panel).findByRole('checkbox', { name: 'Admin' });
  return panel;
}

describe('Usuários: criar', () => {
  beforeEach(() => {
    api.respond('GET /v1/users', json({ items: [ANA], next_cursor: null }), json({ items: [ANA, BRUNO], next_cursor: null }));
  });

  it('cria com e-mail, nome e papéis, fecha o diálogo e atualiza a lista', async () => {
    api.respond('POST /v1/users', json(BRUNO, 201));
    const { user } = renderUsers();
    const panel = await openNew(user);

    expect(within(panel).getByRole('textbox', { name: 'E-mail' })).toHaveFocus();
    expect(within(panel).queryByRole('checkbox', { name: 'Ativo neste tenant' })).not.toBeInTheDocument();
    const group = within(panel).getByRole('group', { name: 'Papéis' });
    expect(within(group).getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
    expect(within(group).getByRole('checkbox', { name: 'Admin' })).toHaveAccessibleDescription(/Todas as permissões/);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('  bruno.figueiredo.de.albuquerque@exemplo.com ');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Bruno Figueiredo de Albuquerque');
    await user.click(within(group).getByRole('checkbox', { name: 'Configurador' }));
    await user.click(within(group).getByRole('checkbox', { name: 'Auditor' }));
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.callsTo('POST /v1/users');
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({
      email: 'bruno.figueiredo.de.albuquerque@exemplo.com',
      name: 'Bruno Figueiredo de Albuquerque',
      roles: [CONFIGURATOR_ROLE.id, AUDITOR_ROLE.id],
    });
    expect(await screen.findByText('Bruno Figueiredo de Albuquerque')).toBeInTheDocument();
    expect(api.callsTo('GET /v1/users')).toHaveLength(2);
    // Focus goes back to whoever opened the dialog.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Novo usuário' })[0]).toHaveFocus());
  });

  it('valida os campos antes de enviar', async () => {
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));
    expect(await within(panel).findByText('Informe o e-mail')).toBeInTheDocument();
    expect(within(panel).getByText('Informe o nome')).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'E-mail' })).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));
    expect(await within(panel).findByText('Informe um e-mail válido, como ana@empresa.com.br')).toBeInTheDocument();
    expect(api.callsTo('POST /v1/users')).toHaveLength(0);
  });

  it('envia pelo envio do formulário (Enter num campo, no navegador)', async () => {
    api.respond('POST /v1/users', json(BRUNO, 201));
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno@exemplo.com');
    const name = within(panel).getByRole('textbox', { name: 'Nome' });
    await user.click(name);
    await user.paste('Bruno');
    // The submit button is in the dialog footer, bound to the form by the `form` attribute. The browser uses it on
    // Enter (the form's default button); user-event only looks for buttons inside the <form>, so the submit is direct.
    fireEvent.submit((name as HTMLInputElement).form!);

    await waitFor(() => expect(api.callsTo('POST /v1/users')).toHaveLength(1));
    expect(await api.callsTo('POST /v1/users')[0]!.json()).toEqual({ email: 'bruno@exemplo.com', name: 'Bruno', roles: [] });
  });

  it('enquanto salva, o botão fica ocupado e não envia de novo', async () => {
    const pending = pendingResponse(() => json(BRUNO, 201));
    api.respond('POST /v1/users', pending.promise);
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno@exemplo.com');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Bruno');
    const create = within(panel).getByRole('button', { name: 'Salvar' });
    await user.click(create);
    await waitFor(() => expect(create).toHaveAttribute('aria-busy', 'true'));
    await user.click(create);
    expect(api.callsTo('POST /v1/users')).toHaveLength(1);

    pending.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('user_already_exists: marca o e-mail e mantém o diálogo aberto', async () => {
    api.respond('POST /v1/users', problem(409, 'user_already_exists'));
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('ana@exemplo.com');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Ana');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    const email = within(panel).getByRole('textbox', { name: 'E-mail' });
    await waitFor(() => expect(email).toHaveAccessibleDescription(USER_ALREADY_EXISTS_MESSAGE));
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(dialog('Novo usuário')).toBeInTheDocument();
  });

  it('unknown_role: marca os papéis e busca a lista de papéis de novo', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }), json({ items: [ADMIN_ROLE, CONFIGURATOR_ROLE] }));
    api.respond('POST /v1/users', problem(422, 'unknown_role'));
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno@exemplo.com');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Bruno');
    await user.click(within(panel).getByRole('checkbox', { name: 'Auditor' }));
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    const group = within(panel).getByRole('group', { name: 'Papéis' });
    await waitFor(() => expect(group).toHaveAccessibleDescription(UNKNOWN_ROLE_MESSAGE));
    await waitFor(() => expect(within(panel).queryByRole('checkbox', { name: 'Auditor' })).not.toBeInTheDocument());
    expect(api.callsTo('GET /v1/roles')).toHaveLength(2);
  });

  it('invalid_data: mostra o erro de cada campo vindo da API', async () => {
    api.respond('POST /v1/users', problem(422, 'invalid_data', { fields: { email: 'E-mail com formato inválido.', name: 'Nome longo demais.' } }));
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno@exemplo.com');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Bruno');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByText('E-mail com formato inválido.')).toBeInTheDocument();
    expect(within(panel).getByText('Nome longo demais.')).toBeInTheDocument();
    expect(within(panel).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });

  it('outros erros (ex.: invalid_csrf): mostra a mensagem do servidor', async () => {
    api.respond('POST /v1/users', problem(403, 'invalid_csrf'));
    const { user } = renderUsers();
    const panel = await openNew(user);

    await user.click(within(panel).getByRole('textbox', { name: 'E-mail' }));
    await user.paste('bruno@exemplo.com');
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Bruno');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para invalid_csrf.');
  });

  it('Cancelar fecha sem enviar', async () => {
    const { user } = renderUsers();
    const panel = await openNew(user);
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('Rascunho');
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo('POST /v1/users')).toHaveLength(0);

    // Reopening starts from scratch.
    const newDialog = await openNew(user);
    expect(within(newDialog).getByRole('textbox', { name: 'Nome' })).toHaveValue('');
  });
});

describe('Usuários: papéis no formulário', () => {
  beforeEach(() => {
    api.respond('GET /v1/users', json({ items: [ANA], next_cursor: null }));
  });

  it('enquanto os papéis carregam, salvar fica desabilitado com o motivo', async () => {
    const pending = pendingResponse(() => json({ items: ROLES }));
    api.respond('GET /v1/roles', pending.promise);
    const { user } = renderUsers();
    await screen.findByText('Ana Beatriz Souza');
    await user.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const panel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(within(panel).getByRole('status')).toHaveTextContent('Carregando papéis');
    const create = within(panel).getByRole('button', { name: 'Salvar' });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(create).toHaveAccessibleDescription('Aguarde a lista de papéis');

    pending.release();
    expect(await within(panel).findByRole('checkbox', { name: 'Configurador' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('lista os papéis por GET /v1/roles ao criar e ao editar, com salvar liberado', async () => {
    api.respond('GET /v1/users', json({ items: [ANA, BRUNO], next_cursor: null }));
    const { user } = renderUsers();

    const newDialog = await openNew(user);
    expect(within(within(newDialog).getByRole('group', { name: 'Papéis' })).getAllByRole('checkbox')).toHaveLength(ROLES.length);
    expect(within(newDialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(newDialog).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
    await user.click(within(newDialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const editing = await openEdit(user, 'Bruno Figueiredo de Albuquerque');
    expect(within(within(editing).getByRole('group', { name: 'Papéis' })).getAllByRole('checkbox')).toHaveLength(ROLES.length);
    expect(within(editing).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(editing).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
    expect(api.callsTo('GET /v1/roles').length).toBeGreaterThanOrEqual(1);
  });

  it('no_permission ao listar os papéis: é a falta de gerenciar usuários', async () => {
    api.respond('GET /v1/roles', problem(403, 'no_permission'));
    const { user } = renderUsers();
    await screen.findByText('Ana Beatriz Souza');
    await user.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const panel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(panel).findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });

  it('erro ao carregar os papéis: tenta de novo', async () => {
    api.respond('GET /v1/roles', problem(503, 'unavailable'), json({ items: ROLES }));
    const { user } = renderUsers();
    await screen.findByText('Ana Beatriz Souza');
    await user.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const panel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');
    await user.click(within(panel).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(panel).findByRole('checkbox', { name: 'Admin' })).toBeInTheDocument();
  });

  it('tenant sem papéis: diz o que falta', async () => {
    api.respond('GET /v1/roles', json({ items: [] }));
    const { user } = renderUsers();
    await screen.findByText('Ana Beatriz Souza');
    await user.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const panel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(panel).findByText('Nenhum papel no tenant. Crie um papel para dar acesso.')).toBeInTheDocument();
  });
});

describe('Usuários: editar', () => {
  beforeEach(() => {
    api.respond('GET /v1/users', json({ items: [ANA, BRUNO], next_cursor: null }));
  });

  it('abre com os dados atuais e salva nome, papéis e situação', async () => {
    const updated = { ...BRUNO, name: 'Bruno F. Albuquerque', roles: [{ id: AUDITOR_ROLE.id, name: 'Auditor' }], active: false };
    api.respond('PUT /v1/users/' + BRUNO.id, json(updated));
    api.respond('GET /v1/users', json({ items: [ANA, BRUNO], next_cursor: null }), json({ items: [ANA, updated], next_cursor: null }));
    const { user } = renderUsers();
    const panel = await openEdit(user, 'Bruno Figueiredo de Albuquerque');

    expect(within(panel).getByText('bruno.figueiredo.de.albuquerque@exemplo.com')).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'E-mail' })).not.toBeInTheDocument();
    const name = within(panel).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('Bruno Figueiredo de Albuquerque');
    expect(name).toHaveAccessibleDescription('O nome vale em todos os tenants do usuário.');
    expect(within(panel).getByRole('checkbox', { name: 'Configurador' })).toBeChecked();
    expect(within(panel).getByRole('checkbox', { name: 'Auditor' })).toBeChecked();
    expect(within(panel).getByRole('checkbox', { name: 'Admin' })).not.toBeChecked();
    const active = within(panel).getByRole('checkbox', { name: 'Ativo neste tenant' });
    expect(active).toBeChecked();
    expect(active).toHaveAccessibleDescription('Desativar encerra as sessões do usuário neste tenant.');

    await user.clear(name);
    await user.click(name);
    await user.paste('Bruno F. Albuquerque');
    await user.click(within(panel).getByRole('checkbox', { name: 'Configurador' }));
    await user.click(active);
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.callsTo('PUT /v1/users/' + BRUNO.id);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ name: 'Bruno F. Albuquerque', roles: [AUDITOR_ROLE.id], active: false });
    expect(await screen.findByText('Bruno F. Albuquerque')).toBeInTheDocument();
    // Focus goes back to the row menu.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para Bruno F. Albuquerque' })).toHaveFocus());
  });

  it('last_admin: explica e mantém o diálogo aberto', async () => {
    api.respond('PUT /v1/users/' + ANA.id, problem(409, 'last_admin'));
    const { user } = renderUsers();
    const panel = await openEdit(user, 'Ana Beatriz Souza');

    await user.click(within(panel).getByRole('checkbox', { name: 'Admin' }));
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(LAST_ADMIN_MESSAGE);
    expect(dialog('Editar usuário')).toBeInTheDocument();
    expect(await api.callsTo('PUT /v1/users/' + ANA.id)[0]!.json()).toEqual({ name: 'Ana Beatriz Souza', roles: [], active: true });
  });

  it('not_found: avisa e atualiza a lista', async () => {
    api.respond('PUT /v1/users/' + BRUNO.id, problem(404, 'not_found'));
    api.respond('GET /v1/users', json({ items: [ANA, BRUNO], next_cursor: null }), json({ items: [ANA], next_cursor: null }));
    const { user } = renderUsers();
    const panel = await openEdit(user, 'Bruno Figueiredo de Albuquerque');

    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(USER_NOT_FOUND_MESSAGE);
    await waitFor(() => expect(api.callsTo('GET /v1/users')).toHaveLength(2));
  });

  it('unknown_role: marca os papéis', async () => {
    api.respond('PUT /v1/users/' + BRUNO.id, problem(422, 'unknown_role'));
    const { user } = renderUsers();
    const panel = await openEdit(user, 'Bruno Figueiredo de Albuquerque');

    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    const group = within(panel).getByRole('group', { name: 'Papéis' });
    await waitFor(() => expect(group).toHaveAccessibleDescription(UNKNOWN_ROLE_MESSAGE));
  });

  it('valida o nome vazio', async () => {
    const { user } = renderUsers();
    const panel = await openEdit(user, 'Bruno Figueiredo de Albuquerque');

    await user.clear(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.click(within(panel).getByRole('textbox', { name: 'Nome' }));
    await user.paste('   ');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByText('Informe o nome')).toBeInTheDocument();
    expect(api.callsTo('PUT /v1/users/' + BRUNO.id)).toHaveLength(0);
  });
});
