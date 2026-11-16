import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarQueryClient, ProvedorApi } from '../api';
import { RaizFluxo } from '../design-system';
import { Administracao, type AdministracaoProps } from '.';

// Recursos do navegador que o jsdom não tem e que o Radix usa (menus e diálogos das áreas).
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const API = 'https://api.teste';
const TENANT = { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' };
const TODAS = ['usuarios.gerenciar', 'papeis.gerenciar', 'integracao.gerenciar', 'seguranca.gerenciar', 'auditoria.ver'];

function sessao(permissoes: string[]) {
  return {
    usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana Beatriz Souza', email: 'ana@exemplo.com' },
    tenants: [TENANT],
    tenant_atual: TENANT,
    permissoes,
  };
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function problema(status: number, codigo: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${codigo}.`, codigo }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Resposta = Response | Promise<Response>;

/** fetch simulado por rota ("MÉTODO /caminho"); rota não prevista responde 404. As áreas recebem listas vazias. */
function simularApi(rotaSessao: Resposta) {
  const rotas: Record<string, Resposta> = {
    'GET /v1/sessao': rotaSessao,
    'GET /v1/usuarios': json({ itens: [], proximo_cursor: null }),
    'GET /v1/papeis': json([]),
    'GET /v1/chaves-api': json({ itens: [], proximo_cursor: null }),
    'GET /v1/dominios-autorizados': json([]),
  };
  const fetchSimulado = vi.fn(async (requisicao: Request) => {
    const resposta = rotas[`${requisicao.method} ${new URL(requisicao.url).pathname}`];
    if (resposta === undefined) return problema(404, 'nao_encontrado');
    return (await resposta).clone();
  });
  vi.stubGlobal('fetch', fetchSimulado);
  return {
    definir(rota: string, resposta: Resposta) {
      rotas[rota] = resposta;
    },
    chamadas: () => fetchSimulado.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`),
  };
}

function renderizar(props: AdministracaoProps = {}) {
  const usuario = userEvent.setup();
  const queryClient = criarQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const arvore = (atuais: AdministracaoProps) => (
    <RaizFluxo tema="claro">
      <ProvedorApi apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Administracao {...atuais} />
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>
  );
  const { rerender } = render(arvore(props));
  return { usuario, trocarProps: (novas: AdministracaoProps) => rerender(arvore(novas)) };
}

const listaDeAbas = () => screen.getByRole('tablist', { name: 'Administração' });
const nomesDasAbas = () => within(listaDeAbas()).getAllByRole('tab').map((aba) => aba.textContent);
const painel = () => screen.getByRole('tabpanel');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<Administracao>', () => {
  it('com todas as permissões, mostra as quatro abas e abre Usuários', async () => {
    const api = simularApi(json(sessao(TODAS)));
    renderizar();

    expect(await screen.findByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    expect(nomesDasAbas()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(painel()).toHaveAccessibleName('Usuários');
    expect(within(painel()).getByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(api.chamadas()).not.toContain('GET /v1/configuracoes/seguranca');
  });

  it('cada aba aparece só com a permissão da sua área', async () => {
    simularApi(json(sessao(['integracao.gerenciar', 'seguranca.gerenciar'])));
    renderizar();

    expect(await screen.findByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(nomesDasAbas()).toEqual(['Integração', 'Segurança']);
    expect(within(painel()).getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
  });

  it('o clique troca a área mostrada', async () => {
    simularApi(json(sessao(TODAS)));
    const { usuario } = renderizar();
    await screen.findByRole('tab', { name: 'Usuários' });

    await usuario.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'false');
    expect(painel()).toHaveAccessibleName('Papéis');
    expect(within(painel()).getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('pelo teclado: Tab chega à aba escolhida, as setas andam e escolhem, Home e End vão às pontas', async () => {
    simularApi(json(sessao(TODAS)));
    const { usuario } = renderizar();
    await screen.findByRole('tab', { name: 'Usuários' });

    await usuario.tab();
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();
    // Só a aba escolhida fica na ordem do Tab; o próximo Tab vai para o painel.
    for (const nome of ['Papéis', 'Integração', 'Segurança']) {
      expect(screen.getByRole('tab', { name: nome })).toHaveAttribute('tabindex', '-1');
    }

    await usuario.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');

    await usuario.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
    expect(painel()).toHaveAccessibleName('Segurança');

    await usuario.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();

    await usuario.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();

    await usuario.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await usuario.tab();
    expect(painel()).toHaveFocus();
  });

  it('com a aba controlada por quem usa a tela, abre nela e avisa a escolha sem trocar sozinha', async () => {
    simularApi(json(sessao(TODAS)));
    const aoTrocarAba = vi.fn();
    const { usuario, trocarProps } = renderizar({ aba: 'integracao', aoTrocarAba });

    expect(await screen.findByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(within(painel()).getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(aoTrocarAba).toHaveBeenCalledExactlyOnceWith('papeis');
    // Quem controla decide: enquanto a `aba` não muda, a área continua a mesma.
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');

    trocarProps({ aba: 'papeis', aoTrocarAba });
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(within(painel()).getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();

    // Escolher a aba já aberta não avisa de novo.
    await usuario.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(aoTrocarAba).toHaveBeenCalledTimes(1);
  });

  it('com a aba controlada sem permissão, abre a primeira permitida', async () => {
    simularApi(json(sessao(['papeis.gerenciar', 'seguranca.gerenciar'])));
    renderizar({ aba: 'usuarios' });

    expect(await screen.findByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(nomesDasAbas()).toEqual(['Papéis', 'Segurança']);
  });

  it('sem nenhuma permissão da Administração, diz que não há área disponível', async () => {
    const api = simularApi(json(sessao(['workflows.ver', 'auditoria.ver'])));
    renderizar();

    expect(await screen.findByText('Nenhuma área da Administração disponível para você')).toBeInTheDocument();
    expect(screen.getByText('Peça ao administrador do cliente as permissões de que precisa.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
  });

  it('enquanto a sessão chega, mostra o esqueleto', async () => {
    let entregar: (resposta: Response) => void = () => undefined;
    simularApi(new Promise<Response>((resolver) => (entregar = resolver)));
    renderizar();

    expect(screen.getByRole('status')).toHaveTextContent('Carregando a Administração');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await act(async () => entregar(json(sessao(TODAS))));
    expect(await screen.findByRole('tablist', { name: 'Administração' })).toBeInTheDocument();
  });

  it('se a sessão não carrega, diz o que houve e tenta de novo', async () => {
    const api = simularApi(problema(503, 'indisponivel'));
    const { usuario } = renderizar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível abrir a Administração');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');

    api.definir('GET /v1/sessao', json(sessao(TODAS)));
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('tablist', { name: 'Administração' })).toBeInTheDocument();
  });
});
