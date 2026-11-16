import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_COPIA_FALHOU, textoValidade } from './DialogoLinkRedefinicao';
import {
  MENSAGEM_SEM_PERMISSAO,
  MENSAGEM_USUARIO_EXTERNO,
  MENSAGEM_USUARIO_INATIVO,
  MENSAGEM_USUARIO_NAO_ENCONTRADO,
} from './mensagens';
import {
  ANA,
  BRUNO,
  definirCookieCsrf,
  json,
  problema,
  renderizarUsuarios,
  respostaPendente,
  simularApi,
  type ApiSimulada,
} from './usuarios.test.apoio';

let api: ApiSimulada;

const LINK = 'https://casca.exemplo.com/redefinir?token=tok-uso-unico-123';
const ROTA_LINK = `POST /v1/usuarios/${BRUNO.id}/redefinicao`;

/** Data local (no fuso de quem roda o teste), em ISO/UTC como a API manda. */
function isoLocal(ano: number, mes: number, dia: number, hora: number, minuto: number): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}
const EXPIRA_EM = isoLocal(2026, 11, 16, 14, 30);

beforeEach(() => {
  api = simularApi();
  api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO], proximo_cursor: null }));
  definirCookieCsrf('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function abrirLink(usuario: UserEvent) {
  await screen.findByText('Bruno Figueiredo de Albuquerque');
  await usuario.click(screen.getByRole('button', { name: 'Mais ações para Bruno Figueiredo de Albuquerque' }));
  await usuario.click(await screen.findByRole('menuitem', { name: 'Gerar link de redefinição' }));
  return screen.findByRole('dialog', { name: 'Link de redefinição' });
}

describe('Usuários: gerar link de redefinição', () => {
  it('pede confirmação antes de gerar e não chama a API ao abrir', async () => {
    const { usuario } = renderizarUsuarios();
    const painel = await abrirLink(usuario);

    expect(painel).toHaveAccessibleDescription(
      'Gera um link de uso único para Bruno Figueiredo de Albuquerque definir a senha. Um link novo invalida os anteriores.',
    );
    // O foco começa no primeiro botão (Cancelar): Enter sem querer não invalida o link anterior.
    expect(within(painel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(api.chamadasDe(ROTA_LINK)).toHaveLength(0);

    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(ROTA_LINK)).toHaveLength(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mais ações para Bruno Figueiredo de Albuquerque' })).toHaveFocus(),
    );
  });

  it('gera, mostra o link uma vez com a validade e copia', async () => {
    api.responder(ROTA_LINK, json({ link: LINK, expira_em: EXPIRA_EM }, 201));
    const { usuario } = renderizarUsuarios();
    const escrever = vi.spyOn(navigator.clipboard, 'writeText');
    const painel = await abrirLink(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));

    const campo = await within(painel).findByRole('textbox', { name: 'Link' });
    expect(campo).toHaveValue(LINK);
    expect(campo).toHaveAttribute('readonly');
    expect(campo).toHaveFocus();
    expect(campo).toHaveAccessibleDescription('Válido até 16/11, 14:30. Funciona uma vez só.');
    expect(within(painel).getByText('Copie o link agora: ele não será mostrado de novo.')).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Gerar link de redefinição' })).not.toBeInTheDocument();

    const [req] = api.chamadasDe(ROTA_LINK);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');

    await usuario.click(within(painel).getByRole('button', { name: 'Copiar' }));
    expect(escrever).toHaveBeenCalledWith(LINK);
    expect(await navigator.clipboard.readText()).toBe(LINK);
    expect(await within(painel).findByText('Link copiado')).toBeInTheDocument();
  });

  it('ao fechar, o link some: reabrir pede para gerar de novo', async () => {
    api.responder(ROTA_LINK, json({ link: LINK, expira_em: EXPIRA_EM }, 201));
    const { usuario, queryClient } = renderizarUsuarios();
    let painel = await abrirLink(usuario);
    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));
    await within(painel).findByRole('textbox', { name: 'Link' });

    // O "Fechar" do rodapé (o outro é o do canto do diálogo).
    await usuario.click(within(painel).getAllByRole('button', { name: 'Fechar' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue(LINK)).not.toBeInTheDocument();
    // Nem no cache de consultas nem no de mutações.
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((consulta) => consulta.state.data))).not.toContain('tok-uso-unico');

    painel = await abrirLink(usuario);
    expect(within(painel).queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Gerar link de redefinição' })).toBeInTheDocument();
  });

  it('enquanto gera, o botão fica ocupado e não gera duas vezes', async () => {
    const pendente = respostaPendente(() => json({ link: LINK, expira_em: EXPIRA_EM }, 201));
    api.responder(ROTA_LINK, pendente.promessa);
    const { usuario } = renderizarUsuarios();
    const painel = await abrirLink(usuario);

    const gerar = within(painel).getByRole('button', { name: 'Gerar link de redefinição' });
    await usuario.click(gerar);
    await waitFor(() => expect(gerar).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(gerar);
    expect(api.chamadasDe(ROTA_LINK)).toHaveLength(1);

    pendente.liberar();
    expect(await within(painel).findByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });

  it('se não der para copiar, explica como copiar à mão', async () => {
    api.responder(ROTA_LINK, json({ link: LINK, expira_em: EXPIRA_EM }, 201));
    const { usuario } = renderizarUsuarios();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    const painel = await abrirLink(usuario);
    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));
    await within(painel).findByRole('textbox', { name: 'Link' });

    await usuario.click(within(painel).getByRole('button', { name: 'Copiar' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_COPIA_FALHOU);
    expect(within(painel).getByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });

  it.each([
    ['usuario_inativo', 409, MENSAGEM_USUARIO_INATIVO],
    ['usuario_externo', 409, MENSAGEM_USUARIO_EXTERNO],
    ['nao_encontrado', 404, MENSAGEM_USUARIO_NAO_ENCONTRADO],
  ])('%s: explica, não oferece gerar de novo e atualiza a lista', async (codigo, status, mensagem) => {
    api.responder(ROTA_LINK, problema(status, codigo));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirLink(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent(mensagem);
    const gerar = within(painel).getByRole('button', { name: 'Gerar link de redefinição' });
    expect(gerar).toHaveAttribute('aria-disabled', 'true');
    expect(gerar).toHaveAccessibleDescription('Feche e confira o usuário na lista atualizada');
    await waitFor(() => expect(api.chamadasDe('GET /v1/usuarios')).toHaveLength(2));
  });

  it('sem permissão: explica', async () => {
    api.responder(ROTA_LINK, problema(403, 'sem_permissao'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirLink(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
  });

  it('erro passageiro: mostra a mensagem e deixa gerar de novo', async () => {
    api.responder(ROTA_LINK, problema(503, 'indisponivel'), json({ link: LINK, expira_em: EXPIRA_EM }, 201));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirLink(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(within(painel).getByRole('button', { name: 'Gerar link de redefinição' }));
    expect(await within(painel).findByRole('textbox', { name: 'Link' })).toHaveValue(LINK);
  });
});

describe('textoValidade', () => {
  it('formata no padrão brasileiro e tolera data inválida', () => {
    expect(textoValidade(isoLocal(2026, 1, 5, 9, 5))).toBe('Válido até 05/01, 09:05. Funciona uma vez só.');
    expect(textoValidade('não é data')).toBe('Funciona uma vez só.');
  });
});
