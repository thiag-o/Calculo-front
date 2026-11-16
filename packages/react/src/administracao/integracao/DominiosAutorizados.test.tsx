import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DominiosAutorizados, Integracao } from '.';
import { MOTIVO_REMOCAO_NAO_ENCONTRADO } from './DialogoRemoverDominio';
import {
  MENSAGEM_DOMINIO_EXISTENTE,
  MENSAGEM_DOMINIO_NAO_ENCONTRADO,
  MENSAGEM_ORIGEM_INVALIDA,
  MENSAGEM_SEM_PERMISSAO,
} from './mensagens';
import { MENSAGEM_ORIGEM_COM_CAMINHO, MENSAGEM_ORIGEM_SEM_ESQUEMA, MENSAGEM_ORIGEM_VAZIA } from './origem';
import {
  CHAVE_PORTAL,
  DOMINIO_APP,
  DOMINIO_LOCAL,
  DOMINIOS,
  definirCookieCsrf,
  isoLocal,
  json,
  problema,
  renderizarIntegracao,
  respostaPendente,
  semConteudo,
  simularApi,
  type ApiSimulada,
} from './integracao.test.apoio';

let api: ApiSimulada;

const ROTA_LISTA = 'GET /v1/dominios-autorizados';
const ROTA_CRIAR = 'POST /v1/dominios-autorizados';
const ROTA_REMOVER = `DELETE /v1/dominios-autorizados/${DOMINIO_APP.id}`;
const NOVO = { id: '40000000-0000-0000-0000-000000000009', origem: 'https://portal.cliente.com.br:8443', criado_em: isoLocal(2026, 11, 16) };

beforeEach(() => {
  api = simularApi();
  definirCookieCsrf('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar() {
  return renderizarIntegracao(<DominiosAutorizados />);
}

function linhaDe(texto: string): HTMLElement {
  return screen.getByText(texto).closest('tr')!;
}

describe('Integração: tela inteira', () => {
  it('mostra as chaves de API e os domínios autorizados, cada seção com a sua ação', async () => {
    api.responder('GET /v1/chaves-api', json({ itens: [CHAVE_PORTAL], proximo_cursor: null }));
    api.responder(ROTA_LISTA, json({ itens: DOMINIOS }));
    renderizarIntegracao(<Integracao />);

    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)).toEqual([
      'Chaves de API',
      'Domínios autorizados',
    ]);
    expect(screen.getByRole('region', { name: 'Chaves de API' })).toContainElement(
      screen.getByRole('button', { name: 'Nova chave de API' }),
    );
    expect(screen.getByRole('region', { name: 'Domínios autorizados' })).toContainElement(
      screen.getByRole('button', { name: 'Novo domínio' }),
    );
  });
});

describe('Integração: lista de domínios autorizados', () => {
  it('mostra a origem e quando foi cadastrada', async () => {
    api.responder(ROTA_LISTA, json({ itens: DOMINIOS }));
    renderizar();

    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('2 domínios')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual([
      'Origem',
      'Cadastrado',
      'Ações',
    ]);
    expect(within(linhaDe('https://app.exemplo.com.br')).getByText('03/11/2026')).toBeInTheDocument();
    expect(within(linhaDe('http://localhost:5274')).getByText('14/11/2026')).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pendente = respostaPendente(() => json({ itens: [DOMINIO_APP] }));
    api.responder(ROTA_LISTA, pendente.promessa);
    renderizar();

    expect(screen.getByRole('table', { name: 'Domínios autorizados do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando domínios autorizados do tenant');

    pendente.liberar();
    expect(await screen.findByText('1 domínio')).toBeInTheDocument();
  });

  it('vazio: diz o que falta e oferece cadastrar', async () => {
    api.responder(ROTA_LISTA, json({ itens: [] }));
    const { usuario } = renderizar();

    expect(await screen.findByText('Nenhum domínio autorizado ainda')).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: 'Novo domínio' });
    expect(botoes).toHaveLength(2);
    await usuario.click(botoes[1]!);
    expect(await screen.findByRole('dialog', { name: 'Novo domínio' })).toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.responder(ROTA_LISTA, problema(503, 'indisponivel'), json({ itens: [DOMINIO_APP] }));
    const { usuario } = renderizar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os domínios autorizados');
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.responder(ROTA_LISTA, problema(403, 'sem_permissao'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

async function abrirNovo(usuario: UserEvent) {
  await screen.findByText('https://app.exemplo.com.br');
  await usuario.click(screen.getByRole('button', { name: 'Novo domínio' }));
  return screen.findByRole('dialog', { name: 'Novo domínio' });
}

async function salvarOrigem(usuario: UserEvent, painel: HTMLElement, origem: string) {
  const campo = within(painel).getByRole('textbox', { name: 'Origem' });
  await usuario.clear(campo);
  if (origem) await usuario.type(campo, origem);
  await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));
  return campo;
}

describe('Integração: novo domínio', () => {
  beforeEach(() => {
    api.responder(ROTA_LISTA, json({ itens: DOMINIOS }));
  });

  it.each([
    ['', MENSAGEM_ORIGEM_VAZIA],
    ['app.exemplo.com.br', MENSAGEM_ORIGEM_SEM_ESQUEMA],
    ['ftp://app.exemplo.com.br', MENSAGEM_ORIGEM_SEM_ESQUEMA],
    ['https://app.exemplo.com.br/painel', MENSAGEM_ORIGEM_COM_CAMINHO],
    ['https://app.exemplo.com.br?a=1', MENSAGEM_ORIGEM_COM_CAMINHO],
  ])('valida a origem no cliente: "%s"', async (origem, mensagem) => {
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);

    const campo = await salvarOrigem(usuario, painel, origem);

    expect(await within(painel).findByText(mensagem)).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(api.chamadasDe(ROTA_CRIAR)).toHaveLength(0);
  });

  it('cadastra a origem, fecha, atualiza a lista e devolve o foco ao "Novo domínio"', async () => {
    api.responder(ROTA_CRIAR, json(NOVO, 201));
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);
    expect(within(painel).getByRole('textbox', { name: 'Origem' })).toHaveFocus();
    expect(within(painel).getByRole('textbox', { name: 'Origem' })).toHaveAccessibleDescription(
      'Esquema, host e, se precisar, a porta. Sem caminho no fim.',
    );
    api.responder(ROTA_LISTA, json({ itens: [...DOMINIOS, NOVO] }));

    await salvarOrigem(usuario, painel, '  HTTPS://Portal.Cliente.com.br:8443/  ');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.chamadasDe(ROTA_CRIAR);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ origem: 'HTTPS://Portal.Cliente.com.br:8443/' });
    // A lista mostra a origem como a API a guardou (normalizada).
    expect(await screen.findByText('https://portal.cliente.com.br:8443')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo domínio' })).toHaveFocus());
  });

  it('origem_invalida da API: mostra o erro no campo', async () => {
    api.responder(ROTA_CRIAR, problema(422, 'origem_invalida', { campos: { origem: 'Texto do servidor.' } }));
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);

    const campo = await salvarOrigem(usuario, painel, 'https://app..exemplo');

    expect(await within(painel).findByText(MENSAGEM_ORIGEM_INVALIDA)).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog', { name: 'Novo domínio' })).toBeInTheDocument();
  });

  it('dominio_existente: mostra o erro no campo e atualiza a lista', async () => {
    api.responder(ROTA_CRIAR, problema(409, 'dominio_existente'));
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);

    await salvarOrigem(usuario, painel, 'https://APP.exemplo.com.br');

    expect(await within(painel).findByText(MENSAGEM_DOMINIO_EXISTENTE)).toBeInTheDocument();
    await waitFor(() => expect(api.chamadasDe(ROTA_LISTA)).toHaveLength(2));
  });

  it('enquanto salva, o botão fica ocupado e não cadastra duas vezes', async () => {
    const pendente = respostaPendente(() => json(NOVO, 201));
    api.responder(ROTA_CRIAR, pendente.promessa);
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);

    await salvarOrigem(usuario, painel, NOVO.origem);
    const salvar = within(painel).getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(salvar).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(salvar);
    expect(api.chamadasDe(ROTA_CRIAR)).toHaveLength(1);

    pendente.liberar();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem permissão: explica numa nota', async () => {
    api.responder(ROTA_CRIAR, problema(403, 'sem_permissao'));
    const { usuario } = renderizar();
    const painel = await abrirNovo(usuario);

    await salvarOrigem(usuario, painel, NOVO.origem);
    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
  });
});

async function abrirRemover(usuario: UserEvent, origem = 'https://app.exemplo.com.br') {
  await screen.findByText(origem);
  await usuario.click(screen.getByRole('button', { name: `Mais ações para ${origem}` }));
  await usuario.click(await screen.findByRole('menuitem', { name: 'Remover domínio' }));
  return screen.findByRole('dialog', { name: 'Remover domínio' });
}

describe('Integração: remover domínio', () => {
  beforeEach(() => {
    api.responder(ROTA_LISTA, json({ itens: DOMINIOS }));
  });

  it('pede confirmação e cancelar não remove; o foco volta ao "…" da linha', async () => {
    const { usuario } = renderizar();
    const painel = await abrirRemover(usuario);

    expect(painel).toHaveAccessibleDescription(
      'https://app.exemplo.com.br deixa de poder chamar a API com o token deste tenant: o módulo incorporado nessa origem para de funcionar.',
    );
    expect(within(painel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_REMOVER)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para https://app.exemplo.com.br' })).toHaveFocus());
  });

  it('remove com CSRF, fecha, atualiza a lista e, sem a linha, devolve o foco ao "Novo domínio"', async () => {
    api.responder(ROTA_REMOVER, semConteudo());
    const { usuario } = renderizar();
    const painel = await abrirRemover(usuario);
    api.responder(ROTA_LISTA, json({ itens: [DOMINIO_LOCAL] }));

    await usuario.click(within(painel).getByRole('button', { name: 'Remover domínio' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_REMOVER)[0]!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    await waitFor(() => expect(screen.queryByText('https://app.exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.getByText('1 domínio')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo domínio' })).toHaveFocus());
  });

  it('nao_encontrado: explica, não oferece remover de novo e atualiza a lista', async () => {
    api.responder(ROTA_REMOVER, problema(404, 'nao_encontrado'));
    const { usuario } = renderizar();
    const painel = await abrirRemover(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Remover domínio' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_DOMINIO_NAO_ENCONTRADO);
    const remover = within(painel).getByRole('button', { name: 'Remover domínio' });
    expect(remover).toHaveAttribute('aria-disabled', 'true');
    expect(remover).toHaveAccessibleDescription(MOTIVO_REMOCAO_NAO_ENCONTRADO);
    await waitFor(() => expect(api.chamadasDe(ROTA_LISTA)).toHaveLength(2));
  });

  it('erro passageiro: mostra a mensagem e deixa remover de novo', async () => {
    api.responder(ROTA_REMOVER, problema(503, 'indisponivel'), semConteudo());
    const { usuario } = renderizar();
    const painel = await abrirRemover(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Remover domínio' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para indisponivel.');
    await usuario.click(within(painel).getByRole('button', { name: 'Remover domínio' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
