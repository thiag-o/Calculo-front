import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowList } from '.';
import {
  BONUS,
  COMMISSION,
  CREATED,
  SCORING,
  VIEWER_PERMISSIONS,
  json,
  page,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './workflows.test-support';

let api: SimulatedApi;

beforeEach(() => {
  // Only the clock is fake: "now" is 30 min after the last change of "Pontuação de exemplo", in any time zone.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.parse(SCORING.updated_at) + 30 * 60_000));
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const cards = () => screen.getByRole('list', { name: 'Workflows' });
const cardOf = (name: string) =>
  within(cards())
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name }) !== null)!;
const listQueries = () => api.callsTo('GET /v1/workflows').map((request) => new URL(request.url).searchParams);

describe('Workflows: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => page([SCORING]));
    api.respond('GET /v1/workflows', pending.promise);
    renderScreen(<WorkflowList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando workflows');

    pending.release();
    expect(await screen.findByRole('heading', { name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra em cada card o nome, os blocos do rascunho, quem editou e quando, e o selo de problemas', async () => {
    api.respond('GET /v1/workflows', page([SCORING, BONUS]));
    renderScreen(<WorkflowList />);

    expect(await screen.findByText('2 workflows')).toBeInTheDocument();
    const scoring = cardOf('Pontuação de exemplo');
    expect(within(scoring).getByText('Rascunho · 3 blocos')).toBeInTheDocument();
    expect(within(scoring).getByText('editado por Bruno Lima há 30 min')).toBeInTheDocument();
    expect(within(scoring).queryByText(/problema/)).not.toBeInTheDocument();

    const bonus = cardOf('Bônus de metas');
    expect(within(bonus).getByText('Rascunho · 1 bloco')).toBeInTheDocument();
    expect(within(bonus).getByText(/^editado por Ana Souza (ontem \d{2}:\d{2}|há \d+ h|em 17\/11)$/)).toBeInTheDocument();
    expect(within(bonus).getByText('2 problemas')).toHaveClass('fc-badge-amber');
  });

  it('abre a Visão geral ao clicar no card, quando a tela recebe onOpenWorkflow', async () => {
    api.respond('GET /v1/workflows', page([SCORING, BONUS]));
    const onOpenWorkflow = vi.fn();
    const { user } = renderScreen(<WorkflowList onOpenWorkflow={onOpenWorkflow} />);

    await user.click(await screen.findByRole('button', { name: 'Bônus de metas' }));
    expect(onOpenWorkflow).toHaveBeenCalledWith(BONUS.id);
  });

  it('sem onOpenWorkflow, o nome é só texto', async () => {
    api.respond('GET /v1/workflows', page([SCORING]));
    renderScreen(<WorkflowList />);

    expect(await screen.findByRole('heading', { name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pontuação de exemplo' })).not.toBeInTheDocument();
  });

  it('mostra 3 colunas e passa para 2 quando o módulo fica abaixo de 1180px', async () => {
    const observed: { element: Element; callback: ResizeObserverCallback }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(element: Element) {
          observed.push({ element, callback: this.callback });
        }
        unobserve() {}
        disconnect() {}
      },
    );
    api.respond('GET /v1/workflows', page([SCORING, BONUS, COMMISSION]));
    renderScreen(<WorkflowList />);

    expect(await screen.findByText('3 workflows')).toBeInTheDocument();
    expect(cards()).toHaveAttribute('data-columns', '3');
    const root = observed.find((item) => item.element.classList.contains('fc-root'));
    expect(root).toBeDefined();

    const resize = (width: number) =>
      act(() => root!.callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver));
    resize(1100);
    expect(cards()).toHaveAttribute('data-columns', '2');
    resize(1300);
    expect(cards()).toHaveAttribute('data-columns', '3');
    resize(1440);
    expect(cards()).toHaveAttribute('data-columns', '3');
  });
});

describe('Workflows: filtro e "Carregar mais"', () => {
  it('"Filtrar por nome" pede à API depois de uma pausa na digitação', async () => {
    api.respond('GET /v1/workflows', (request) =>
      new URL(request.url).searchParams.get('name') === 'bônus' ? page([BONUS]) : page([SCORING, BONUS]),
    );
    const { user } = renderScreen(<WorkflowList />);
    expect(await screen.findByText('2 workflows')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Filtrar por nome' }), ' bônus ');

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Pontuação de exemplo' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Bônus de metas' })).toBeInTheDocument();
    expect(screen.getByText('1 workflow')).toBeInTheDocument();
    // Only one request for the typed text, already without the spaces of the ends.
    expect(listQueries().map((query) => query.get('name'))).toEqual([null, 'bônus']);
  });

  it('Enter filtra na hora e um filtro sem resultado diz o que não achou', async () => {
    api.respond('GET /v1/workflows', (request) => (new URL(request.url).searchParams.get('name') ? page([]) : page([SCORING])));
    const { user } = renderScreen(<WorkflowList />);
    expect(await screen.findByText('1 workflow')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Filtrar por nome' }), 'folha{Enter}');

    expect(await screen.findByText('Nenhum workflow com “folha” no nome.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum workflow ainda')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Filtrar por nome' })).toHaveValue('folha');
  });

  it('"Carregar mais" traz a próxima página pelo cursor e some na última', async () => {
    api.respond('GET /v1/workflows', (request) =>
      new URL(request.url).searchParams.get('cursor') === 'pagina-2' ? page([COMMISSION]) : page([SCORING, BONUS], 'pagina-2'),
    );
    const { user } = renderScreen(<WorkflowList />);

    expect(await screen.findByText('Mais de 2 workflows')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByRole('heading', { name: 'Comissão trimestral' })).toBeInTheDocument();
    expect(screen.getByText('3 workflows')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
    expect(listQueries().map((query) => query.get('cursor'))).toEqual([null, 'pagina-2']);
  });

  it('a falha ao carregar mais mantém os cards e oferece tentar de novo', async () => {
    api.respond('GET /v1/workflows', page([SCORING], 'pagina-2'), problem(503, 'unavailable'), page([BONUS]));
    const { user } = renderScreen(<WorkflowList />);

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Não foi possível carregar mais workflows')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pontuação de exemplo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Bônus de metas' })).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar mais workflows')).not.toBeInTheDocument();
  });
});

describe('Workflows: vazio e erro', () => {
  it('vazio, com workflows.edit: diz o que falta e oferece Novo workflow', async () => {
    api.respond('GET /v1/workflows', page([]));
    const { user } = renderScreen(<WorkflowList />);

    expect(await screen.findByText('Nenhum workflow ainda')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro workflow para montar o cálculo.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Filtrar por nome' })).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'Novo workflow' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(await screen.findByRole('dialog', { name: 'Novo workflow' })).toBeInTheDocument();
  });

  it('vazio, sem workflows.edit: sem o botão', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond('GET /v1/workflows', page([]));
    renderScreen(<WorkflowList />);

    expect(await screen.findByText('Nenhum workflow ainda')).toBeInTheDocument();
    expect(screen.getByText('Quem edita workflows no tenant ainda não criou nenhum.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo workflow' })).not.toBeInTheDocument();
  });

  it('com workflows, quem não tem workflows.edit não vê Novo workflow', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond('GET /v1/workflows', page([SCORING]));
    renderScreen(<WorkflowList />);

    expect(await screen.findByRole('heading', { name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(api.callsTo('GET /v1/session')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Novo workflow' })).not.toBeInTheDocument();
  });

  it('erro: mostra o que houve e Tentar de novo carrega a lista', async () => {
    api.respond('GET /v1/workflows', problem(503, 'unavailable'), page([SCORING]));
    const { user } = renderScreen(<WorkflowList />);

    expect(await screen.findByText('Não foi possível carregar os workflows')).toBeInTheDocument();
    expect(screen.getByText('Texto do servidor para unavailable.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Pontuação de exemplo' })).toBeInTheDocument();
  });

  it('sem permissão de ver: a mensagem diz o que fazer, sem Tentar de novo', async () => {
    api.respond('GET /v1/workflows', problem(403, 'no_permission'));
    renderScreen(<WorkflowList />);

    expect(
      await screen.findByText('Você não tem permissão para ver os workflows deste tenant. Peça acesso a um Admin.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

describe('Workflows: Novo workflow', () => {
  it('cria com nome e objetivo, atualiza a lista e abre a Visão geral do novo', async () => {
    api.respond('GET /v1/workflows', page([BONUS]), page([SCORING, BONUS]));
    api.respond('POST /v1/workflows', json(CREATED, 201));
    const onOpenWorkflow = vi.fn();
    const { user, queryClient } = renderScreen(<WorkflowList onOpenWorkflow={onOpenWorkflow} />);
    expect(await screen.findByText('1 workflow')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Novo workflow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), '  Pontuação de exemplo ');
    await user.type(within(dialog).getByRole('textbox', { name: 'Objetivo' }), 'Calcula os pontos.');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onOpenWorkflow).toHaveBeenCalledWith(CREATED.id));
    expect(await api.callsTo('POST /v1/workflows')[0]!.json()).toEqual({ name: 'Pontuação de exemplo', objective: 'Calcula os pontos.' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(['workflows', CREATED.id])).toEqual(CREATED);
    expect(await screen.findByText('2 workflows')).toBeInTheDocument();
  });

  it('sem objetivo, envia objective nulo', async () => {
    api.respond('GET /v1/workflows', page([]));
    api.respond('POST /v1/workflows', json(CREATED, 201));
    const { user } = renderScreen(<WorkflowList />);

    await user.click((await screen.findAllByRole('button', { name: 'Novo workflow' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Pontuação de exemplo');
    await user.type(within(dialog).getByRole('textbox', { name: 'Objetivo' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await api.callsTo('POST /v1/workflows')[0]!.json()).toEqual({ name: 'Pontuação de exemplo', objective: null });
  });

  it('workflow_exists aparece no campo do nome e some ao mudar o nome', async () => {
    api.respond('GET /v1/workflows', page([SCORING]));
    api.respond('POST /v1/workflows', problem(409, 'workflow_exists'));
    const onOpenWorkflow = vi.fn();
    const { user } = renderScreen(<WorkflowList onOpenWorkflow={onOpenWorkflow} />);

    await user.click(await screen.findByRole('button', { name: 'Novo workflow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await user.type(name, 'pontuação de exemplo');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Já existe um workflow com esse nome neste tenant. Escolha outro nome.');
    expect(screen.getByRole('dialog', { name: 'Novo workflow' })).toBeInTheDocument();
    expect(onOpenWorkflow).not.toHaveBeenCalled();

    await user.type(name, ' 2');
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('não envia sem nome e diz o que falta', async () => {
    api.respond('GET /v1/workflows', page([SCORING]));
    const { user } = renderScreen(<WorkflowList />);

    await user.click(await screen.findByRole('button', { name: 'Novo workflow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe o nome do workflow')).toBeInTheDocument();
    expect(api.callsTo('POST /v1/workflows')).toHaveLength(0);
  });

  it('Cancelar fecha sem criar e devolve o foco ao botão', async () => {
    api.respond('GET /v1/workflows', page([SCORING]));
    const { user } = renderScreen(<WorkflowList />);

    const button = await screen.findByRole('button', { name: 'Novo workflow' });
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(api.callsTo('POST /v1/workflows')).toHaveLength(0);
  });

  it('sem permissão de editar no servidor, a mensagem aparece no diálogo', async () => {
    api.respond('GET /v1/workflows', page([SCORING]));
    api.respond('POST /v1/workflows', problem(403, 'no_permission'));
    const { user } = renderScreen(<WorkflowList />);

    await user.click(await screen.findByRole('button', { name: 'Novo workflow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo workflow' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Folha');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(dialog).findByText('Você não tem permissão para editar workflows neste tenant. Peça acesso a um Admin.'),
    ).toBeInTheDocument();
  });
});
