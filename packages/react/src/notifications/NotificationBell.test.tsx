import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import {
  LIST,
  READ,
  WORKFLOW,
  alert,
  noContent,
  oneOfEachKind,
  page,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './notifications.test-support';

let api: SimulatedApi;
const onOpenExecution = vi.fn();
const onOpenSchedules = vi.fn();

beforeEach(() => {
  api = simulateApi();
  onOpenExecution.mockReset();
  onOpenSchedules.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderBell(options: { advanceTimers?: (ms: number) => unknown } = {}) {
  return renderScreen(<NotificationBell onOpenExecution={onOpenExecution} onOpenSchedules={onOpenSchedules} />, options);
}

function bell() {
  return screen.getByRole('button', { name: /^Alertas/ });
}

async function openBell(user: ReturnType<typeof renderBell>['user']) {
  await user.click(bell());
  return screen.findByRole('dialog', { name: 'Alertas' });
}

async function readBody(request: Request): Promise<unknown> {
  return JSON.parse(await request.text());
}

describe('NotificationBell: contagem', () => {
  it('mostra os não lidos num badge e no nome do botão', async () => {
    api.respond(LIST, page([alert(), alert(), alert(), alert({ read: true })]));
    renderBell();

    const button = await screen.findByRole('button', { name: 'Alertas, 3 não lidos' });
    expect(within(button).getByText('3')).toBeInTheDocument();
  });

  it('usa a contagem da API, que soma todas as páginas', async () => {
    api.respond(LIST, page([alert()], { unread: 42, nextCursor: 'c2' }));
    renderBell();

    const button = await screen.findByRole('button', { name: 'Alertas, 42 não lidos' });
    expect(within(button).getByText('42')).toBeInTheDocument();
  });

  it('acima de 99, o badge mostra 99+ e o nome o número exato', async () => {
    api.respond(LIST, page([alert()], { unread: 1250 }));
    renderBell();

    const button = await screen.findByRole('button', { name: 'Alertas, 1.250 não lidos' });
    expect(within(button).getByText('99+')).toBeInTheDocument();
  });

  it('no singular, com um não lido', async () => {
    api.respond(LIST, page([alert()]));
    renderBell();

    expect(await screen.findByRole('button', { name: 'Alertas, 1 não lido' })).toBeInTheDocument();
  });

  it('sem não lidos, sem badge', async () => {
    api.respond(LIST, page([alert({ read: true })]));
    renderBell();

    const button = await screen.findByRole('button', { name: 'Alertas, nenhum não lido' });
    expect(button).toHaveTextContent('');
  });

  it('enquanto carrega, o botão se chama só Alertas', () => {
    api.respond(LIST, new Promise<Response>(() => {}));
    renderBell();

    expect(screen.getByRole('button', { name: 'Alertas' })).toBeInTheDocument();
  });
});

describe('NotificationBell: lista', () => {
  it('mostra cada tipo com ponto e título, o detalhe, quando e o link', async () => {
    api.respond(LIST, page(oneOfEachKind()));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 4 não lidos' });

    const popover = await openBell(user);
    const items = within(popover).getAllByRole('listitem');
    expect(items).toHaveLength(6);

    const expected = [
      { title: 'Execução aguarda decisão', tone: 'amber', link: 'Abrir execução', when: 'há 5 min', unread: true },
      { title: 'Alerta na pré-validação', tone: 'amber', link: 'Abrir execução', when: 'há 10 min', unread: true },
      { title: 'Execução abortada', tone: 'red', link: 'Abrir execução', when: 'há 15 min', unread: true },
      { title: 'Execução com erros', tone: 'red', link: 'Abrir execução', when: 'há 20 min', unread: false },
      { title: 'Agendamento não disparou', tone: 'red', link: 'Abrir agendamentos', when: 'há 25 min', unread: true },
      { title: 'Agendamento não executou', tone: 'amber', link: 'Abrir agendamentos', when: 'há 30 min', unread: false },
    ];
    expected.forEach((row, index) => {
      const item = within(items[index]!);
      const title = item.getByText(row.title);
      expect(title.closest('.fc-status')).toHaveClass(`fc-status-${row.tone}`);
      expect(item.getByText(row.when)).toBeInTheDocument();
      expect(item.getByRole('button', { name: row.link })).toHaveAccessibleDescription(row.title);
      if (row.unread) expect(items[index]).toHaveTextContent('não lido');
      else expect(items[index]).not.toHaveTextContent('não lido');
    });
    expect(within(items[2]!).getByText('Pontuação de exemplo: a fonte ItensNF não respondeu.')).toBeInTheDocument();
  });

  it('com mais páginas, diz que mostra só os mais recentes', async () => {
    api.respond(LIST, page([alert(), alert({ read: true })], { nextCursor: 'c2', unread: 30 }));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 30 não lidos' });

    const popover = await openBell(user);
    expect(within(popover).getByText('Mostrando os 2 alertas mais recentes.')).toBeInTheDocument();
  });

  it('vazio: Nenhum alerta, e Marcar todos desabilitado com o motivo', async () => {
    api.respond(LIST, page([]));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, nenhum não lido' });

    const popover = await openBell(user);
    expect(within(popover).getByText('Nenhum alerta')).toBeInTheDocument();
    expect(within(popover).queryByRole('list')).not.toBeInTheDocument();
    const markAll = within(popover).getByRole('button', { name: 'Marcar todos como lidos' });
    expect(markAll).toHaveAttribute('aria-disabled', 'true');
    expect(markAll).toHaveAccessibleDescription('Todos os alertas já foram lidos');
  });

  it('carregando: o esqueleto anuncia Carregando alertas', async () => {
    api.respond(LIST, new Promise<Response>(() => {}));
    const { user } = renderBell();

    const popover = await openBell(user);
    expect(within(popover).getByRole('status')).toHaveTextContent('Carregando alertas');
    expect(within(popover).queryByRole('button', { name: 'Marcar todos como lidos' })).not.toBeInTheDocument();
  });

  it('erro: diz o que houve e Tentar de novo carrega a lista', async () => {
    api.respond(LIST, problem(403, 'no_permission'), page([alert()]));
    const { user } = renderBell();
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(1));

    const popover = await openBell(user);
    const error = await within(popover).findByRole('alert');
    expect(error).toHaveTextContent('Não foi possível carregar os alertas');
    expect(error).toHaveTextContent('Você não tem permissão para ver os alertas neste tenant. Peça acesso a um Admin.');
    expect(bell()).toHaveAccessibleName('Alertas');

    await user.click(within(popover).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(popover).findByText('Execução aguarda decisão')).toBeInTheDocument();
    expect(within(popover).queryByRole('alert')).not.toBeInTheDocument();
    expect(bell()).toHaveAccessibleName('Alertas, 1 não lido');
  });
});

describe('NotificationBell: abrir um alerta', () => {
  it('marca como lido, fecha o popover e abre a execução', async () => {
    const decision = alert();
    api.respond(LIST, page([decision, alert()]), page([{ ...decision, read: true }, alert()]));
    api.respond(READ, noContent());
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 2 não lidos' });

    const popover = await openBell(user);
    const [first] = within(popover).getAllByRole('listitem');
    await user.click(within(first!).getByRole('button', { name: 'Abrir execução' }));

    expect(onOpenExecution).toHaveBeenCalledWith(decision.execution!.id);
    expect(onOpenSchedules).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, 1 não lido'));
    await waitFor(() => expect(api.callsTo(READ)).toHaveLength(1));
    expect(await readBody(api.callsTo(READ)[0]!)).toEqual({ ids: [decision.id] });
    // The list is fetched again after the answer.
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
  });

  it('alerta de agendamento sem execução abre a aba Agendamentos do workflow', async () => {
    const skipped = oneOfEachKind()[5]!;
    const failed = oneOfEachKind()[4]!;
    api.respond(LIST, page([failed, skipped]));
    api.respond(READ, noContent());
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    const popover = await openBell(user);
    await user.click(within(within(popover).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Abrir agendamentos' }));

    expect(onOpenSchedules).toHaveBeenCalledWith(WORKFLOW.id);
    expect(onOpenExecution).not.toHaveBeenCalled();
    await waitFor(() => expect(api.callsTo(READ)).toHaveLength(1));
    expect(await readBody(api.callsTo(READ)[0]!)).toEqual({ ids: [failed.id] });
  });

  it('um alerta já lido só navega, sem marcar de novo', async () => {
    const read = alert({ read: true });
    api.respond(LIST, page([read]));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, nenhum não lido' });

    const popover = await openBell(user);
    await user.click(within(popover).getByRole('button', { name: 'Abrir execução' }));

    expect(onOpenExecution).toHaveBeenCalledWith(read.execution!.id);
    expect(api.callsTo(READ)).toHaveLength(0);
  });

  it('se a marcação falha, a lista lida de novo traz o alerta como não lido', async () => {
    const decision = alert();
    api.respond(LIST, page([decision]));
    let fail: (response: Response) => void = () => {};
    api.respond(READ, () => new Promise<Response>((resolve) => (fail = resolve)));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    const popover = await openBell(user);
    await user.click(within(popover).getByRole('button', { name: 'Abrir execução' }));

    // Marked at once, while the answer is on its way.
    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, nenhum não lido'));
    await waitFor(() => expect(api.callsTo(READ)).toHaveLength(1));
    fail(problem(500, 'internal_error'));
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, 1 não lido'));
  });
});

describe('NotificationBell: Marcar todos como lidos', () => {
  it('envia all: true e zera a contagem', async () => {
    const items = oneOfEachKind();
    api.respond(
      LIST,
      page(items, { unread: 25 }),
      page(
        items.map((item) => ({ ...item, read: true })),
        { unread: 0 },
      ),
    );
    api.respond(READ, noContent());
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 25 não lidos' });

    const popover = await openBell(user);
    await user.click(within(popover).getByRole('button', { name: 'Marcar todos como lidos' }));

    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, nenhum não lido'));
    expect(await readBody(api.callsTo(READ)[0]!)).toEqual({ all: true });
    expect(within(popover).queryByText(/não lido/)).not.toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: 'Marcar todos como lidos' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('zera a contagem mesmo com não lidos além da página, sem depender da nova busca', async () => {
    const items = oneOfEachKind();
    // 35 unread in the tenant, only the first page loaded; the refetch after the marking fails.
    api.respond(LIST, page(items, { unread: 35, nextCursor: 'cursor-2' }), problem(500, 'internal_error'));
    api.respond(READ, noContent());
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 35 não lidos' });

    const popover = await openBell(user);
    await user.click(within(popover).getByRole('button', { name: 'Marcar todos como lidos' }));

    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, nenhum não lido'));
    expect(within(bell()).queryByText(/\d/)).not.toBeInTheDocument();
    expect(within(popover).queryByText(/não lido/)).not.toBeInTheDocument();
  });

  it('em erro, mostra a mensagem e mantém os não lidos', async () => {
    api.respond(LIST, page([alert(), alert()]));
    api.respond(READ, problem(403, 'no_permission'));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 2 não lidos' });

    const popover = await openBell(user);
    await user.click(within(popover).getByRole('button', { name: 'Marcar todos como lidos' }));

    const error = await within(popover).findByRole('alert');
    expect(error).toHaveTextContent('Não foi possível marcar os alertas como lidos');
    expect(error).toHaveTextContent('Texto do servidor para no_permission.');
    expect(bell()).toHaveAccessibleName('Alertas, 2 não lidos');
  });
});

describe('NotificationBell: atualização', () => {
  it('busca a lista de novo a cada 30 s e atualiza a contagem', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api.respond(LIST, page([alert()]), page([alert(), alert(), alert()]));
    renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_900);
    });
    expect(api.callsTo(LIST)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
    expect(await screen.findByRole('button', { name: 'Alertas, 3 não lidos' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(3));
  });

  it('falha no meio da atualização: para, mantém a lista e oferece Tentar de novo', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api.respond(LIST, page([alert()]), problem(500, 'internal_error'), page([alert(), alert()]));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(api.callsTo(LIST)).toHaveLength(2);
    expect(bell()).toHaveAccessibleName('Alertas, 1 não lido');

    const popover = await openBell(user);
    const error = within(popover).getByRole('alert');
    expect(error).toHaveTextContent('Não foi possível atualizar os alertas');
    expect(within(popover).getByText('Execução aguarda decisão')).toBeInTheDocument();

    await user.click(within(popover).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(bell()).toHaveAccessibleName('Alertas, 2 não lidos'));
    expect(within(popover).queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(4));
  });
});

describe('NotificationBell: teclado', () => {
  it('abre com Enter, fecha com Esc e devolve o foco ao botão', async () => {
    api.respond(LIST, page([alert()]));
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    await user.tab();
    expect(bell()).toHaveFocus();
    expect(bell()).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Enter}');
    const popover = await screen.findByRole('dialog', { name: 'Alertas' });
    expect(bell()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(popover).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bell()).toHaveFocus();
  });

  it('o link do alerta se alcança pelo Tab e abre com Enter', async () => {
    const decision = alert();
    api.respond(LIST, page([decision]));
    api.respond(READ, noContent());
    const { user } = renderBell();
    await screen.findByRole('button', { name: 'Alertas, 1 não lido' });

    await user.tab();
    await user.keyboard('{Enter}');
    const popover = await screen.findByRole('dialog', { name: 'Alertas' });
    const link = within(popover).getByRole('button', { name: 'Abrir execução' });
    for (let step = 0; step < 4 && document.activeElement !== link; step += 1) await user.tab();
    expect(link).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onOpenExecution).toHaveBeenCalledWith(decision.execution!.id);
  });
});
