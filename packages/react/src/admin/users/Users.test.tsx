import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXTERNAL_LINK_REASON, INACTIVE_LINK_REASON } from './Users';
import { NO_PERMISSION_MESSAGE } from './messages';
import {
  ANA,
  BRUNO,
  CARLA,
  DAVI,
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole('table', { name: 'Usuários do tenant' });
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('Usuários: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json({ items: [ANA], next_cursor: null }));
    api.respond('GET /v1/users', pending.promise);
    renderUsers();

    expect(screen.getByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(table()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando usuários do tenant');

    pending.release();
    expect(await screen.findByText('Ana Beatriz Souza')).toBeInTheDocument();
    expect(table()).not.toHaveAttribute('aria-busy');
  });

  it('mostra nome, e-mail, papéis e situação de cada usuário', async () => {
    api.respond('GET /v1/users', json({ items: [ANA, BRUNO, CARLA, DAVI], next_cursor: null }));
    renderUsers();

    await screen.findByText('Ana Beatriz Souza');
    expect(screen.getByText('4 usuários')).toBeInTheDocument();
    expect(within(table()).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Nome', 'Papéis', 'Situação', 'Ações']);

    const bruno = rowOf('Bruno Figueiredo de Albuquerque');
    expect(within(bruno).getByText('bruno.figueiredo.de.albuquerque@exemplo.com')).toBeInTheDocument();
    const brunoRoles = within(bruno).getByRole('list', { name: 'Papéis de Bruno Figueiredo de Albuquerque' });
    expect(within(brunoRoles).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Configurador', 'Auditor']);
    expect(within(bruno).getByText('Ativo')).toBeInTheDocument();

    const carla = rowOf('Carla Menezes');
    expect(within(carla).getByText('Inativo')).toBeInTheDocument();
    // No roles: "—".
    expect(within(carla).getByText('—')).toBeInTheDocument();

    const davi = rowOf('Davi Externo');
    expect(within(davi).getByText('Incorporação')).toBeInTheDocument();

    expect(api.callsTo('GET /v1/users')).toHaveLength(1);
    expect(new URL(api.callsTo('GET /v1/users')[0]!.url).search).toBe('');
  });

  it('mostra o estado vazio com a ação de criar', async () => {
    api.respond('GET /v1/users', json({ items: [], next_cursor: null }));
    api.respond('GET /v1/roles', json({ items: [] }));
    const { user } = renderUsers();

    expect(await screen.findByText('Nenhum usuário ainda')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro usuário e gere o link para a pessoa definir a senha.')).toBeInTheDocument();
    expect(screen.getByText('0 usuários')).toBeInTheDocument();

    const emptyCell = within(table()).getByText('Nenhum usuário ainda').closest('td')!;
    await user.click(within(emptyCell).getByRole('button', { name: 'Novo usuário' }));
    expect(await screen.findByRole('dialog', { name: 'Novo usuário' })).toBeInTheDocument();
  });

  it('em erro, explica e tenta de novo', async () => {
    api.respond('GET /v1/users', problem(503, 'unavailable'), json({ items: [ANA], next_cursor: null }));
    const { user } = renderUsers();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os usuários');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Ana Beatriz Souza')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.callsTo('GET /v1/users')).toHaveLength(2);
  });

  it('sem conexão, mostra a mensagem do cliente', async () => {
    api.respond('GET /v1/users', () => Promise.reject(new TypeError('Failed to fetch')));
    renderUsers();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
  });

  it('sem permissão, diz o que fazer e não oferece tentar de novo', async () => {
    api.respond('GET /v1/users', problem(403, 'no_permission'));
    renderUsers();

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('carrega a próxima página pelo cursor', async () => {
    api.respond(
      'GET /v1/users',
      json({ items: [ANA, BRUNO], next_cursor: 'cursor-2' }),
      json({ items: [CARLA], next_cursor: null }),
    );
    const { user } = renderUsers();

    await screen.findByText('Ana Beatriz Souza');
    expect(screen.getByText('Mais de 2 usuários')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carregar mais usuários' }));

    expect(await screen.findByText('Carla Menezes')).toBeInTheDocument();
    expect(screen.getByText('3 usuários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais usuários' })).not.toBeInTheDocument();
    const second = api.callsTo('GET /v1/users')[1]!;
    expect(new URL(second.url).searchParams.get('cursor')).toBe('cursor-2');
  });

  it('se a próxima página falha, mantém a lista e tenta de novo', async () => {
    api.respond(
      'GET /v1/users',
      json({ items: [ANA], next_cursor: 'cursor-2' }),
      problem(422, 'invalid_cursor'),
      json({ items: [CARLA], next_cursor: null }),
    );
    const { user } = renderUsers();

    await screen.findByText('Ana Beatriz Souza');
    await user.click(screen.getByRole('button', { name: 'Carregar mais usuários' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar mais usuários');
    expect(screen.getByText('Ana Beatriz Souza')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Carla Menezes')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('o menu de cada linha oferece editar e gerar o link, com o motivo quando não dá', async () => {
    api.respond('GET /v1/users', json({ items: [ANA, CARLA, DAVI], next_cursor: null }));
    const { user } = renderUsers();
    await screen.findByText('Ana Beatriz Souza');

    await user.click(screen.getByRole('button', { name: 'Mais ações para Ana Beatriz Souza' }));
    let menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Editar usuário' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' })).not.toHaveAttribute('aria-disabled');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Mais ações para Carla Menezes' }));
    menu = await screen.findByRole('menu');
    const inactiveLink = within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' });
    expect(inactiveLink).toHaveAttribute('aria-disabled', 'true');
    expect(inactiveLink).toHaveAccessibleDescription(INACTIVE_LINK_REASON);
    await user.click(inactiveLink);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Mais ações para Davi Externo' }));
    menu = await screen.findByRole('menu');
    const externalLink = within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' });
    expect(externalLink).toHaveAttribute('aria-disabled', 'true');
    expect(externalLink).toHaveAccessibleDescription(EXTERNAL_LINK_REASON);
  });
});
