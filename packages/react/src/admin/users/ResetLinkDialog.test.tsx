import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY_FAILED_MESSAGE, validityText } from './ResetLinkDialog';
import {
  NO_PERMISSION_MESSAGE,
  EXTERNAL_USER_MESSAGE,
  INACTIVE_USER_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from './messages';
import {
  ANA,
  BRUNO,
  setCsrfCookie,
  json,
  problem,
  renderUsers,
  pendingResponse,
  simulateApi,
  type SimulatedApi,
} from './users.test-support';

let api: SimulatedApi;

const LINK = 'https://casca.exemplo.com/reset-password?token=tok-uso-unico-123';
const LINK_ROUTE = `POST /v1/users/${BRUNO.id}/password-reset`;

/** Local date (in the time zone of whoever runs the test), as ISO/UTC like the API sends. */
function localIso(year: number, month: number, day: number, time: number, minute: number): string {
  return new Date(year, month - 1, day, time, minute).toISOString();
}
const EXPIRES_AT = localIso(2026, 11, 16, 14, 30);

beforeEach(() => {
  api = simulateApi();
  api.respond('GET /v1/users', json({ items: [ANA, BRUNO], next_cursor: null }));
  setCsrfCookie('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openLink(user: UserEvent) {
  await screen.findByText('Bruno Figueiredo de Albuquerque');
  await user.click(screen.getByRole('button', { name: 'Mais ações para Bruno Figueiredo de Albuquerque' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Gerar link de redefinição' }));
  return screen.findByRole('dialog', { name: 'Link de redefinição' });
}

describe('Usuários: gerar link de redefinição', () => {
  it('pede confirmação antes de gerar e não chama a API ao abrir', async () => {
    const { user } = renderUsers();
    const panel = await openLink(user);

    expect(panel).toHaveAccessibleDescription(
      'Gera um link de uso único para Bruno Figueiredo de Albuquerque definir a senha. Um link novo invalida os anteriores.',
    );
    // Focus starts on the first button (Cancelar): an accidental Enter does not invalidate the previous link.
    expect(within(panel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(api.callsTo(LINK_ROUTE)).toHaveLength(0);

    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(LINK_ROUTE)).toHaveLength(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mais ações para Bruno Figueiredo de Albuquerque' })).toHaveFocus(),
    );
  });

  it('gera, mostra o link uma vez com a validade e copia', async () => {
    api.respond(LINK_ROUTE, json({ link: LINK, expires_at: EXPIRES_AT }, 201));
    const { user } = renderUsers();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    const panel = await openLink(user);

    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));

    const field = await within(panel).findByRole('textbox', { name: 'Link' });
    expect(field).toHaveValue(LINK);
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription('Válido até 16/11, 14:30. Funciona uma vez só.');
    expect(within(panel).getByText('Copie o link agora: ele não será mostrado de novo.')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Gerar link de redefinição' })).not.toBeInTheDocument();

    const [req] = api.callsTo(LINK_ROUTE);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');

    await user.click(within(panel).getByRole('button', { name: 'Copiar' }));
    expect(write).toHaveBeenCalledWith(LINK);
    expect(await navigator.clipboard.readText()).toBe(LINK);
    expect(await within(panel).findByText('Link copiado')).toBeInTheDocument();
  });

  it('ao fechar, o link some: reabrir pede para gerar de novo', async () => {
    api.respond(LINK_ROUTE, json({ link: LINK, expires_at: EXPIRES_AT }, 201));
    const { user, queryClient } = renderUsers();
    let panel = await openLink(user);
    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));
    await within(panel).findByRole('textbox', { name: 'Link' });

    // The footer "Fechar" (the other one is in the dialog corner).
    await user.click(within(panel).getAllByRole('button', { name: 'Fechar' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue(LINK)).not.toBeInTheDocument();
    // Neither in the query cache nor in the mutation cache.
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain('tok-uso-unico');

    panel = await openLink(user);
    expect(within(panel).queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Gerar link de redefinição' })).toBeInTheDocument();
  });

  it('enquanto gera, o botão fica ocupado e não gera duas vezes', async () => {
    const pending = pendingResponse(() => json({ link: LINK, expires_at: EXPIRES_AT }, 201));
    api.respond(LINK_ROUTE, pending.promise);
    const { user } = renderUsers();
    const panel = await openLink(user);

    const generate = within(panel).getByRole('button', { name: 'Gerar link de redefinição' });
    await user.click(generate);
    await waitFor(() => expect(generate).toHaveAttribute('aria-busy', 'true'));
    await user.click(generate);
    expect(api.callsTo(LINK_ROUTE)).toHaveLength(1);

    pending.release();
    expect(await within(panel).findByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });

  it('se não der para copiar, explica como copiar à mão', async () => {
    api.respond(LINK_ROUTE, json({ link: LINK, expires_at: EXPIRES_AT }, 201));
    const { user } = renderUsers();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    const panel = await openLink(user);
    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));
    await within(panel).findByRole('textbox', { name: 'Link' });

    await user.click(within(panel).getByRole('button', { name: 'Copiar' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(COPY_FAILED_MESSAGE);
    expect(within(panel).getByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });

  it.each([
    ['inactive_user', 409, INACTIVE_USER_MESSAGE],
    ['external_user', 409, EXTERNAL_USER_MESSAGE],
    ['not_found', 404, USER_NOT_FOUND_MESSAGE],
  ])('%s: explica, não oferece gerar de novo e atualiza a lista', async (code, status, message) => {
    api.respond(LINK_ROUTE, problem(status, code));
    const { user } = renderUsers();
    const panel = await openLink(user);

    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(message);
    const generate = within(panel).getByRole('button', { name: 'Gerar link de redefinição' });
    expect(generate).toHaveAttribute('aria-disabled', 'true');
    expect(generate).toHaveAccessibleDescription('Feche e confira o usuário na lista atualizada');
    await waitFor(() => expect(api.callsTo('GET /v1/users')).toHaveLength(2));
  });

  it('sem permissão: explica', async () => {
    api.respond(LINK_ROUTE, problem(403, 'no_permission'));
    const { user } = renderUsers();
    const panel = await openLink(user);

    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });

  it('erro passageiro: mostra a mensagem e deixa gerar de novo', async () => {
    api.respond(LINK_ROUTE, problem(503, 'unavailable'), json({ link: LINK, expires_at: EXPIRES_AT }, 201));
    const { user } = renderUsers();
    const panel = await openLink(user);

    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(within(panel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(panel).findByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });
});

describe('validityText', () => {
  it('formata no padrão brasileiro e tolera data inválida', () => {
    expect(validityText(localIso(2026, 1, 5, 9, 5))).toBe('Válido até 05/01, 09:05. Funciona uma vez só.');
    expect(validityText('não é data')).toBe('Funciona uma vez só.');
  });
});
