import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../api';
import { FluxoCalculo, Workflows, type FluxoCalculoProps } from '.';
import {
  API,
  ADMIN_PERMISSIONS,
  AUDITOR_PERMISSIONS,
  CONFIGURATOR_PERMISSIONS,
  INTEGRATOR_PERMISSIONS,
  json,
  BRANCH_TENANT,
  sessionWith,
  simulateApi,
  simulateWidth,
} from './module.test-support';

// The editor itself has its own tests (editor/Editor.test.tsx); here it is only the screen the module puts on the
// `/workflows/:id/editor` route, so the test sees where it sits (full screen, no sidebar and no tabs) and what it receives.
vi.mock('../editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../editor')>()),
  Editor: ({ workflowId, onBack }: { workflowId: string; onBack: () => void }) => (
    <section aria-label="Editor de teste">
      <p>Editando {workflowId}</p>
      <button type="button" onClick={onBack}>
        Voltar para a visão geral
      </button>
    </section>
  ),
}));

// The Workflows screen inside <FluxoCalculo>, by role (E4-19, E4-20, E4-25): the Configurador creates and edits; the Operador, the
// Auditor and the Aprovador see the list, the Overview and the editor; the Integrador of this plan sees no Workflows.

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };
const summary = (id: string, name: string, nodes: number): Schemas['WorkflowSummary'] => ({
  id,
  name,
  objective: null,
  kind: 'batch',
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
  draft: { revision: 3, updated_at: '2026-11-18T14:05:00Z', updated_by: BRUNO, node_count: nodes, problem_count: 0 },
});
const SCORING = summary('3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f', 'Pontuação de exemplo', 3);
const BONUS = summary('0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b', 'Bônus de metas', 1);
const WORKFLOW: Schemas['Workflow'] = { ...SCORING, created_at: '2026-11-18T13:40:00Z', created_by: BRUNO };

const OPERATOR_PERMISSIONS = ['workflows.view', 'executions.view'];
const APPROVER_PERMISSIONS = ['workflows.view', 'versions.approve', 'simulations.run', 'executions.view'];
const WITHOUT_WORKFLOWS = INTEGRATOR_PERMISSIONS.filter((code) => code !== 'workflows.view');

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function simulateApiWith(permissions: string[]) {
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/workflows': json({ items: [SCORING, BONUS], next_cursor: null }),
    [`GET /v1/workflows/${SCORING.id}`]: json(WORKFLOW),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup({ delay: null });
  render(<FluxoCalculo apiUrl={API} {...props} />);
  return { user };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const menuLinks = () => within(mainNavigation()).getAllByRole('link').map((link) => link.textContent);
const tabs = () => screen.getByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
const openList = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(mainNavigation()).getByRole('link', { name: 'Workflows' }));

describe('Workflows no casca, por papel', () => {
  it('o Configurador abre a lista pelo menu, cria workflows e chega à Visão geral e ao editor em tela cheia', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await openList(user);
    expect(await screen.findByRole('button', { name: 'Novo workflow' })).toBeEnabled();
    expect(window.location.pathname).toBe('/workflows');
    expect(within(mainNavigation()).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');

    await user.click(await screen.findByText(SCORING.name));
    expect(await screen.findByRole('heading', { level: 1, name: SCORING.name })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${SCORING.id}`);

    await user.click(screen.getByRole('button', { name: 'Abrir editor' }));
    expect(await screen.findByRole('region', { name: 'Editor de teste' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${SCORING.id}/editor`);
    // The editor takes the whole module: no sidebar.
    expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByText(`Editando ${SCORING.id}`));

    await user.click(screen.getByRole('button', { name: 'Voltar para a visão geral' }));
    expect(await screen.findByRole('heading', { level: 1, name: SCORING.name })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${SCORING.id}`);
  });

  it('com um workflow aberto, o seletor mostra tenant › workflow e o menu tem só a Visão geral', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}`);
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });

    await screen.findByRole('heading', { level: 1, name: SCORING.name });
    expect(menuLinks()).toEqual(['Visão geral']);
    expect(within(mainNavigation()).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' })).toBeInTheDocument();

    const context = await screen.findByRole('button', { name: `Trocar workflow. Atual: ${SCORING.name}` });
    await user.click(context);
    expect(await screen.findByRole('menuitem', { name: BONUS.name })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: SCORING.name })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Todos os workflows' }));
    await waitFor(() => expect(window.location.pathname).toBe('/workflows'));
    expect(await screen.findByRole('button', { name: 'Novo workflow' })).toBeInTheDocument();
    expect(menuLinks()).toContain('Workflows');
  });

  it('trocar de cliente com um workflow aberto leva à lista do cliente novo, sem mostrar o workflow do antigo', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}`);
    document.cookie = 'fc_csrf=csrf-de-teste; path=/';
    const branch = { ...sessionWith(CONFIGURATOR_PERMISSIONS), current_tenant: BRANCH_TENANT };
    const api = simulateApi({
      'GET /v1/session': json(sessionWith(CONFIGURATOR_PERMISSIONS)),
      'PUT /v1/session/tenant': json(branch),
      'GET /v1/workflows': json({ items: [BONUS], next_cursor: null }),
      [`GET /v1/workflows/${SCORING.id}`]: json(WORKFLOW),
    });
    const { user } = renderScreen({ navigation: 'url' });
    await screen.findByRole('button', { name: `Trocar workflow. Atual: ${SCORING.name}` });

    await user.click(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
    await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.name }));

    await waitFor(() => expect(window.location.pathname).toBe('/workflows'));
    expect(await screen.findByRole('button', { name: 'Novo workflow' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Trocar workflow/ })).not.toBeInTheDocument();
    expect(menuLinks()).toContain('Workflows');
    // The only request for the old workflow after the switch is the reset of the query that was on screen (session
    // vertical); the screen is not mounted again under the old URL, which would ask for it a second time.
    const calls = api.calls();
    const afterSwitch = calls.slice(calls.indexOf('PUT /v1/session/tenant') + 1);
    expect(afterSwitch.filter((call) => call === `GET /v1/workflows/${SCORING.id}`).length).toBeLessThanOrEqual(1);
    document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('trocar de cliente sem workflows.view no cliente novo leva ao Início', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}`);
    document.cookie = 'fc_csrf=csrf-de-teste; path=/';
    const branch = { ...sessionWith(WITHOUT_WORKFLOWS), current_tenant: BRANCH_TENANT };
    simulateApi({
      'GET /v1/session': json(sessionWith(CONFIGURATOR_PERMISSIONS)),
      'PUT /v1/session/tenant': json(branch),
      'GET /v1/workflows': json({ items: [BONUS], next_cursor: null }),
      [`GET /v1/workflows/${SCORING.id}`]: json(WORKFLOW),
    });
    const { user } = renderScreen({ navigation: 'url' });
    await screen.findByRole('button', { name: `Trocar workflow. Atual: ${SCORING.name}` });

    await user.click(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
    await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.name }));

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    await waitFor(() =>
      expect(within(mainNavigation()).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page'),
    );
    document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('com o menu compacto e um workflow aberto, o botão Trocar cliente continua visível e abre o menu', async () => {
    simulateWidth(1000);
    window.history.replaceState(null, '', `/workflows/${SCORING.id}`);
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await screen.findByRole('heading', { level: 1, name: SCORING.name });

    await user.click(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
    expect(await screen.findByRole('menuitem', { name: BRANCH_TENANT.name })).toBeInTheDocument();
  });

  it('o menu do workflow substitui o do cliente, e o nome do cliente leva ao Início, também pelo teclado', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}`);
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await screen.findByRole('heading', { level: 1, name: SCORING.name });
    expect(menuLinks()).toEqual(['Visão geral']);

    const home = screen.getByRole('link', { name: 'Início de Matriz' });
    home.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(menuLinks()).toContain('Workflows');
    expect(screen.queryByRole('link', { name: 'Início de Matriz' })).not.toBeInTheDocument();
  });

  it('o Operador vê a lista, a Visão geral e o editor, sem criar workflows', async () => {
    simulateApiWith(OPERATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'memory' });
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await openList(user);
    expect(await screen.findByText(SCORING.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo workflow' })).not.toBeInTheDocument();

    await user.click(screen.getByText(SCORING.name));
    expect(await screen.findByRole('heading', { level: 1, name: SCORING.name })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir editor' }));
    expect(await screen.findByRole('region', { name: 'Editor de teste' })).toBeInTheDocument();
  });

  it('o Auditor vê a lista e a Visão geral, sem criar workflows', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'memory' });
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await openList(user);
    expect(await screen.findByText(BONUS.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo workflow' })).not.toBeInTheDocument();
    await user.click(screen.getByText(SCORING.name));
    expect(await screen.findByRole('heading', { level: 1, name: SCORING.name })).toBeInTheDocument();
  });

  it('o Aprovador vê Workflows e o endereço do editor abre direto nele', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}/editor`);
    simulateApiWith(APPROVER_PERMISSIONS);
    renderScreen({ navigation: 'url' });

    expect(await screen.findByRole('region', { name: 'Editor de teste' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
  });

  it('o Integrador não vê Workflows, e as rotas de Workflows não abrem', async () => {
    window.history.replaceState(null, '', `/workflows/${SCORING.id}/editor`);
    const api = simulateApiWith(WITHOUT_WORKFLOWS);
    renderScreen({ navigation: 'url' });

    await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(menuLinks()).not.toContain('Workflows');
    expect(screen.queryByRole('region', { name: 'Editor de teste' })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(api.calls()).not.toContain('GET /v1/workflows');
  });
});

describe('Workflows no modo incorporado', () => {
  it('é uma aba, e o editor ocupa a área do módulo, sem as abas', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ token: 'token' });
    await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(within(tabs()).getAllByRole('tab').map((tab) => tab.textContent)).toContain('Workflows');

    await user.click(within(tabs()).getByRole('tab', { name: 'Workflows' }));
    await user.click(await screen.findByText(SCORING.name));
    await user.click(await screen.findByRole('button', { name: 'Abrir editor' }));

    const editor = await screen.findByRole('region', { name: 'Editor de teste' });
    expect(screen.getByRole('region', { name: 'Fluxo de Cálculo' })).toContainElement(editor);
    expect(screen.queryByRole('tablist', { name: 'Telas do Fluxo de Cálculo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('a propriedade screen abre direto em Workflows', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'workflows' });

    expect(await screen.findByRole('button', { name: 'Novo workflow' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('tab', { name: 'Workflows' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('<Workflows> avulso', () => {
  it('mostra a lista sem menu nem abas do módulo e leva ao editor dentro da própria tela', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    const user = userEvent.setup({ delay: null });
    render(<Workflows apiUrl={API} />);

    expect(await screen.findByText(SCORING.name)).toBeInTheDocument();
    // The region of the module wraps the screen, which has its own region with the same name.
    expect(screen.getAllByRole('region', { name: 'Workflows' })[0]).toHaveClass('fc-module-content');
    expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();

    await user.click(screen.getByText(SCORING.name));
    await user.click(await screen.findByRole('button', { name: 'Abrir editor' }));
    expect(await screen.findByText(`Editando ${SCORING.id}`)).toBeInTheDocument();
  });

  it('sem workflows.view, mostra o estado de falta de acesso e não chama a lista', async () => {
    const api = simulateApiWith(WITHOUT_WORKFLOWS);
    render(<Workflows apiUrl={API} />);

    expect(await screen.findByText('Você não tem acesso a Workflows')).toBeInTheDocument();
    expect(api.calls()).not.toContain('GET /v1/workflows');
  });
});
