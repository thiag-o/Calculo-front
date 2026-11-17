import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeys } from '.';
import { REVOKE_NOT_FOUND_REASON } from './RevokeApiKeyDialog';
import { API_KEY_NOT_FOUND_MESSAGE, NO_PERMISSION_MESSAGE } from './messages';
import {
  OLD_API_KEY,
  ERP_API_KEY,
  PORTAL_API_KEY,
  API_KEYS,
  setCsrfCookie,
  json,
  problem,
  renderIntegration,
  pendingResponse,
  noContent,
  simulateApi,
  type SimulatedApi,
} from './integration.test-support';

let api: SimulatedApi;

const LIST_ROUTE = 'GET /v1/api-keys';
const REVOKE_ROUTE = `DELETE /v1/api-keys/${PORTAL_API_KEY.id}`;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderScreen() {
  return renderIntegration(<ApiKeys />);
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr')!;
}

describe('Integração: lista de chaves de API', () => {
  it('mostra nome e prefixo, criada, último uso e situação, com as revogadas', async () => {
    api.respond(LIST_ROUTE, json({ items: API_KEYS, next_cursor: null }));
    renderScreen();

    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(screen.getByText('3 chaves · 1 revogada')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Chaves de API do tenant' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Chave',
      'Criada',
      'Último uso',
      'Situação',
      'Ações',
    ]);

    const portal = within(rowOf('Portal do cliente'));
    expect(portal.getByText('fc_3k9Q…')).toBeInTheDocument();
    expect(portal.getByText('02/11/2026')).toBeInTheDocument();
    expect(portal.getByText('15/11/2026 às 09:05')).toBeInTheDocument();
    expect(portal.getByText('Ativa')).toBeInTheDocument();

    const erp = within(rowOf(ERP_API_KEY.name));
    expect(erp.getByText('Nunca usada')).toBeInTheDocument();

    const old = within(rowOf('Portal antigo'));
    expect(old.getByText('fc_a0b1…')).toBeInTheDocument();
    expect(old.getByText('01/03/2026 às 18:30')).toBeInTheDocument();
    expect(old.getByText('Revogada')).toBeInTheDocument();
    expect(old.getByText('em 02/03/2026')).toBeInTheDocument();
    expect(old.queryByText('Ativa')).not.toBeInTheDocument();
  });

  it('a lista nunca mostra a chave inteira, só o prefixo', async () => {
    api.respond(LIST_ROUTE, json({ items: [PORTAL_API_KEY], next_cursor: null }));
    renderScreen();
    await screen.findByText('Portal do cliente');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('1 chave')).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pending = pendingResponse(() => json({ items: [PORTAL_API_KEY], next_cursor: null }));
    api.respond(LIST_ROUTE, pending.promise);
    renderScreen();

    expect(screen.getByRole('table', { name: 'Chaves de API do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando chaves de api do tenant');
    expect(screen.getByText('Para o backend do sistema hospedeiro pedir tokens de incorporação')).toBeInTheDocument();

    pending.release();
    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
  });

  it('vazio: diz o que falta e oferece criar a primeira chave', async () => {
    api.respond(LIST_ROUTE, json({ items: [], next_cursor: null }));
    const { user } = renderScreen();

    expect(await screen.findByText('Nenhuma chave de API ainda')).toBeInTheDocument();
    expect(screen.getByText('Crie uma chave para o sistema hospedeiro incorporar o módulo.')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Nova chave de API' });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[1]!);
    expect(await screen.findByRole('dialog', { name: 'Nova chave de API' })).toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.respond(LIST_ROUTE, problem(503, 'unavailable'), json({ items: [PORTAL_API_KEY], next_cursor: null }));
    const { user } = renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as chaves de API');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.respond(LIST_ROUTE, problem(403, 'no_permission'));
    renderScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('pagina por cursor com "Carregar mais chaves"', async () => {
    api.respond(
      LIST_ROUTE,
      json({ items: [PORTAL_API_KEY, ERP_API_KEY], next_cursor: 'cursor-2' }),
      json({ items: [OLD_API_KEY], next_cursor: null }),
    );
    const { user } = renderScreen();

    await screen.findByText('Portal do cliente');
    expect(screen.getByText('Mais de 2 chaves')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carregar mais chaves' }));

    expect(await screen.findByText('Portal antigo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais chaves' })).not.toBeInTheDocument();
    const [first, second] = api.callsTo(LIST_ROUTE);
    expect(new URL(first!.url).searchParams.get('cursor')).toBeNull();
    expect(new URL(second!.url).searchParams.get('cursor')).toBe('cursor-2');
  });

  it('erro ao carregar a próxima página: a lista fica e dá para tentar de novo', async () => {
    api.respond(
      LIST_ROUTE,
      json({ items: [PORTAL_API_KEY], next_cursor: 'cursor-2' }),
      problem(503, 'unavailable'),
      json({ items: [OLD_API_KEY], next_cursor: null }),
    );
    const { user } = renderScreen();

    await screen.findByText('Portal do cliente');
    await user.click(screen.getByRole('button', { name: 'Carregar mais chaves' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais chaves');
    expect(screen.getByText('Portal do cliente')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Portal antigo')).toBeInTheDocument();
  });
});

async function openRevoke(user: UserEvent, name = 'Portal do cliente') {
  await screen.findByText(name);
  await user.click(screen.getByRole('button', { name: `Mais ações para a chave ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Revogar chave' }));
  return screen.findByRole('dialog', { name: 'Revogar chave' });
}

describe('Integração: revogar chave', () => {
  beforeEach(() => {
    api.respond(LIST_ROUTE, json({ items: API_KEYS, next_cursor: null }));
  });

  it('pede confirmação e cancelar não revoga; o foco volta ao "…" da linha', async () => {
    const { user } = renderScreen();
    const panel = await openRevoke(user);

    expect(panel).toHaveAccessibleDescription(
      'A chave Portal do cliente (fc_3k9Q…) para de funcionar: o sistema que a usa não consegue mais pedir tokens de incorporação. Não dá para desfazer.',
    );
    expect(within(panel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(REVOKE_ROUTE)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para a chave Portal do cliente' })).toHaveFocus());
  });

  it('revoga com CSRF, fecha, atualiza a lista e devolve o foco à linha', async () => {
    const revoked = { ...PORTAL_API_KEY, revoked_at: OLD_API_KEY.revoked_at };
    api.respond(REVOKE_ROUTE, noContent());
    const { user } = renderScreen();
    const panel = await openRevoke(user);
    api.respond(LIST_ROUTE, json({ items: [revoked, ERP_API_KEY, OLD_API_KEY], next_cursor: null }));

    await user.click(within(panel).getByRole('button', { name: 'Revogar chave' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.callsTo(REVOKE_ROUTE);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await screen.findByText('3 chaves · 2 revogadas')).toBeInTheDocument();
    expect(within(rowOf('Portal do cliente')).getByText('Revogada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para a chave Portal do cliente' })).toHaveFocus());
  });

  it('enquanto revoga, o botão fica ocupado e não revoga duas vezes', async () => {
    const pending = pendingResponse(() => noContent());
    api.respond(REVOKE_ROUTE, pending.promise);
    const { user } = renderScreen();
    const panel = await openRevoke(user);

    const revoke = within(panel).getByRole('button', { name: 'Revogar chave' });
    await user.click(revoke);
    await waitFor(() => expect(revoke).toHaveAttribute('aria-busy', 'true'));
    await user.click(revoke);
    expect(api.callsTo(REVOKE_ROUTE)).toHaveLength(1);

    pending.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('chave revogada: o item fica desabilitado com o motivo', async () => {
    const { user } = renderScreen();
    await screen.findByText('Portal antigo');
    await user.click(screen.getByRole('button', { name: 'Mais ações para a chave Portal antigo' }));

    const item = await screen.findByRole('menuitem', { name: 'Revogar chave' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('A chave já foi revogada em 02/03/2026');
    await user.click(item);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('not_found: explica, não oferece revogar de novo e atualiza a lista', async () => {
    api.respond(`DELETE /v1/api-keys/${ERP_API_KEY.id}`, problem(404, 'not_found'));
    const { user } = renderScreen();
    const panel = await openRevoke(user, ERP_API_KEY.name);

    await user.click(within(panel).getByRole('button', { name: 'Revogar chave' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(API_KEY_NOT_FOUND_MESSAGE);
    const revoke = within(panel).getByRole('button', { name: 'Revogar chave' });
    expect(revoke).toHaveAttribute('aria-disabled', 'true');
    expect(revoke).toHaveAccessibleDescription(REVOKE_NOT_FOUND_REASON);
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
  });

  it('sem permissão: explica', async () => {
    api.respond(REVOKE_ROUTE, problem(403, 'no_permission'));
    const { user } = renderScreen();
    const panel = await openRevoke(user);

    await user.click(within(panel).getByRole('button', { name: 'Revogar chave' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });

  it('erro passageiro: mostra a mensagem e deixa revogar de novo', async () => {
    api.respond(REVOKE_ROUTE, problem(503, 'unavailable'), noContent());
    const { user } = renderScreen();
    const panel = await openRevoke(user);

    await user.click(within(panel).getByRole('button', { name: 'Revogar chave' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(within(panel).getByRole('button', { name: 'Revogar chave' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(REVOKE_ROUTE)).toHaveLength(2);
  });
});
