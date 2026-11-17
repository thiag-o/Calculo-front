import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION_CATALOG_LOADING_REASON, PERMISSION_CATALOG_ERROR_REASON } from './RoleDialog';
import { DELETE_IN_USE_REASON } from './DeleteRoleDialog';
import { FIXED_ROLE_REASON, roleInUseReason } from './Roles';
import {
  ROLE_IN_USE_MESSAGE,
  ROLE_ALREADY_EXISTS_MESSAGE,
  ROLE_NOT_FOUND_MESSAGE,
  NO_PERMISSION_MESSAGE,
} from './messages';
import {
  PERMISSION_CATALOG,
  ADMIN_ROLE,
  AUDITOR_ROLE,
  CONFIGURATOR_ROLE,
  EMPTY_ROLE,
  setCsrfCookie,
  json,
  problem,
  renderRoles,
  pendingResponse,
  simulateApi,
  type SimulatedApi,
  type RolesScreen,
} from './roles.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole('table', { name: 'Papéis do tenant' });
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });
const ROLES = [ADMIN_ROLE, CONFIGURATOR_ROLE, AUDITOR_ROLE, EMPTY_ROLE];

async function openMenuOf(user: RolesScreen['user'], name: string) {
  await user.click(screen.getByRole('button', { name: `Mais ações para ${name}` }));
  return screen.findByRole('menu');
}

describe('Papéis: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json({ items: ROLES }));
    api.respond('GET /v1/roles', pending.promise);
    renderRoles();

    expect(screen.getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(table()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando papéis do tenant');

    pending.release();
    expect(await screen.findByText('Configurador')).toBeInTheDocument();
    expect(table()).not.toHaveAttribute('aria-busy');
  });

  it('mostra cada papel com o resumo das permissões e quantos usuários o têm', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }));
    renderRoles();

    await screen.findByText('Configurador');
    expect(screen.getByText('4 papéis')).toBeInTheDocument();
    expect(within(table()).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Role', 'Usuários', 'Ações']);

    const configurator = rowOf('Configurador');
    expect(within(configurator).getByText('3 permissões')).toBeInTheDocument();
    expect(within(configurator).getByText('3')).toBeInTheDocument();

    const auditor = rowOf(AUDITOR_ROLE.name);
    expect(within(auditor).getByText('1 permissão')).toBeInTheDocument();
    expect(within(auditor).getByText('0')).toBeInTheDocument();

    expect(within(rowOf('Sem acesso')).getByText('Nenhuma permissão')).toBeInTheDocument();
    expect(api.callsTo('GET /v1/roles')).toHaveLength(1);
  });

  it('o Admin aparece travado, com o motivo, e não oferece editar nem remover', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }));
    renderRoles();
    await screen.findByText('Configurador');

    const admin = rowOf('Admin');
    expect(within(admin).getByText('Fixo')).toBeInTheDocument();
    expect(within(admin).getByText(FIXED_ROLE_REASON)).toBeInTheDocument();
    expect(within(admin).getByRole('img', { name: 'Admin travado' })).toBeInTheDocument();
    // No button on the Admin row: no menu, no edit, no delete.
    expect(within(admin).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Mais ações para Admin' })).not.toBeInTheDocument();
    // The other roles have the menu.
    expect(screen.getByRole('button', { name: 'Mais ações para Configurador' })).toBeInTheDocument();
  });

  it('mostra o estado vazio com a ação de criar', async () => {
    api.respond('GET /v1/roles', json({ items: [] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    const { user } = renderRoles();

    expect(await screen.findByText('Nenhum papel ainda')).toBeInTheDocument();
    expect(screen.getByText('0 papéis')).toBeInTheDocument();
    const empty = within(table());
    await user.click(empty.getByRole('button', { name: 'Novo papel' }));
    expect(await screen.findByRole('dialog', { name: 'Novo papel' })).toBeInTheDocument();
  });

  it('mostra o erro com "Tentar de novo" e carrega de novo', async () => {
    api.respond('GET /v1/roles', problem(503, 'unavailable'), json({ items: ROLES }));
    const { user } = renderRoles();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os papéis');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Configurador')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('sem a permissão, explica e não oferece "Tentar de novo"', async () => {
    api.respond('GET /v1/roles', problem(403, 'no_permission'));
    renderRoles();

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('o menu oferece editar e remover; remover fica desabilitado, com o motivo, se o papel tem usuários', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }));
    const { user } = renderRoles();
    await screen.findByText('Configurador');

    let menu = await openMenuOf(user, AUDITOR_ROLE.name);
    expect(within(menu).getByRole('menuitem', { name: 'Editar papel' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Remover papel' })).not.toHaveAttribute('aria-disabled');
    await user.keyboard('{Escape}');

    menu = await openMenuOf(user, 'Configurador');
    const deleteItem = within(menu).getByRole('menuitem', { name: 'Remover papel' });
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
    expect(deleteItem).toHaveAccessibleDescription(roleInUseReason(3));
    expect(roleInUseReason(3)).toBe('Em uso por 3 usuários: tire o papel deles em Usuários antes de remover');
    await user.click(deleteItem);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    menu = await openMenuOf(user, 'Sem acesso');
    expect(within(menu).getByRole('menuitem', { name: 'Remover papel' })).toHaveAccessibleDescription(
      'Em uso por 1 usuário: tire o papel deles em Usuários antes de remover',
    );
  });
});

describe('Papéis: criar', () => {
  it('mostra o catálogo agrupado, com as sensíveis destacadas, e cria o papel', async () => {
    setCsrfCookie('csrf-123');
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE] }), json({ items: [ADMIN_ROLE, AUDITOR_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    api.respond('POST /v1/roles', json(AUDITOR_ROLE, 201));
    const { user } = renderRoles();
    await screen.findByText('1 papel');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    const permissionCatalog = await within(dialog).findByRole('group', { name: 'Permissões' });

    // Groups in the catalog order, each with its permissions.
    const groups = within(permissionCatalog).getAllByRole('group');
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual(['Administração', 'Dados', 'Workflows', 'Auditoria']);
    const data = within(permissionCatalog).getByRole('group', { name: 'Dados' });
    expect(within(data).getAllByRole('checkbox')).toHaveLength(2);

    // The sensitive ones carry the "Sensível" badge (also in the accessible name) and the help explains it.
    expect(within(data).getByRole('checkbox', { name: 'Gerenciar credenciais Sensível' })).toBeInTheDocument();
    expect(within(data).getByRole('checkbox', { name: 'Ver conexões' })).toBeInTheDocument();
    expect(within(permissionCatalog).getAllByRole('checkbox', { name: /Sensível$/ })).toHaveLength(3);
    expect(permissionCatalog).toHaveAccessibleDescription(/Dê uma a uma, só a quem precisa/);
    expect(within(permissionCatalog).getByText('0 de 9 marcadas')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), '  Auditor de contratos  ');
    await user.click(within(permissionCatalog).getByRole('checkbox', { name: 'Ver auditoria' }));
    await user.click(within(permissionCatalog).getByRole('checkbox', { name: 'Aprovar versões Sensível' }));
    expect(within(permissionCatalog).getByText('2 de 9 marcadas')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [creation] = api.callsTo('POST /v1/roles');
    expect(creation!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await creation!.json()).toEqual({ name: 'Auditor de contratos', permissions: ['audit.view', 'versions.approve'] });
    expect(await screen.findByText(AUDITOR_ROLE.name)).toBeInTheDocument();
  });

  it('pede o nome antes de enviar', async () => {
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    const { user } = renderRoles();
    await screen.findByText('1 papel');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    await within(dialog).findByRole('group', { name: 'Administração' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('textbox', { name: 'Nome' })).toHaveAccessibleDescription('Informe o nome do papel');
    expect(api.callsTo('POST /v1/roles')).toHaveLength(0);
  });

  it('não deixa salvar enquanto o catálogo carrega', async () => {
    const pending = pendingResponse(() => json({ items: PERMISSION_CATALOG }));
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE] }));
    api.respond('GET /v1/permissions', pending.promise);
    const { user } = renderRoles();
    await screen.findByText('1 papel');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    expect(within(dialog).getByText('Carregando o catálogo de permissões')).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(PERMISSION_CATALOG_LOADING_REASON);

    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Leitura');
    await user.click(save);
    expect(api.callsTo('POST /v1/roles')).toHaveLength(0);

    pending.release();
    await within(dialog).findByRole('group', { name: 'Dados' });
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('mostra o erro do catálogo, com "Tentar de novo", e não deixa salvar', async () => {
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE] }));
    api.respond('GET /v1/permissions', problem(503, 'unavailable'), json({ items: PERMISSION_CATALOG }));
    const { user } = renderRoles();
    await screen.findByText('1 papel');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar o catálogo de permissões');
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toHaveAccessibleDescription(PERMISSION_CATALOG_ERROR_REASON);

    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(dialog).findByRole('group', { name: 'Workflows' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('role_already_exists: mostra o erro no nome e mantém o diálogo aberto', async () => {
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE, CONFIGURATOR_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    api.respond('POST /v1/roles', problem(409, 'role_already_exists'));
    const { user } = renderRoles();
    await screen.findByText('Configurador');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    await within(dialog).findByRole('group', { name: 'Dados' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'configurador');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveAccessibleDescription(ROLE_ALREADY_EXISTS_MESSAGE),
    );
    expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog', { name: 'Novo papel' })).toBeInTheDocument();
  });

  it('invalid_data: mostra o erro de cada campo vindo da API', async () => {
    api.respond('GET /v1/roles', json({ items: [ADMIN_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    api.respond('POST /v1/roles', problem(422, 'invalid_data', { fields: { 'permissions.0': 'Permissão desconhecida.' } }));
    const { user } = renderRoles();
    await screen.findByText('1 papel');

    await user.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo papel' });
    const permissionCatalog = await within(dialog).findByRole('group', { name: 'Permissões' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Leitura');
    await user.click(within(permissionCatalog).getByRole('checkbox', { name: 'Ver workflows' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(permissionCatalog).toHaveAccessibleDescription(/Permissão desconhecida\./));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });
});

describe('Papéis: editar', () => {
  it('abre com o nome e as permissões do papel e salva o que mudou', async () => {
    setCsrfCookie('csrf-456');
    const updated = { ...CONFIGURATOR_ROLE, name: 'Configurador sênior', permissions: ['workflows.view', 'connections.view', 'versions.approve'] };
    api.respond('GET /v1/roles', json({ items: ROLES }), json({ items: [ADMIN_ROLE, updated, AUDITOR_ROLE, EMPTY_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    api.respond(`PUT /v1/roles/${CONFIGURATOR_ROLE.id}`, json(updated));
    const { user } = renderRoles();
    await screen.findByText('Configurador');

    const menu = await openMenuOf(user, 'Configurador');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar papel' });
    const permissionCatalog = await within(dialog).findByRole('group', { name: 'Permissões' });

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('Configurador');
    expect(within(permissionCatalog).getByRole('checkbox', { name: 'Ver workflows' })).toBeChecked();
    expect(within(permissionCatalog).getByRole('checkbox', { name: 'Editar workflows' })).toBeChecked();
    expect(within(permissionCatalog).getByRole('checkbox', { name: 'Ver conexões' })).toBeChecked();
    expect(within(permissionCatalog).getByRole('checkbox', { name: 'Aprovar versões Sensível' })).not.toBeChecked();
    expect(within(permissionCatalog).getByText('3 de 9 marcadas')).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Configurador sênior');
    await user.click(within(permissionCatalog).getByRole('checkbox', { name: 'Editar workflows' }));
    await user.click(within(permissionCatalog).getByRole('checkbox', { name: 'Aprovar versões Sensível' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [update] = api.callsTo(`PUT /v1/roles/${CONFIGURATOR_ROLE.id}`);
    expect(update!.headers.get('X-CSRF-Token')).toBe('csrf-456');
    expect(await update!.json()).toEqual({ name: 'Configurador sênior', permissions: ['workflows.view', 'connections.view', 'versions.approve'] });
    expect(await screen.findByText('Configurador sênior')).toBeInTheDocument();
  });

  it('not_found: avisa que o papel não existe mais e atualiza a lista', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }), json({ items: [ADMIN_ROLE, CONFIGURATOR_ROLE, EMPTY_ROLE] }));
    api.respond('GET /v1/permissions', json({ items: PERMISSION_CATALOG }));
    api.respond(`PUT /v1/roles/${AUDITOR_ROLE.id}`, problem(404, 'not_found'));
    const { user } = renderRoles();
    await screen.findByText(AUDITOR_ROLE.name);

    const menu = await openMenuOf(user, AUDITOR_ROLE.name);
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar papel' });
    await within(dialog).findByRole('group', { name: 'Dados' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(ROLE_NOT_FOUND_MESSAGE);
    await waitFor(() => expect(api.callsTo('GET /v1/roles')).toHaveLength(2));
  });
});

describe('Papéis: remover', () => {
  it('pede confirmação e remove o papel', async () => {
    setCsrfCookie('csrf-789');
    api.respond('GET /v1/roles', json({ items: ROLES }), json({ items: [ADMIN_ROLE, CONFIGURATOR_ROLE, EMPTY_ROLE] }));
    api.respond(`DELETE /v1/roles/${AUDITOR_ROLE.id}`, new Response(null, { status: 204 }));
    const { user } = renderRoles();
    await screen.findByText(AUDITOR_ROLE.name);

    const menu = await openMenuOf(user, AUDITOR_ROLE.name);
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover papel' });
    expect(dialog).toHaveAccessibleDescription(`O papel ${AUDITOR_ROLE.name} deixa de existir neste tenant. Não dá para desfazer.`);
    expect(api.callsTo(`DELETE /v1/roles/${AUDITOR_ROLE.id}`)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Remover papel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [deletion] = api.callsTo(`DELETE /v1/roles/${AUDITOR_ROLE.id}`);
    expect(deletion!.headers.get('X-CSRF-Token')).toBe('csrf-789');
    await waitFor(() => expect(screen.queryByText(AUDITOR_ROLE.name)).not.toBeInTheDocument());
    expect(screen.getByText('3 papéis')).toBeInTheDocument();
  });

  it('"Cancelar" fecha sem remover', async () => {
    api.respond('GET /v1/roles', json({ items: ROLES }));
    const { user } = renderRoles();
    await screen.findByText(AUDITOR_ROLE.name);

    const menu = await openMenuOf(user, AUDITOR_ROLE.name);
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover papel' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(`DELETE /v1/roles/${AUDITOR_ROLE.id}`)).toHaveLength(0);
    expect(screen.getByText(AUDITOR_ROLE.name)).toBeInTheDocument();
  });

  it('role_in_use: explica, trava o botão com o motivo e atualiza a lista', async () => {
    const inUse = { ...AUDITOR_ROLE, user_count: 1 };
    api.respond('GET /v1/roles', json({ items: ROLES }), json({ items: [ADMIN_ROLE, CONFIGURATOR_ROLE, inUse, EMPTY_ROLE] }));
    api.respond(`DELETE /v1/roles/${AUDITOR_ROLE.id}`, problem(409, 'role_in_use'));
    const { user } = renderRoles();
    await screen.findByText(AUDITOR_ROLE.name);

    const menu = await openMenuOf(user, AUDITOR_ROLE.name);
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover papel' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover papel' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(ROLE_IN_USE_MESSAGE);
    const deleteItem = within(dialog).getByRole('button', { name: 'Remover papel' });
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
    expect(deleteItem).toHaveAccessibleDescription(DELETE_IN_USE_REASON);
    await user.click(deleteItem);
    expect(api.callsTo(`DELETE /v1/roles/${AUDITOR_ROLE.id}`)).toHaveLength(1);
    await waitFor(() => expect(api.callsTo('GET /v1/roles')).toHaveLength(2));
  });
});
