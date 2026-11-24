import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin, Audit, Executions, Home, Workflows } from '..';
import {
  API,
  json,
  ADMIN_PERMISSIONS,
  CONFIGURATOR_PERMISSIONS,
  problem,
  pendingResponse,
  sessionWith,
  simulateApi,
  simulateWidth,
} from '../module.test-support';

// The standalone screens (F38): each one mounts its own root, API and cache, with only `apiUrl` (cookie) or with `token`,
// and navigates in memory. Tested through the vertical's public interface, as the host app uses them.

const HOST_APP_URL = '/sistema-do-cliente/painel?aba=3#topo';

beforeEach(() => {
  window.history.replaceState(null, '', HOST_APP_URL);
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The API with the given session and empty lists on the epic 2 screens. */
function simulateApiWith(permissions: string[]) {
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/users': json({ items: [], next_cursor: null }),
    'GET /v1/roles': json({ items: [] }),
    'GET /v1/api-keys': json({ items: [], next_cursor: null }),
    'GET /v1/authorized-domains': json([]),
    'GET /v1/audit/access-events': json({ items: [], next_cursor: null }),
  });
}

const pageUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const withoutModuleNavigation = () => {
  expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Telas do Fluxo de Cálculo' })).not.toBeInTheDocument();
};
/** The module root around an element. */
const rootOf = (element: HTMLElement) => element.closest('.fc-root');

describe('<Home> avulso', () => {
  it('só com apiUrl, usa o cookie, aplica o tema e mostra a tela sem menu nem abas do módulo', async () => {
    const api = simulateApiWith([]);
    render(<Home apiUrl={API} theme="dark" />);

    const title = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(rootOf(title)).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('region', { name: 'Início' })).toContainElement(title);
    withoutModuleNavigation();

    // Without `workflows.view` the Início asks for no workflows; the session is read again as the screen mounts.
    expect(new Set(api.calls())).toEqual(new Set(['GET /v1/session']));
    expect(api.request(0).credentials).toBe('include');
    expect(api.request(0).headers.get('Authorization')).toBeNull();
    expect(pageUrl()).toBe(HOST_APP_URL);
  });

  it('com token, chama a API com Bearer e sem cookie', async () => {
    const api = simulateApiWith([]);
    render(<Home apiUrl={API} token="token-do-hospedeiro" theme="light" />);

    const title = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(rootOf(title)).toHaveAttribute('data-theme', 'light');
    expect(api.request(0).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    expect(api.request(0).credentials).toBe('omit');
  });

  it('enquanto a sessão chega, mostra o esqueleto com o nome da tela', async () => {
    const pending = pendingResponse();
    simulateApi({ 'GET /v1/session': pending.promise });
    render(<Home apiUrl={API} token="token" />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Início');
    await act(async () => pending.deliver(json(sessionWith([]))));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('se a sessão não abre, diz o que houve e tenta de novo', async () => {
    const api = simulateApi({ 'GET /v1/session': problem(403, 'origin_not_authorized') });
    const user = userEvent.setup({ delay: null });
    render(<Home apiUrl={API} token="token" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o Início');
    expect(alert).toHaveTextContent('Texto do servidor para origin_not_authorized.');

    api.set({ 'GET /v1/session': json(sessionWith([])) });
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('sem sessão (401 no_session), avisa o onSessionExpired uma vez e mostra a sessão encerrada', async () => {
    simulateApi({ 'GET /v1/session': problem(401, 'no_session') });
    const onSessionExpired = vi.fn();
    render(<Home apiUrl={API} token="token-vencido" onSessionExpired={onSessionExpired} />);

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Início' })).not.toBeInTheDocument();
  });
});

describe('<Audit> avulsa', () => {
  it('só com apiUrl, usa o cookie e abre os acessos; a lista de tipos abre no portal da raiz, com o tema', async () => {
    const api = simulateApiWith(['audit.view']);
    const user = userEvent.setup({ delay: null });
    render(<Audit apiUrl={API} theme="dark" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    withoutModuleNavigation();
    expect(api.calls()).toContain('GET /v1/audit/access-events');
    for (const index of api.calls().keys()) {
      expect(api.request(index).credentials).toBe('include');
      expect(api.request(index).headers.get('Authorization')).toBeNull();
    }

    await user.click(screen.getByRole('combobox', { name: 'Tipo de evento' }));
    const list = await screen.findByRole('listbox');
    expect(list.closest('.fc-portals')).not.toBeNull();
    expect(rootOf(list)).toHaveAttribute('data-theme', 'dark');
  });

  it('com token, chama a API com Bearer', async () => {
    const api = simulateApiWith(['audit.view']);
    render(<Audit apiUrl={API} token="token-do-hospedeiro" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(api.calls()).toContain('GET /v1/audit/access-events');
    for (const index of api.calls().keys()) {
      expect(api.request(index).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    }
  });

  it('sem audit.view, mostra o estado sem acesso e não busca os eventos', async () => {
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    render(<Audit apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Auditoria')).toBeInTheDocument();
    expect(screen.getByText('Peça ao administrador do cliente as permissões de que precisa.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acessos' })).not.toBeInTheDocument();
    expect(api.calls()).toEqual(['GET /v1/session']);
  });
});

describe('<Admin> avulsa', () => {
  it('só com apiUrl, usa o cookie; as abas trocam a área sem mexer na URL da página', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup({ delay: null });
    const historyBefore = window.history.length;
    render(<Admin apiUrl={API} />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Usuários',
      'Papéis',
      'Integração',
      'Segurança',
    ]);
    expect(within(tabs).getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    withoutModuleNavigation();

    await user.click(within(tabs).getByRole('tab', { name: 'Integração' }));
    expect(within(tabs).getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(pageUrl()).toBe(HOST_APP_URL);
    expect(window.history.length).toBe(historyBefore);

    for (const index of api.calls().keys()) {
      expect(api.request(index).credentials).toBe('include');
      expect(api.request(index).headers.get('Authorization')).toBeNull();
    }
  });

  it('com token e tema, o diálogo abre no portal da raiz do módulo, com o tema', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup({ delay: null });
    render(<Admin apiUrl={API} token="token-do-hospedeiro" theme="dark" />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    const [newUser] = await screen.findAllByRole('button', { name: 'Novo usuário' });
    await user.click(newUser as HTMLElement);

    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });
    expect(dialog.closest('.fc-portals')).not.toBeNull();
    expect(rootOf(dialog)).toHaveAttribute('data-theme', 'dark');
    // The portal sits in this screen's root, not in the host app body.
    expect(rootOf(dialog)).toBe(rootOf(tabs));
    expect(within(dialog).getByRole('textbox', { name: 'E-mail' })).toBeInTheDocument();

    for (const index of api.calls().keys()) {
      expect(api.request(index).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
      expect(api.request(index).credentials).toBe('omit');
    }
  });

  it('mostra só as áreas permitidas', async () => {
    simulateApiWith(['roles.manage', 'security.manage']);
    render(<Admin apiUrl={API} token="token" />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Papéis', 'Segurança']);
  });

  it('sem nenhuma área permitida, mostra o estado sem acesso', async () => {
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    render(<Admin apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Administração')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.calls()).toEqual(['GET /v1/session']);
  });

  it('dentro de um hospedeiro com react-router, monta e não mexe no roteador dele', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup({ delay: null });
    function HostAppLocation() {
      const local = useLocation();
      return <p>Hospedeiro em {local.pathname}</p>;
    }
    render(
      <MemoryRouter initialEntries={['/configuracoes/fluxo']}>
        <HostAppLocation />
        <Routes>
          <Route path="/configuracoes/*" element={<Admin apiUrl={API} token="token" />} />
        </Routes>
      </MemoryRouter>,
    );

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    await user.click(within(tabs).getByRole('tab', { name: 'Papéis' }));
    expect(within(tabs).getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Hospedeiro em /configuracoes/fluxo')).toBeInTheDocument();
  });
});

describe('várias telas avulsas na mesma página', () => {
  it('cada uma tem a sua raiz, com o seu tema', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    render(
      <>
        <Home apiUrl={API} token="token" theme="light" />
        <Audit apiUrl={API} token="token" theme="dark" />
      </>,
    );

    const homeHeading = await screen.findByRole('heading', { level: 1, name: 'Início' });
    const accessEvents = await screen.findByRole('heading', { level: 2, name: 'Acessos' });
    expect(rootOf(homeHeading)).toHaveAttribute('data-theme', 'light');
    expect(rootOf(accessEvents)).toHaveAttribute('data-theme', 'dark');
    expect(rootOf(homeHeading)).not.toBe(rootOf(accessEvents));
  });
});

describe('Executions avulso e Workflows com execuções', () => {
  const WORKFLOW = {
    id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
    name: 'Pontuação de exemplo',
    objective: null,
    kind: 'batch',
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' },
    draft: { revision: 3, updated_at: '2026-11-18T14:05:00Z', updated_by: { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' }, node_count: 3, problem_count: 0 },
    created_at: '2026-11-18T13:40:00Z',
    created_by: { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' },
  };

  it('<Executions> mostra a lista sem tocar a URL do hospedeiro', async () => {
    simulateApi({ 'GET /v1/session': json(sessionWith(['executions.view'])), 'GET /v1/executions': json({ items: [], next_cursor: null }) });
    render(<Executions apiUrl={API} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(pageUrl()).toBe(HOST_APP_URL);
    withoutModuleNavigation();
  });

  it('<Executions> sem executions.view mostra o estado sem acesso', async () => {
    simulateApi({ 'GET /v1/session': json(sessionWith(['workflows.view'])) });
    render(<Executions apiUrl={API} />);
    expect(await screen.findByText('Você não tem acesso às Execuções')).toBeInTheDocument();
  });

  it('<Workflows> com executions.trigger mostra Executar lote e Ver execuções na Visão geral', async () => {
    simulateApi({
      'GET /v1/session': json(sessionWith(['workflows.view', 'executions.view', 'executions.trigger'])),
      'GET /v1/workflows': json({ items: [WORKFLOW], next_cursor: null }),
      [`GET /v1/workflows/${WORKFLOW.id}`]: json(WORKFLOW),
    });
    const user = userEvent.setup({ delay: null });
    render(<Workflows apiUrl={API} />);
    await user.click(await screen.findByText(WORKFLOW.name));
    expect(await screen.findByRole('button', { name: 'Executar lote' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(pageUrl()).toBe(HOST_APP_URL);
  });

  describe('Executar lote no <Workflows> avulso', () => {
    const EXECUTION = {
      id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e',
      workflow_id: WORKFLOW.id,
      workflow_name: WORKFLOW.name,
      draft_revision: 3,
      workflow_version: null,
      status: 'pending',
      abort_reason: null,
      cancel_requested_at: null,
      next_retry_at: null,
      parameters: {},
      now: '2026-11-21T15:00:00Z',
      trace_level: 'standard',
      error_limit_percent: '5',
      triggered_by: WORKFLOW.created_by,
      created_at: '2026-11-21T15:00:00Z',
      started_at: null,
      data_read_at: null,
      finished_at: null,
      total_records: null,
      progress: { chunks_done: 0, records_done: 0 },
      totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
      error_groups: [],
      output: { available: false, expires_at: null, rows: null },
    };
    const DRAFT = {
      workflow_id: WORKFLOW.id,
      revision: 3,
      definition: {
        schema_version: 3,
        kind: 'batch',
        settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
        parameters: [],
        root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
      },
      problems: [],
      symbols: [],
      dependencies: [],
      order: [],
      groups: [],
      updated_at: '2026-11-18T14:05:00Z',
      updated_by: WORKFLOW.created_by,
    };

    function simulateBatchApi(permissions: string[]) {
      return simulateApi({
        'GET /v1/session': json(sessionWith(permissions)),
        'GET /v1/workflows': json({ items: [WORKFLOW], next_cursor: null }),
        [`GET /v1/workflows/${WORKFLOW.id}`]: json(WORKFLOW),
        [`GET /v1/workflows/${WORKFLOW.id}/draft`]: json(DRAFT),
        [`POST /v1/workflows/${WORKFLOW.id}/executions`]: json(EXECUTION, 201),
        'GET /v1/executions': json({ items: [EXECUTION], next_cursor: null }),
        [`GET /v1/executions/${EXECUTION.id}`]: json(EXECUTION),
      });
    }

    async function triggerFromOverview(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByText(WORKFLOW.name));
      await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });
      await user.click(screen.getByRole('button', { name: 'Executar lote' }));
      const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
      await user.click(await within(dialog).findByRole('button', { name: 'Executar lote' }));
    }

    it('Executar lote abre o painel e o Voltar leva de volta à Visão geral do workflow, não à lista do cliente', async () => {
      simulateBatchApi(['workflows.view', 'executions.view', 'executions.trigger']);
      const user = userEvent.setup({ delay: null });
      render(<Workflows apiUrl={API} />);

      await triggerFromOverview(user);
      await user.click(await screen.findByRole('button', { name: 'Voltar para a visão geral' }));

      expect(await screen.findByRole('heading', { level: 1, name: WORKFLOW.name })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver execuções' })).toBeInTheDocument();
      expect(pageUrl()).toBe(HOST_APP_URL);
    });

    it('o painel aberto pela lista do workflow volta para essa lista', async () => {
      simulateBatchApi(['workflows.view', 'executions.view']);
      const user = userEvent.setup({ delay: null });
      render(<Workflows apiUrl={API} />);

      await user.click(await screen.findByText(WORKFLOW.name));
      await user.click(await screen.findByRole('button', { name: 'Ver execuções' }));
      await user.click(await screen.findByRole('button', { name: /execução 7b8c9d0e/ }));
      await user.click(await screen.findByRole('button', { name: 'Voltar para as execuções do workflow' }));

      expect(await screen.findByRole('button', { name: 'Voltar para a visão geral' })).toBeInTheDocument();
    });

    it('sem executions.view, o lote é criado e a pessoa fica na Visão geral, sem Ver execuções e sem o painel', async () => {
      const api = simulateBatchApi(['workflows.view', 'executions.trigger']);
      const user = userEvent.setup({ delay: null });
      render(<Workflows apiUrl={API} />);

      await triggerFromOverview(user);

      expect(await screen.findByText(/O lote foi criado/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: WORKFLOW.name })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ver execuções' })).not.toBeInTheDocument();
      expect(api.calls().filter((call) => call.startsWith('GET /v1/executions'))).toHaveLength(0);
    });
  });
});
