import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient, ApiProvider } from '../api';
import { FluxoRoot } from '../design-system';
import { Admin, type AdminProps } from '.';

// Browser features jsdom lacks and Radix uses (menus and dialogs of the areas).
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const API = 'https://api.teste';
const TENANT = { id: '00000000-0000-0000-0000-00000000000a', name: 'Matriz' };
const ALL = ['users.manage', 'roles.manage', 'integration.manage', 'security.manage', 'audit.view'];

function session(permissions: string[]) {
  return {
    user: { id: '00000000-0000-0000-0000-000000000001', name: 'Ana Beatriz Souza', email: 'ana@exemplo.com' },
    tenants: [TENANT],
    current_tenant: TENANT,
    permissions: permissions,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function problem(status: number, code: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code: code }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response>;

/** fetch simulated per route ("METHOD /path"); an unexpected route answers 404. The areas get empty lists. */
function simulateApi(sessionRoute: RouteResponse) {
  const routes: Record<string, RouteResponse> = {
    'GET /v1/session': sessionRoute,
    'GET /v1/users': json({ items: [], next_cursor: null }),
    'GET /v1/roles': json([]),
    'GET /v1/api-keys': json({ items: [], next_cursor: null }),
    'GET /v1/authorized-domains': json([]),
  };
  const simulatedFetch = vi.fn(async (request: Request) => {
    const response = routes[`${request.method} ${new URL(request.url).pathname}`];
    if (response === undefined) return problem(404, 'not_found');
    return (await response).clone();
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return {
    set(route: string, response: RouteResponse) {
      routes[route] = response;
    },
    calls: () => simulatedFetch.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`),
  };
}

function renderScreen(props: AdminProps = {}) {
  const user = userEvent.setup();
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const tree = (current: AdminProps) => (
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Admin {...current} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
  const { rerender } = render(tree(props));
  return { user, rerenderWith: (newOnes: AdminProps) => rerender(tree(newOnes)) };
}

const tabList = () => screen.getByRole('tablist', { name: 'Administração' });
const tabNames = () => within(tabList()).getAllByRole('tab').map((tab) => tab.textContent);
const panel = () => screen.getByRole('tabpanel');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<Admin>', () => {
  it('com todas as permissões, mostra as quatro abas e abre Usuários', async () => {
    const api = simulateApi(json(session(ALL)));
    renderScreen();

    expect(await screen.findByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    expect(tabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(panel()).toHaveAccessibleName('Usuários');
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(api.calls()).not.toContain('GET /v1/settings/security');
  });

  it('cada aba aparece só com a permissão da sua área', async () => {
    simulateApi(json(session(['integration.manage', 'security.manage'])));
    renderScreen();

    expect(await screen.findByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(tabNames()).toEqual(['Integração', 'Segurança']);
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
  });

  it('o clique troca a área mostrada', async () => {
    simulateApi(json(session(ALL)));
    const { user } = renderScreen();
    await screen.findByRole('tab', { name: 'Usuários' });

    await user.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'false');
    expect(panel()).toHaveAccessibleName('Papéis');
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('pelo teclado: Tab chega à aba escolhida, as setas andam e escolhem, Home e End vão às pontas', async () => {
    simulateApi(json(session(ALL)));
    const { user } = renderScreen();
    await screen.findByRole('tab', { name: 'Usuários' });

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();
    // Only the chosen tab is in the Tab order; the next Tab goes to the panel.
    for (const name of ['Papéis', 'Integração', 'Segurança']) {
      expect(screen.getByRole('tab', { name })).toHaveAttribute('tabindex', '-1');
    }

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
    expect(panel()).toHaveAccessibleName('Segurança');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await user.tab();
    expect(panel()).toHaveFocus();
  });

  it('com a aba controlada por quem usa a tela, abre nela e avisa a escolha sem trocar sozinha', async () => {
    simulateApi(json(session(ALL)));
    const onTabChange = vi.fn();
    const { user, rerenderWith } = renderScreen({ tab: 'integration', onTabChange });

    expect(await screen.findByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(onTabChange).toHaveBeenCalledExactlyOnceWith('roles');
    // Whoever controls decides: while `tab` does not change, the area stays the same.
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');

    rerenderWith({ tab: 'roles', onTabChange });
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();

    // Choosing the tab already open does not notify again.
    await user.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(onTabChange).toHaveBeenCalledTimes(1);
  });

  it('com a aba controlada sem permissão, abre a primeira permitida', async () => {
    simulateApi(json(session(['roles.manage', 'security.manage'])));
    renderScreen({ tab: 'users' });

    expect(await screen.findByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(tabNames()).toEqual(['Papéis', 'Segurança']);
  });

  it('sem nenhuma permissão da Administração, diz que não há área disponível', async () => {
    const api = simulateApi(json(session(['workflows.view', 'audit.view'])));
    renderScreen();

    expect(await screen.findByText('Nenhuma área da Administração disponível para você')).toBeInTheDocument();
    expect(screen.getByText('Peça ao administrador do cliente as permissões de que precisa.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.calls()).toEqual(['GET /v1/session']);
  });

  it('enquanto a sessão chega, mostra o esqueleto', async () => {
    let deliver: (response: Response) => void = () => undefined;
    simulateApi(new Promise<Response>((resolver) => (deliver = resolver)));
    renderScreen();

    expect(screen.getByRole('status')).toHaveTextContent('Carregando a Administração');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await act(async () => deliver(json(session(ALL))));
    expect(await screen.findByRole('tablist', { name: 'Administração' })).toBeInTheDocument();
  });

  it('se a sessão não carrega, diz o que houve e tenta de novo', async () => {
    const api = simulateApi(problem(503, 'unavailable'));
    const { user } = renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir a Administração');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    api.set('GET /v1/session', json(session(ALL)));
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('tablist', { name: 'Administração' })).toBeInTheDocument();
  });
});
