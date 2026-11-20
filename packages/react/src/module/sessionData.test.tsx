import '@testing-library/jest-dom/vitest';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataOrError, useApiClient } from '../api';
import { onSessionDataCleared, useSession, type Session } from '../session';
import { FluxoModule } from './FluxoCalculo';
import {
  API,
  BRANCH_TENANT,
  branchSession,
  headquartersSession,
  json,
  noContent,
  problem,
  simulateApi,
  simulateWidth,
} from './module.test-support';
import type { ScreenDefinition } from './screens';

const brunoSession: Session = {
  ...headquartersSession,
  user: { id: '00000000-0000-0000-0000-000000000002', name: 'Bruno Carvalho', email: 'bruno@exemplo.com' },
};

/** What the module showed, render by render: whose session, in which tenant, and the screen data. */
let renders: string[] = [];
/** The module's QueryClient and what the memories registered with `onSessionDataCleared` were told. */
let moduleClient: QueryClient | null = null;
let clearedWith: (string | undefined)[] = [];
/** For each clear, whether the screen with the person's data was still on screen. */
let screenOnClear: boolean[] = [];

beforeEach(() => {
  simulateWidth(1440);
  document.cookie = 'fc_csrf=csrf-de-teste; path=/';
  renders = [];
  moduleClient = null;
  clearedWith = [];
  screenOnClear = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

/**
 * A screen with data of the person and tenant (`GET /v1/workflows`), a field with local state and, once per module, a
 * memory kept outside the cache, like the editor's.
 */
function PersonScreen() {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const session = useSession();
  const data = useQuery({
    queryKey: ['workflows', 'list'],
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/workflows', { signal })) as Promise<unknown> as Promise<string>,
  });
  const [note, setNote] = useState('');
  useEffect(() => {
    if (moduleClient === queryClient) return;
    moduleClient = queryClient;
    onSessionDataCleared(queryClient, (next) => {
      clearedWith.push(next?.current_tenant.name);
      screenOnClear.push(screen.queryByRole('heading', { name: 'Dados' }) !== null);
    });
  }, [queryClient]);
  renders.push(`${session.data?.user.name ?? '-'} em ${session.data?.current_tenant.name ?? '-'} | ${data.data ?? 'carregando'}`);
  return (
    <div>
      <h1>Dados</h1>
      <p>{data.data ?? 'Carregando dados'}</p>
      <label>
        Anotação
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
    </div>
  );
}

const SCREENS: readonly ScreenDefinition[] = [{ id: 'home', label: 'Início', path: 'home', icon: null, content: <PersonScreen /> }];

/** The API: the session and the data of whoever is asking (the token) or of the tenant the cookie session is in. */
function simulatePeople() {
  let cookieSession: Session | null = headquartersSession;
  const tokens: Record<string, Session> = { 'token-ana': headquartersSession, 'token-bruno': brunoSession };
  const sessionOf = (request: Request): Session | null => {
    const authorization = request.headers.get('Authorization');
    return authorization ? (tokens[authorization.replace('Bearer ', '')] ?? null) : cookieSession;
  };
  const api = simulateApi({
    'GET /v1/session': (request) => {
      const session = sessionOf(request);
      return session ? json(session) : problem(401, 'no_session');
    },
    'GET /v1/workflows': (request) => {
      const session = sessionOf(request);
      return session ? json(`workflows de ${session.user.name} em ${session.current_tenant.name}`) : problem(401, 'no_session');
    },
    'PUT /v1/session/tenant': () => {
      cookieSession = branchSession;
      return json(branchSession);
    },
    'DELETE /v1/session': () => {
      cookieSession = null;
      return noContent();
    },
  });
  return {
    ...api,
    /** The token stops working (expired or revoked). */
    expire(token: string) {
      delete tokens[token];
    },
    dataCalls: () => api.calls().filter((call) => call === 'GET /v1/workflows').length,
  };
}

function renderModule(token?: string) {
  const onSessionExpired = vi.fn();
  const user = userEvent.setup({ delay: null });
  const view = render(
    <FluxoModule apiUrl={API} navigation="memory" screens={SCREENS} token={token} onSessionExpired={onSessionExpired} />,
  );
  const changeToken = (next: string) =>
    view.rerender(<FluxoModule apiUrl={API} navigation="memory" screens={SCREENS} token={next} onSessionExpired={onSessionExpired} />);
  return { user, onSessionExpired, changeToken, ...view };
}

/** The queries left in the module's cache, besides the session, with their data. */
function cachedData(): unknown[] {
  return moduleClient!
    .getQueryCache()
    .getAll()
    .filter((query) => query.queryKey[0] !== 'session')
    .map((query) => query.state.data);
}

const field = () => screen.getByRole('textbox', { name: 'Anotação' });

describe('dados da sessão no logout, na troca de tenant e no 401', () => {
  it('no logout, o cache e a memória ficam vazios e a tela de sessão encerrada não mostra nada do usuário', async () => {
    const api = simulatePeople();
    const { user, onSessionExpired } = renderModule();
    expect(await screen.findByText('workflows de Ana Beatriz Souza em Matriz')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(moduleClient!.getQueryCache().getAll()).toEqual([]);
    expect(moduleClient!.getMutationCache().getAll()).toEqual([]);
    expect(screen.queryByText(/Ana Beatriz/)).not.toBeInTheDocument();
    expect(api.calls()).toContain('DELETE /v1/session');
  });

  it('o logout limpa uma vez só, depois de a tela sair, e nenhuma consulta busca de novo e toma 401', async () => {
    const api = simulatePeople();
    const { user } = renderModule();
    expect(await screen.findByText('workflows de Ana Beatriz Souza em Matriz')).toBeInTheDocument();
    const callsBefore = api.calls().length;

    await user.click(screen.getByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    // A few turns more: a second clear or a refetch would show up here.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(clearedWith).toEqual([undefined]);
    expect(screenOnClear).toEqual([false]);
    expect(api.calls().slice(callsBefore)).toEqual(['DELETE /v1/session']);
  });

  it('na troca de tenant, a tela começa de novo e busca os dados do tenant novo, sem nada do anterior no cache', async () => {
    const api = simulatePeople();
    const { user } = renderModule();
    expect(await screen.findByText('workflows de Ana Beatriz Souza em Matriz')).toBeInTheDocument();
    await user.type(field(), 'rascunho na Matriz');
    expect(api.dataCalls()).toBe(1);

    const selector = screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' });
    await user.click(selector);
    await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.name }));

    expect(await screen.findByText(`workflows de Ana Beatriz Souza em ${BRANCH_TENANT.name}`)).toBeInTheDocument();
    // Fetched again in the new tenant (the simulated answer is instant, so the remounted screen may ask once more).
    expect(api.dataCalls()).toBeGreaterThan(1);
    // The screen started over: the local state of the previous tenant is gone.
    expect(field()).toHaveValue('');
    expect(clearedWith).toEqual([BRANCH_TENANT.name]);
    expect(cachedData()).toEqual([`workflows de Ana Beatriz Souza em ${BRANCH_TENANT.name}`]);
    // No render showed the new tenant next to the previous one's data.
    const afterSwitch = renders.slice(renders.findIndex((line) => line.includes(BRANCH_TENANT.name)));
    expect(afterSwitch.some((line) => line.includes('em Matriz'))).toBe(false);
    // The sidebar stays mounted: the selector is the same element, now with the new tenant.
    expect(screen.getByRole('button', { name: `Trocar cliente. Atual: ${BRANCH_TENANT.name}` })).toBe(selector);
  });

  it('quando a sessão expira (401), o cache e a memória ficam vazios, e com o token novo a tela busca de novo', async () => {
    const api = simulatePeople();
    const { onSessionExpired, changeToken } = renderModule('token-ana');
    expect(await screen.findByText('workflows de Ana Beatriz Souza em Matriz')).toBeInTheDocument();

    api.expire('token-ana');
    await act(() => moduleClient!.refetchQueries({ queryKey: ['workflows'] }));

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(moduleClient!.getQueryCache().getAll()).toEqual([]));
    expect(clearedWith).toContain(undefined);

    const callsBefore = api.dataCalls();
    changeToken('token-bruno');
    expect(await screen.findByText('workflows de Bruno Carvalho em Matriz')).toBeInTheDocument();
    expect(api.dataCalls()).toBe(callsBefore + 1);
    expect(renders.some((line) => line.startsWith('Bruno') && line.includes('Ana'))).toBe(false);
  });

  it('dois usuários seguidos no mesmo módulo: o segundo não vê dado nem anotação do primeiro', async () => {
    const api = simulatePeople();
    const { user, changeToken } = renderModule('token-ana');
    expect(await screen.findByText('workflows de Ana Beatriz Souza em Matriz')).toBeInTheDocument();
    await user.type(field(), 'anotação da Ana');

    changeToken('token-bruno');

    expect(await screen.findByText('workflows de Bruno Carvalho em Matriz')).toBeInTheDocument();
    expect(field()).toHaveValue('');
    expect(screen.queryByText(/Ana Beatriz/)).not.toBeInTheDocument();
    expect(clearedWith).toEqual(['Matriz']);
    expect(cachedData()).toEqual(['workflows de Bruno Carvalho em Matriz']);
    expect(api.dataCalls()).toBeGreaterThan(1);
    const afterSwitch = renders.slice(renders.findIndex((line) => line.startsWith('Bruno')));
    expect(afterSwitch.some((line) => line.includes('Ana'))).toBe(false);
  });
});
