import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPERATOR_PERMISSIONS,
  OTHER_WORKFLOW_ID,
  VIEWER_PERMISSIONS,
  WORKFLOW_ID,
  completed,
  execution,
  json,
  page,
  problem,
  renderScreen,
  savedDraft,
  simulateApi,
  type SimulatedApi,
} from '../api/executions.test-support';
import { ExecutionList } from '.';

const LIST = 'GET /v1/executions';
const WORKFLOWS = 'GET /v1/workflows';

let api: SimulatedApi;

function workflowsPage() {
  return json({
    items: [
      { id: WORKFLOW_ID, name: 'Pontuação de exemplo' },
      { id: OTHER_WORKFLOW_ID, name: 'Bônus de metas' },
    ].map((workflow) => ({
      ...workflow,
      objective: null,
      kind: 'batch',
      updated_at: '2026-11-18T14:05:00Z',
      updated_by: { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' },
      draft: {
        revision: 5,
        updated_at: '2026-11-18T14:05:00Z',
        updated_by: { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' },
        node_count: 3,
        problem_count: 0,
      },
    })),
    next_cursor: null,
  });
}

function prepare(permissions: readonly string[] = OPERATOR_PERMISSIONS) {
  api = simulateApi(permissions);
  api.respond(WORKFLOWS, workflowsPage());
}

beforeEach(() => prepare());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Local time (of whoever runs the test), as ISO/UTC like the API sends. */
function localIso(day: number, hour: number, minute: number, second = 0): string {
  return new Date(2026, 10, day, hour, minute, second).toISOString();
}

const listQueries = () => api.callsTo(LIST).map((request) => new URL(request.url).searchParams);
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const rowOf = (text: string) => screen.getAllByText(text)[0]!.closest('tr')!;

async function choose(user: UserEvent, field: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** The (decorative) dot color of a status word. */
function dotOf(word: HTMLElement): string | undefined {
  const status = word.closest('.fc-status')!;
  return Array.from(status.classList).find((cssClass) => cssClass.startsWith('fc-status-') && cssClass !== 'fc-status-pulsing');
}

describe('Execuções: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(LIST, new Promise<Response>((resolve) => (release = resolve)));
    renderScreen(<ExecutionList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(await screen.findByText('Carregando execuções do tenant')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');

    release(page([completed()]));
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
  });

  it('mostra cada status com ponto e palavra, na cor do estilos', async () => {
    const statuses = [
      ['pending', 'Na fila', 'fc-status-gray'],
      ['loading', 'Calculando', 'fc-status-amber'],
      ['calculating', 'Calculando', 'fc-status-amber'],
      ['delivering', 'Calculando', 'fc-status-amber'],
      ['awaiting_source', 'Aguardando fonte', 'fc-status-amber'],
      ['completed', 'Entregue', 'fc-status-green'],
      ['completed_with_errors', 'Com erros', 'fc-status-red'],
      ['aborted', 'Abortada', 'fc-status-red'],
      ['cancelled', 'Cancelada', 'fc-status-gray'],
    ] as const;
    api.respond(LIST, page(statuses.map(([status]) => execution({ status, workflow_name: `Workflow ${status}` }))));
    renderScreen(<ExecutionList />);

    await screen.findByText('Workflow pending');
    for (const [status, label, dot] of statuses) {
      const word = within(rowOf(`Workflow ${status}`)).getByText(label);
      expect(dotOf(word)).toBe(dot);
      // The dot pulses only while "Na fila" or "Calculando" (estilos.md §5).
      const pulsing = word.closest('.fc-status')!.classList.contains('fc-status-pulsing');
      expect(pulsing).toBe(label === 'Na fila' || label === 'Calculando');
    }
  });

  it('mostra workflow, id curto, quem disparou, início, duração, registros e parâmetros', async () => {
    const done = completed({
      id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01',
      started_at: localIso(21, 15, 0, 5),
      finished_at: localIso(21, 15, 4, 17),
      totals: { read: 1192, ok: 1160, ok_with_warnings: 20, error: 12, ignored: 0, filtered: 0 },
      parameters: { periodo: { start: '2026-10-01', end: '2026-10-31' }, categorias: ['A', 'B', 'C', 'D'], meta_minima: '1500.00', ativo: true },
    });
    const queued = execution({ workflow_name: 'Bônus de metas', parameters: {} });
    api.respond(LIST, page([queued, done]));
    renderScreen(<ExecutionList />);

    await screen.findByText('2 execuções');
    const row = rowOf('Pontuação de exemplo');
    expect(within(row).getByText('6a7b8c9d')).toBeInTheDocument();
    expect(within(row).getByText('Ana Souza')).toBeInTheDocument();
    expect(within(row).getByText('21/11/2026 às 15:00')).toBeInTheDocument();
    expect(within(row).getByText('4m 12s')).toBeInTheDocument();
    expect(within(row).getByText('1.180 ok · 12 com erro')).toBeInTheDocument();
    expect(
      within(row).getByText('periodo: 01/10/2026 a 31/10/2026 · categorias: A, B, C +1 · meta_minima: 1.500,00 · ativo: Verdadeiro'),
    ).toBeInTheDocument();

    // In the queue: no start, duration, records nor parameters ("—").
    const queuedRow = rowOf('Bônus de metas');
    expect(within(queuedRow).getAllByText('—')).toHaveLength(4);
    expect(rows()).toHaveLength(2);
  });

  it('abre o painel da execução pelo nome do workflow', async () => {
    const onOpenExecution = vi.fn();
    const done = completed({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01' });
    api.respond(LIST, page([done]));
    const { user } = renderScreen(<ExecutionList onOpenExecution={onOpenExecution} />);

    await user.click(await screen.findByRole('button', { name: 'Pontuação de exemplo, execução 6a7b8c9d' }));
    expect(onOpenExecution).toHaveBeenCalledWith(done.id);
  });

  it('sem onOpenExecution, o nome do workflow é texto', async () => {
    api.respond(LIST, page([completed()]));
    renderScreen(<ExecutionList />);

    expect(await screen.findByText('Pontuação de exemplo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pontuação de exemplo/ })).not.toBeInTheDocument();
  });

  it('mostra o vazio quando o tenant não tem execuções', async () => {
    api.respond(LIST, page([]));
    renderScreen(<ExecutionList />);

    expect(await screen.findByText('Nenhuma execução ainda')).toBeInTheDocument();
    expect(screen.getByText('As execuções em lote dos workflows do tenant aparecem aqui.')).toBeInTheDocument();
  });

  it('abaixo de 1180 px de largura do módulo, esconde a coluna de registros', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return { width: this.classList.contains('fc-root') ? 900 : 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} };
    });
    api.respond(LIST, page([completed()]));
    renderScreen(<ExecutionList />);

    await screen.findByText('Entregue');
    expect(screen.queryByRole('columnheader', { name: 'Registros' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Parâmetros' })).toBeInTheDocument();
  });
});

describe('Execuções: filtros', () => {
  it('filtra por status: "Calculando" pede as três fases', async () => {
    api.respond(LIST, page([completed()]), page([execution({ status: 'calculating', workflow_name: 'Bônus de metas' })]));
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Entregue');
    expect(listQueries()[0]!.getAll('status')).toEqual([]);

    await choose(user, 'Status', 'Calculando');

    expect(await screen.findByText('Bônus de metas')).toBeInTheDocument();
    expect(listQueries().at(-1)!.getAll('status')).toEqual(['calculating', 'delivering', 'loading']);
    expect(screen.getByText('1 execução com esses filtros')).toBeInTheDocument();
  });

  it('enquanto o filtro novo carrega, as linhas anteriores ficam marcadas como ocupadas', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(LIST, page([completed()]), new Promise<Response>((resolve) => (release = resolve)));
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Entregue');
    const results = () => screen.getByRole('table').closest('.fc-executions-results');
    expect(results()).not.toHaveAttribute('aria-busy');

    await choose(user, 'Status', 'Calculando');

    await waitFor(() => expect(results()).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByText('Entregue')).toBeInTheDocument();

    release(page([execution({ status: 'calculating', workflow_name: 'Bônus de metas' })]));
    expect(await screen.findByText('Bônus de metas')).toBeInTheDocument();
    expect(results()).not.toHaveAttribute('aria-busy');
  });

  it('filtra pelo workflow e limpa os filtros a partir do vazio', async () => {
    api.respond(LIST, (request) => {
      const query = new URL(request.url).searchParams;
      if (query.get('workflow_id') === OTHER_WORKFLOW_ID) return page([]);
      return page([completed()]);
    });
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Entregue');

    await choose(user, 'Workflow', 'Bônus de metas');

    expect(await screen.findByText('Nenhuma execução com esses filtros')).toBeInTheDocument();
    expect(listQueries().at(-1)!.get('workflow_id')).toBe(OTHER_WORKFLOW_ID);

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(screen.getByText('Entregue')).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Workflow' })).toHaveTextContent('Todos os workflows');
  });

  it('a lista do workflow tem o filtro do workflow fixo e escondido', async () => {
    api.respond(LIST, page([completed()]));
    renderScreen(<ExecutionList workflowId={WORKFLOW_ID} />);

    await screen.findByText('Entregue');
    expect(listQueries()[0]!.get('workflow_id')).toBe(WORKFLOW_ID);
    expect(screen.queryByRole('combobox', { name: 'Workflow' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    // The workflow options are not read in the list of one workflow.
    expect(api.callsTo(WORKFLOWS)).toHaveLength(0);
  });

  it('filtro recusado pela API: oferece limpar os filtros', async () => {
    api.respond(LIST, page([completed()]), problem(422, 'invalid_data', { fields: { status: 'Use um status válido.' } }));
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Entregue');

    await choose(user, 'Status', 'Abortada');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A API recusou os filtros escolhidos');
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });
});

describe('Execuções: paginação', () => {
  it('"Carregar mais execuções" pede a página seguinte pelo cursor', async () => {
    api.respond(
      LIST,
      page([completed({ workflow_name: 'Primeira' })], 'cursor-2'),
      page([completed({ workflow_name: 'Segunda' })]),
    );
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Primeira');
    expect(screen.getByText('Mais de 1 execuções')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carregar mais execuções' }));

    expect(await screen.findByText('Segunda')).toBeInTheDocument();
    expect(listQueries().at(-1)!.get('cursor')).toBe('cursor-2');
    expect(rows()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Carregar mais execuções' })).not.toBeInTheDocument();
    expect(screen.getByText('2 execuções')).toBeInTheDocument();
  });

  it('cursor inválido: recarrega a lista desde o início', async () => {
    api.respond(LIST, page([completed({ workflow_name: 'Primeira' })], 'cursor-2'), problem(422, 'invalid_cursor'), page([completed({ workflow_name: 'Primeira' })]));
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Primeira');

    await user.click(screen.getByRole('button', { name: 'Carregar mais execuções' }));
    expect(await screen.findByText('Não foi possível carregar mais execuções')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível continuar de onde a lista parou/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recarregar lista' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(listQueries().at(-1)!.get('cursor')).toBeNull();
  });
});

describe('Execuções: atualização', () => {
  it('pede a lista de novo a cada 5 s enquanto há execução em andamento, e para no estado final', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const running = execution({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c99', status: 'calculating', started_at: localIso(21, 15, 0) });
    api.respond(
      LIST,
      page([running]),
      page([{ ...running, progress: { chunks_done: 1, records_done: 500 } }]),
      page([completed({ id: running.id })]),
    );
    renderScreen(<ExecutionList />);
    await screen.findByText('Calculando');
    expect(api.callsTo(LIST)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4900);
    });
    expect(api.callsTo(LIST)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
    expect(api.callsTo(LIST)).toHaveLength(3);

    // Everything on screen is final: no more requests.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.callsTo(LIST)).toHaveLength(3);
  });

  it('não pede de novo quando todas as execuções da página já terminaram', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api.respond(LIST, page([completed(), execution({ status: 'aborted', workflow_name: 'Bônus de metas' })]));
    renderScreen(<ExecutionList />);
    await screen.findByText('Abortada');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(api.callsTo(LIST)).toHaveLength(1);
  });

  const failures: [string, () => Response | Promise<Response>, RegExp][] = [
    ['403 no_permission', () => problem(403, 'no_permission'), /Você não tem permissão para ver as execuções neste tenant/],
    ['404 not_found', () => problem(404, 'not_found'), /Texto do servidor para not_found/],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch')), /Não foi possível falar com o servidor/],
  ];

  it.each(failures)('%s no meio da atualização: avisa, mantém a lista e para de pedir', async (_name, failure, message) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const running = execution({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c99', status: 'calculating', started_at: localIso(21, 15, 0) });
    api.respond(LIST, page([running]), failure, page([completed({ id: running.id })]));
    const { user } = renderScreen(<ExecutionList />);
    await screen.findByText('Calculando');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(await screen.findByText('Não foi possível atualizar a lista')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    // The last list stays on screen.
    expect(screen.getByText('Calculando')).toBeInTheDocument();
    expect(api.callsTo(LIST)).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.callsTo(LIST)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível atualizar a lista')).not.toBeInTheDocument();
  });
});

describe('Execuções: erros', () => {
  it('sem permissão: diz o que fazer, sem "Tentar de novo"', async () => {
    api.respond(LIST, problem(403, 'no_permission'));
    renderScreen(<ExecutionList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para ver as execuções neste tenant');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('falha de rede: "Tentar de novo" pede a lista outra vez', async () => {
    api.respond(LIST, problem(500, 'internal_error'), page([completed()]));
    const { user } = renderScreen(<ExecutionList />);

    expect(await screen.findByText('Não foi possível carregar as execuções')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
  });

  it('sem poder ler os workflows, esconde o filtro de workflow e a lista continua', async () => {
    api.respond(WORKFLOWS, problem(403, 'no_permission'));
    api.respond(LIST, page([completed()]));
    renderScreen(<ExecutionList />);

    await screen.findByText('Entregue');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Workflow' })).not.toBeInTheDocument());
  });
});

describe('Execuções do workflow: Executar lote', () => {
  it('com executions.trigger, mostra "Executar lote" e o disparo abre o painel da execução nova', async () => {
    const onOpenExecution = vi.fn();
    const created = execution({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c06' });
    api.respond(LIST, page([completed()]));
    api.respond(`GET /v1/workflows/${WORKFLOW_ID}/draft`, json(savedDraft(5)));
    api.respond(`POST /v1/workflows/${WORKFLOW_ID}/executions`, json(created, 202));
    const { user } = renderScreen(<ExecutionList workflowId={WORKFLOW_ID} onOpenExecution={onOpenExecution} />);
    await screen.findByText('Entregue');

    await user.click(screen.getByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await screen.findByText(/revisão 5/);
    await user.click(within(dialog).getByRole('button', { name: 'Executar lote' }));

    await waitFor(() => expect(onOpenExecution).toHaveBeenCalledWith(created.id));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem executions.trigger, o botão não aparece, nem no vazio', async () => {
    prepare(VIEWER_PERMISSIONS);
    api.respond(LIST, page([]));
    const { queryClient } = renderScreen(<ExecutionList workflowId={WORKFLOW_ID} />);

    expect(await screen.findByText('Quem executa lotes no tenant ainda não executou este workflow.')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
  });

  it('o vazio do workflow oferece "Executar lote" a quem pode', async () => {
    api.respond(LIST, page([]));
    renderScreen(<ExecutionList workflowId={WORKFLOW_ID} />);

    expect(await screen.findByText('Execute o lote para ver a primeira execução deste workflow aqui.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Executar lote' })).toHaveLength(2));
  });

  it('a lista do tenant não tem "Executar lote"', async () => {
    api.respond(LIST, page([completed()]));
    renderScreen(<ExecutionList />);

    await screen.findByText('Entregue');
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
  });
});
