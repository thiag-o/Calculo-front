import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChavesApi } from '.';
import { MOTIVO_REVOGACAO_NAO_ENCONTRADA } from './DialogoRevogarChave';
import { MENSAGEM_CHAVE_NAO_ENCONTRADA, MENSAGEM_SEM_PERMISSAO } from './mensagens';
import {
  CHAVE_ANTIGA,
  CHAVE_ERP,
  CHAVE_PORTAL,
  CHAVES,
  definirCookieCsrf,
  json,
  problema,
  renderizarIntegracao,
  respostaPendente,
  semConteudo,
  simularApi,
  type ApiSimulada,
} from './integracao.test.apoio';

let api: ApiSimulada;

const ROTA_LISTA = 'GET /v1/chaves-api';
const ROTA_REVOGAR = `DELETE /v1/chaves-api/${CHAVE_PORTAL.id}`;

beforeEach(() => {
  api = simularApi();
  definirCookieCsrf('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar() {
  return renderizarIntegracao(<ChavesApi />);
}

function linhaDe(nome: string): HTMLElement {
  return screen.getByText(nome).closest('tr')!;
}

describe('Integração: lista de chaves de API', () => {
  it('mostra nome e prefixo, criada, último uso e situação, com as revogadas', async () => {
    api.responder(ROTA_LISTA, json({ itens: CHAVES, proximo_cursor: null }));
    renderizar();

    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(screen.getByText('3 chaves · 1 revogada')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Chaves de API do tenant' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual([
      'Chave',
      'Criada',
      'Último uso',
      'Situação',
      'Ações',
    ]);

    const portal = within(linhaDe('Portal do cliente'));
    expect(portal.getByText('fc_3k9Q…')).toBeInTheDocument();
    expect(portal.getByText('02/11/2026')).toBeInTheDocument();
    expect(portal.getByText('15/11/2026 às 09:05')).toBeInTheDocument();
    expect(portal.getByText('Ativa')).toBeInTheDocument();

    const erp = within(linhaDe(CHAVE_ERP.nome));
    expect(erp.getByText('Nunca usada')).toBeInTheDocument();

    const antiga = within(linhaDe('Portal antigo'));
    expect(antiga.getByText('fc_a0b1…')).toBeInTheDocument();
    expect(antiga.getByText('01/03/2026 às 18:30')).toBeInTheDocument();
    expect(antiga.getByText('Revogada')).toBeInTheDocument();
    expect(antiga.getByText('em 02/03/2026')).toBeInTheDocument();
    expect(antiga.queryByText('Ativa')).not.toBeInTheDocument();
  });

  it('a lista nunca mostra a chave inteira, só o prefixo', async () => {
    api.responder(ROTA_LISTA, json({ itens: [CHAVE_PORTAL], proximo_cursor: null }));
    renderizar();
    await screen.findByText('Portal do cliente');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('1 chave')).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pendente = respostaPendente(() => json({ itens: [CHAVE_PORTAL], proximo_cursor: null }));
    api.responder(ROTA_LISTA, pendente.promessa);
    renderizar();

    expect(screen.getByRole('table', { name: 'Chaves de API do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando chaves de api do tenant');
    expect(screen.getByText('Para o backend do sistema hospedeiro pedir tokens de incorporação')).toBeInTheDocument();

    pendente.liberar();
    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
  });

  it('vazio: diz o que falta e oferece criar a primeira chave', async () => {
    api.responder(ROTA_LISTA, json({ itens: [], proximo_cursor: null }));
    const { usuario } = renderizar();

    expect(await screen.findByText('Nenhuma chave de API ainda')).toBeInTheDocument();
    expect(screen.getByText('Crie uma chave para o sistema hospedeiro incorporar o módulo.')).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: 'Nova chave de API' });
    expect(botoes).toHaveLength(2);

    await usuario.click(botoes[1]!);
    expect(await screen.findByRole('dialog', { name: 'Nova chave de API' })).toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.responder(ROTA_LISTA, problema(503, 'indisponivel'), json({ itens: [CHAVE_PORTAL], proximo_cursor: null }));
    const { usuario } = renderizar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar as chaves de API');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.responder(ROTA_LISTA, problema(403, 'sem_permissao'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('pagina por cursor com "Carregar mais chaves"', async () => {
    api.responder(
      ROTA_LISTA,
      json({ itens: [CHAVE_PORTAL, CHAVE_ERP], proximo_cursor: 'cursor-2' }),
      json({ itens: [CHAVE_ANTIGA], proximo_cursor: null }),
    );
    const { usuario } = renderizar();

    await screen.findByText('Portal do cliente');
    expect(screen.getByText('Mais de 2 chaves')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais chaves' }));

    expect(await screen.findByText('Portal antigo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais chaves' })).not.toBeInTheDocument();
    const [primeira, segunda] = api.chamadasDe(ROTA_LISTA);
    expect(new URL(primeira!.url).searchParams.get('cursor')).toBeNull();
    expect(new URL(segunda!.url).searchParams.get('cursor')).toBe('cursor-2');
  });

  it('erro ao carregar a próxima página: a lista fica e dá para tentar de novo', async () => {
    api.responder(
      ROTA_LISTA,
      json({ itens: [CHAVE_PORTAL], proximo_cursor: 'cursor-2' }),
      problema(503, 'indisponivel'),
      json({ itens: [CHAVE_ANTIGA], proximo_cursor: null }),
    );
    const { usuario } = renderizar();

    await screen.findByText('Portal do cliente');
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais chaves' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais chaves');
    expect(screen.getByText('Portal do cliente')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Portal antigo')).toBeInTheDocument();
  });
});

async function abrirRevogar(usuario: UserEvent, nome = 'Portal do cliente') {
  await screen.findByText(nome);
  await usuario.click(screen.getByRole('button', { name: `Mais ações para a chave ${nome}` }));
  await usuario.click(await screen.findByRole('menuitem', { name: 'Revogar chave' }));
  return screen.findByRole('dialog', { name: 'Revogar chave' });
}

describe('Integração: revogar chave', () => {
  beforeEach(() => {
    api.responder(ROTA_LISTA, json({ itens: CHAVES, proximo_cursor: null }));
  });

  it('pede confirmação e cancelar não revoga; o foco volta ao "…" da linha', async () => {
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario);

    expect(painel).toHaveAccessibleDescription(
      'A chave Portal do cliente (fc_3k9Q…) para de funcionar: o sistema que a usa não consegue mais pedir tokens de incorporação. Não dá para desfazer.',
    );
    expect(within(painel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_REVOGAR)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para a chave Portal do cliente' })).toHaveFocus());
  });

  it('revoga com CSRF, fecha, atualiza a lista e devolve o foco à linha', async () => {
    const revogada = { ...CHAVE_PORTAL, revogada_em: CHAVE_ANTIGA.revogada_em };
    api.responder(ROTA_REVOGAR, semConteudo());
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario);
    api.responder(ROTA_LISTA, json({ itens: [revogada, CHAVE_ERP, CHAVE_ANTIGA], proximo_cursor: null }));

    await usuario.click(within(painel).getByRole('button', { name: 'Revogar chave' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.chamadasDe(ROTA_REVOGAR);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await screen.findByText('3 chaves · 2 revogadas')).toBeInTheDocument();
    expect(within(linhaDe('Portal do cliente')).getByText('Revogada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para a chave Portal do cliente' })).toHaveFocus());
  });

  it('enquanto revoga, o botão fica ocupado e não revoga duas vezes', async () => {
    const pendente = respostaPendente(() => semConteudo());
    api.responder(ROTA_REVOGAR, pendente.promessa);
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario);

    const revogar = within(painel).getByRole('button', { name: 'Revogar chave' });
    await usuario.click(revogar);
    await waitFor(() => expect(revogar).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(revogar);
    expect(api.chamadasDe(ROTA_REVOGAR)).toHaveLength(1);

    pendente.liberar();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('chave revogada: o item fica desabilitado com o motivo', async () => {
    const { usuario } = renderizar();
    await screen.findByText('Portal antigo');
    await usuario.click(screen.getByRole('button', { name: 'Mais ações para a chave Portal antigo' }));

    const item = await screen.findByRole('menuitem', { name: 'Revogar chave' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('A chave já foi revogada em 02/03/2026');
    await usuario.click(item);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nao_encontrado: explica, não oferece revogar de novo e atualiza a lista', async () => {
    api.responder(`DELETE /v1/chaves-api/${CHAVE_ERP.id}`, problema(404, 'nao_encontrado'));
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario, CHAVE_ERP.nome);

    await usuario.click(within(painel).getByRole('button', { name: 'Revogar chave' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_CHAVE_NAO_ENCONTRADA);
    const revogar = within(painel).getByRole('button', { name: 'Revogar chave' });
    expect(revogar).toHaveAttribute('aria-disabled', 'true');
    expect(revogar).toHaveAccessibleDescription(MOTIVO_REVOGACAO_NAO_ENCONTRADA);
    await waitFor(() => expect(api.chamadasDe(ROTA_LISTA)).toHaveLength(2));
  });

  it('sem permissão: explica', async () => {
    api.responder(ROTA_REVOGAR, problema(403, 'sem_permissao'));
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Revogar chave' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
  });

  it('erro passageiro: mostra a mensagem e deixa revogar de novo', async () => {
    api.responder(ROTA_REVOGAR, problema(503, 'indisponivel'), semConteudo());
    const { usuario } = renderizar();
    const painel = await abrirRevogar(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Revogar chave' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(within(painel).getByRole('button', { name: 'Revogar chave' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_REVOGAR)).toHaveLength(2);
  });
});
