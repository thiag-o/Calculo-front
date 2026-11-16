import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChavesApi } from '.';
import { AVISO_CHAVE_UMA_VEZ, MENSAGEM_COPIA_FALHOU } from './DialogoNovaChave';
import { MENSAGEM_SEM_PERMISSAO } from './mensagens';
import {
  CHAVE_PORTAL,
  conteudoDoCache,
  definirCookieCsrf,
  json,
  problema,
  renderizarIntegracao,
  respostaPendente,
  simularApi,
  type ApiSimulada,
} from './integracao.test.apoio';

let api: ApiSimulada;

const ROTA_LISTA = 'GET /v1/chaves-api';
const ROTA_CRIAR = 'POST /v1/chaves-api';
const SEGREDO = 'fc_9xQ2segredo-inteiro-da-chave-de-api-0123456789';
const CRIADA = { id: '30000000-0000-0000-0000-000000000009', nome: 'Portal novo', prefixo: 'fc_9xQ2', chave: SEGREDO };
const NA_LISTA = {
  id: CRIADA.id,
  nome: CRIADA.nome,
  prefixo: CRIADA.prefixo,
  criada_em: CHAVE_PORTAL.criada_em,
  ultimo_uso_em: null,
  revogada_em: null,
};

beforeEach(() => {
  api = simularApi();
  api.responder(ROTA_LISTA, json({ itens: [CHAVE_PORTAL], proximo_cursor: null }));
  definirCookieCsrf('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar() {
  return renderizarIntegracao(<ChavesApi />);
}

async function abrirNova(usuario: UserEvent) {
  await screen.findByText('Portal do cliente');
  await usuario.click(screen.getByRole('button', { name: 'Nova chave de API' }));
  return screen.findByRole('dialog', { name: 'Nova chave de API' });
}

async function criar(usuario: UserEvent, painel: HTMLElement, nome = 'Portal novo') {
  await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), nome);
  await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));
}

describe('Integração: nova chave de API', () => {
  it('pede o nome antes de criar', async () => {
    const { usuario } = renderizar();
    const painel = await abrirNova(usuario);

    expect(painel).toHaveAccessibleDescription(
      'O backend do sistema hospedeiro usa a chave para pedir tokens de incorporação deste tenant.',
    );
    const nome = within(painel).getByRole('textbox', { name: 'Nome' });
    expect(nome).toHaveFocus();

    await usuario.type(nome, '   ');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByText('Informe o nome')).toBeInTheDocument();
    expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(api.chamadasDe(ROTA_CRIAR)).toHaveLength(0);
  });

  it('cria, mostra a chave uma vez com o aviso, copia e atualiza a lista', async () => {
    api.responder(ROTA_CRIAR, json(CRIADA, 201));
    const { usuario } = renderizar();
    const escrever = vi.spyOn(navigator.clipboard, 'writeText');
    const painel = await abrirNova(usuario);
    api.responder(ROTA_LISTA, json({ itens: [NA_LISTA, CHAVE_PORTAL], proximo_cursor: null }));

    await criar(usuario, painel, '  Portal novo  ');

    const campo = await within(painel).findByRole('textbox', { name: 'Chave' });
    expect(campo).toHaveValue(SEGREDO);
    expect(campo).toHaveAttribute('readonly');
    expect(campo).toHaveFocus();
    expect(campo).toHaveAccessibleDescription('Na lista, ela aparece só pelo começo: fc_9xQ2…');
    expect(within(painel).getByText(AVISO_CHAVE_UMA_VEZ)).toBeInTheDocument();
    expect(painel).toHaveAccessibleDescription(
      'Configure a chave Portal novo no backend do sistema hospedeiro, no cabeçalho Authorization: Chave <chave>.',
    );
    expect(within(painel).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();

    const [req] = api.chamadasDe(ROTA_CRIAR);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ nome: 'Portal novo' });

    await usuario.click(within(painel).getByRole('button', { name: 'Copiar' }));
    expect(escrever).toHaveBeenCalledWith(SEGREDO);
    expect(await navigator.clipboard.readText()).toBe(SEGREDO);
    expect(await within(painel).findByText('Chave copiada')).toBeInTheDocument();

    // A lista, atrás do diálogo, já tem a chave nova, só pelo prefixo.
    await waitFor(() => expect(api.chamadasDe(ROTA_LISTA)).toHaveLength(2));
    expect(await screen.findByText('fc_9xQ2…')).toBeInTheDocument();
  });

  it('ao fechar, a chave não fica em lugar nenhum: nem na tela, nem no cache; reabrir pede um nome', async () => {
    api.responder(ROTA_CRIAR, json(CRIADA, 201));
    const { usuario, queryClient } = renderizar();
    let painel = await abrirNova(usuario);
    api.responder(ROTA_LISTA, json({ itens: [NA_LISTA, CHAVE_PORTAL], proximo_cursor: null }));
    await criar(usuario, painel);
    await within(painel).findByRole('textbox', { name: 'Chave' });
    expect(conteudoDoCache(queryClient)).toContain(SEGREDO);

    // O "Fechar" do rodapé (o outro é o do canto do diálogo).
    await usuario.click(within(painel).getAllByRole('button', { name: 'Fechar' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.queryByDisplayValue(SEGREDO)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(SEGREDO);
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    await screen.findByText('fc_9xQ2…');
    expect(conteudoDoCache(queryClient)).not.toContain(SEGREDO);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova chave de API' })).toHaveFocus());

    painel = await abrirNova(usuario);
    expect(within(painel).queryByRole('textbox', { name: 'Chave' })).not.toBeInTheDocument();
    expect(within(painel).getByRole('textbox', { name: 'Nome' })).toHaveValue('');
  });

  it('fechar com Esc também descarta a chave', async () => {
    api.responder(ROTA_CRIAR, json(CRIADA, 201));
    const { usuario, queryClient } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);
    await within(painel).findByRole('textbox', { name: 'Chave' });

    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(conteudoDoCache(queryClient)).not.toContain(SEGREDO);
    expect(document.body.innerHTML).not.toContain(SEGREDO);
  });

  it('fechar antes da resposta chegar: a chave que chega depois também não fica', async () => {
    const pendente = respostaPendente(() => json(CRIADA, 201));
    api.responder(ROTA_CRIAR, pendente.promessa);
    const { usuario, queryClient } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);
    await waitFor(() => expect(within(painel).getByRole('button', { name: 'Salvar' })).toHaveAttribute('aria-busy', 'true'));

    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    pendente.liberar();

    // A lista é buscada de novo (a chave existe), mas o segredo não fica guardado.
    await waitFor(() => expect(api.chamadasDe(ROTA_LISTA)).toHaveLength(2));
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(conteudoDoCache(queryClient)).not.toContain(SEGREDO);
    expect(document.body.innerHTML).not.toContain(SEGREDO);
  });

  it('enquanto cria, o botão fica ocupado e o Enter não cria duas vezes', async () => {
    const pendente = respostaPendente(() => json(CRIADA, 201));
    api.responder(ROTA_CRIAR, pendente.promessa);
    const { usuario } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);

    const salvar = within(painel).getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(salvar).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(salvar);
    // O botão de envio fica no rodapé, fora do <form>: o Enter é simulado pelo submit do formulário.
    fireEvent.submit(painel.querySelector('form')!);
    expect(api.chamadasDe(ROTA_CRIAR)).toHaveLength(1);

    pendente.liberar();
    expect(await within(painel).findByRole('textbox', { name: 'Chave' })).toHaveValue(SEGREDO);
  });

  it('se não der para copiar, explica como copiar à mão', async () => {
    api.responder(ROTA_CRIAR, json(CRIADA, 201));
    const { usuario } = renderizar();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);
    await within(painel).findByRole('textbox', { name: 'Chave' });

    await usuario.click(within(painel).getByRole('button', { name: 'Copiar' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_COPIA_FALHOU);
    expect(within(painel).getByRole('textbox', { name: 'Chave' })).toHaveValue(SEGREDO);
  });

  it('dados_invalidos no nome: mostra o erro no campo', async () => {
    api.responder(ROTA_CRIAR, problema(422, 'dados_invalidos', { campos: { nome: 'O nome tem no máximo 100 caracteres.' } }));
    const { usuario } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);

    expect(await within(painel).findByText('O nome tem no máximo 100 caracteres.')).toBeInTheDocument();
    expect(within(painel).getByRole('textbox', { name: 'Nome' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(painel).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });

  it('sem permissão: explica', async () => {
    api.responder(ROTA_CRIAR, problema(403, 'sem_permissao'));
    const { usuario } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
  });

  it('erro passageiro: mostra a mensagem e deixa salvar de novo', async () => {
    api.responder(ROTA_CRIAR, problema(503, 'indisponivel'), json(CRIADA, 201));
    const { usuario } = renderizar();
    const painel = await abrirNova(usuario);
    await criar(usuario, painel);
    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));
    expect(await within(painel).findByRole('textbox', { name: 'Chave' })).toHaveValue(SEGREDO);
  });
});
