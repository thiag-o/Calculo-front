import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../api';
import { FluxoRoot } from '../design-system';
import { Home, type HomeScreenProps } from '.';

// Browser features jsdom lacks and Radix uses (the "Novo workflow" dialog).
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
const prototype = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototype.hasPointerCapture ??= () => false;
prototype.setPointerCapture ??= () => {};
prototype.releasePointerCapture ??= () => {};
prototype.scrollIntoView ??= () => {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TENANT = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
const ANA = { id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c', name: 'Ana Souza' };

function sessionOf(permissions: string[]): Schemas['Session'] {
  return { user: { ...ANA, email: 'ana@exemplo.com' }, tenants: [TENANT], current_tenant: TENANT, permissions };
}

const EDITOR = ['workflows.view', 'workflows.edit'];
const VIEWER = ['workflows.view'];

function workflow(name: string, id: string, problems = 0, blocks = 3): Schemas['WorkflowSummary'] {
  const when = '2026-11-18T14:05:00Z';
  return {
    id,
    name,
    objective: null,
    kind: 'batch',
    updated_at: when,
    updated_by: ANA,
    draft: { revision: 2, updated_at: when, updated_by: ANA, node_count: blocks, problem_count: problems },
  };
}

const SCORING = workflow('Pontuação de exemplo', '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f');
const BONUS = workflow('Bônus de metas', '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b', 2, 1);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function problem(status: number, code: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: 'Texto do servidor.', code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

type Routes = Record<string, (request: Request) => Response | Promise<Response>>;

function simulate(permissions: string[], routes: Routes = {}) {
  const calls: Request[] = [];
  const all: Routes = { 'GET /v1/session': () => json(sessionOf(permissions)), ...routes };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      calls.push(request.clone());
      const route = `${request.method} ${new URL(request.url).pathname}`;
      return all[route]?.(request) ?? problem(404, 'not_found');
    }),
  );
  return { calls: (route: string) => calls.filter((request) => `${request.method} ${new URL(request.url).pathname}` === route) };
}

function open(props: HomeScreenProps = {}) {
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl="https://api.teste">
        <QueryClientProvider client={queryClient}>
          <Home {...props} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user };
}

const recent = () => screen.findByRole('region', { name: 'Workflows recentes' });

describe('Início, workflows recentes', () => {
  it('mostra os workflows recentes com os dados reais, pedindo só 6', async () => {
    const api = simulate(EDITOR, { 'GET /v1/workflows': () => json({ items: [SCORING, BONUS], next_cursor: null }) });
    open();

    const section = await recent();
    expect(await within(section).findByText('Pontuação de exemplo')).toBeInTheDocument();
    expect(within(section).getByText('Bônus de metas')).toBeInTheDocument();
    expect(within(section).getByText('Rascunho · 3 blocos')).toBeInTheDocument();
    expect(within(section).getByText('Rascunho · 1 bloco')).toBeInTheDocument();
    expect(within(section).getByText('2 problemas')).toBeInTheDocument();
    expect(within(section).getAllByText(/editado por Ana Souza/)).toHaveLength(2);
    expect(screen.getByText('2 workflows recentes')).toBeInTheDocument();
    expect(new URL(api.calls('GET /v1/workflows')[0]!.url).searchParams.get('limit')).toBe('6');
  });

  it('o nome abre a Visão geral e "Ver todos" abre a lista', async () => {
    simulate(EDITOR, { 'GET /v1/workflows': () => json({ items: [SCORING], next_cursor: null }) });
    const onOpenWorkflow = vi.fn();
    const onOpenWorkflows = vi.fn();
    const { user } = open({ onOpenWorkflow, onOpenWorkflows });

    await user.click(await screen.findByRole('button', { name: 'Pontuação de exemplo' }));
    expect(onOpenWorkflow).toHaveBeenCalledWith(SCORING.id);
    await user.click(screen.getByRole('button', { name: 'Ver todos os workflows' }));
    expect(onOpenWorkflows).toHaveBeenCalledTimes(1);
  });

  it('sem workflows, mostra o estado vazio com Novo workflow', async () => {
    simulate(EDITOR, { 'GET /v1/workflows': () => json({ items: [], next_cursor: null }) });
    open();

    const section = await recent();
    expect(await within(section).findByText('Nenhum workflow ainda')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Novo workflow' })).toBeEnabled();
  });

  it('enquanto carrega, mostra o esqueleto anunciado', async () => {
    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => (release = resolve));
    simulate(EDITOR, { 'GET /v1/workflows': () => pending });
    open();
    expect(await screen.findByText('Carregando workflows recentes')).toBeInTheDocument();
    release(json({ items: [SCORING], next_cursor: null }));
    expect(await screen.findByText('Pontuação de exemplo')).toBeInTheDocument();
  });

  it('com a lista falhando, diz o que houve e oferece Tentar de novo', async () => {
    let fails = true;
    simulate(EDITOR, {
      'GET /v1/workflows': () => (fails ? problem(500, 'internal_error') : json({ items: [SCORING], next_cursor: null })),
    });
    const { user } = open();

    expect(await screen.findByText('Não foi possível carregar os workflows')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Pontuação de exemplo')).toBeInTheDocument();
  });

  it('sem permissão na lista, diz isso e não oferece Tentar de novo', async () => {
    simulate(VIEWER, { 'GET /v1/workflows': () => problem(403, 'no_permission') });
    open();
    expect(await screen.findByText('Você não tem permissão para ver os workflows deste cliente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

describe('Início, por permissão', () => {
  it('quem só vê workflows tem Novo workflow desabilitado com o motivo', async () => {
    simulate(VIEWER, { 'GET /v1/workflows': () => json({ items: [SCORING], next_cursor: null }) });
    open();

    await screen.findByText('Pontuação de exemplo');
    const button = screen.getByRole('button', { name: 'Novo workflow' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Você não tem permissão para criar workflows');
  });

  it('quem não tem workflows.view não vê a seção nem Novo workflow, e a API não é consultada', async () => {
    const api = simulate(['connections.view']);
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Execuções recentes' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Workflows recentes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo workflow' })).not.toBeInTheDocument();
    expect(api.calls('GET /v1/workflows')).toHaveLength(0);
  });

  it('mantém "Precisa de você" e "Execuções recentes" com os estados vazios', async () => {
    simulate(EDITOR, { 'GET /v1/workflows': () => json({ items: [SCORING], next_cursor: null }) });
    open();

    const needs = await screen.findByRole('region', { name: 'Precisa de você' });
    expect(within(needs).getByText('Nada precisa de você agora')).toBeInTheDocument();
    const executions = screen.getByRole('region', { name: 'Execuções recentes' });
    expect(within(executions).getByText('Nenhuma execução ainda')).toBeInTheDocument();
    const run = within(executions).getByRole('button', { name: 'Executar lote' });
    expect(run).toHaveAttribute('aria-disabled', 'true');
    expect(run).toHaveAccessibleDescription('Disponível quando houver um workflow publicado');
  });
});

describe('Início, Novo workflow', () => {
  it('cria o workflow, abre a Visão geral dele e atualiza a lista', async () => {
    let items = [SCORING];
    const created = { ...BONUS, created_at: BONUS.updated_at, created_by: ANA };
    const api = simulate(EDITOR, {
      'GET /v1/workflows': () => json({ items, next_cursor: null }),
      'POST /v1/workflows': () => {
        items = [BONUS, SCORING];
        return json(created, 201);
      },
    });
    const onOpenWorkflow = vi.fn();
    const { user } = open({ onOpenWorkflow });

    await screen.findByText('Pontuação de exemplo');
    await user.click(screen.getByRole('button', { name: 'Novo workflow' }));
    await user.type(await screen.findByRole('textbox', { name: /Nome/ }), 'Bônus de metas');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() => expect(onOpenWorkflow).toHaveBeenCalledWith(BONUS.id));
    expect(api.calls('POST /v1/workflows')).toHaveLength(1);
    expect(await screen.findByText('Bônus de metas')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
