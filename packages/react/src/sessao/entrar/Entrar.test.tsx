import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, json, problema, requisicao, rotasChamadas, sessaoMatriz, simularFetch, type FetchSimulado } from '../api.test.apoio';
import { Entrar } from '..';
import { MENSAGEM_CREDENCIAIS_INVALIDAS, MENSAGEM_MUITAS_TENTATIVAS, mensagemBloqueio } from './mensagemErroLogin';

let fetchSimulado: FetchSimulado;

beforeEach(() => {
  fetchSimulado = simularFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar() {
  const onEntrar = vi.fn();
  const usuario = userEvent.setup();
  const tela = render(<Entrar apiUrl={API} tema="claro" onEntrar={onEntrar} />);
  return { onEntrar, usuario, ...tela };
}

const campoEmail = () => screen.getByRole('textbox', { name: 'E-mail' });
const campoSenha = () => screen.getByLabelText('Senha');
const botaoEntrar = () => screen.getByRole('button', { name: 'Entrar' });

async function preencher(usuario: ReturnType<typeof userEvent.setup>, email = 'ana@exemplo.com', senha = 'senha-segura-123') {
  await usuario.type(campoEmail(), email);
  await usuario.type(campoSenha(), senha);
}

/** Data local (no fuso de quem roda o teste), em ISO/UTC como a API manda. */
function isoLocal(ano: number, mes: number, dia: number, hora: number, minuto: number): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

describe('<Entrar>', () => {
  it('mostra a tela dentro da raiz do módulo, com título, campos e o foco no e-mail', () => {
    const { container } = renderizar();

    const raiz = container.querySelector('.fc-raiz');
    expect(raiz).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('region', { name: 'Fluxo de Cálculo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Fluxo de Cálculo' })).toBeInTheDocument();
    expect(campoEmail()).toHaveFocus();
    expect(campoEmail()).toHaveAttribute('type', 'email');
    expect(campoEmail()).toHaveAttribute('autocomplete', 'username');
    expect(campoSenha()).toHaveAttribute('type', 'password');
    expect(campoSenha()).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByText(/Esqueceu a senha\?/)).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('com sucesso, envia e-mail e senha e entrega a sessão ao onEntrar', async () => {
    fetchSimulado.mockResolvedValue(json(sessaoMatriz));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    await waitFor(() => expect(onEntrar).toHaveBeenCalledWith(sessaoMatriz));
    expect(rotasChamadas(fetchSimulado)).toEqual(['POST /v1/sessao']);
    const req = requisicao(fetchSimulado);
    expect(req.credentials).toBe('include');
    expect(await req.json()).toEqual({ email: 'ana@exemplo.com', senha: 'senha-segura-123' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('envia pelo Enter no campo de senha', async () => {
    fetchSimulado.mockResolvedValue(json(sessaoMatriz));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario);
    await usuario.keyboard('{Enter}');

    await waitFor(() => expect(onEntrar).toHaveBeenCalledTimes(1));
    expect(rotasChamadas(fetchSimulado)).toEqual(['POST /v1/sessao']);
  });

  it('envia pelo Enter no campo de e-mail', async () => {
    fetchSimulado.mockResolvedValue(json(sessaoMatriz));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario);
    await usuario.click(campoEmail());
    await usuario.keyboard('{Enter}');

    await waitFor(() => expect(onEntrar).toHaveBeenCalledTimes(1));
  });

  it('tira os espaços das pontas do e-mail, mas não da senha', async () => {
    fetchSimulado.mockResolvedValue(json(sessaoMatriz));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario, '  ana@exemplo.com ', ' senha com espaço ');
    await usuario.keyboard('{Enter}');

    await waitFor(() => expect(onEntrar).toHaveBeenCalled());
    expect(await requisicao(fetchSimulado).json()).toEqual({ email: 'ana@exemplo.com', senha: ' senha com espaço ' });
  });

  it('campos obrigatórios: sem e-mail nem senha, não envia, marca os dois e foca o e-mail', async () => {
    const { usuario, onEntrar } = renderizar();

    await usuario.click(botaoEntrar());

    expect(campoEmail()).toHaveAttribute('aria-invalid', 'true');
    expect(campoEmail()).toHaveAccessibleDescription('Informe o e-mail');
    expect(campoSenha()).toHaveAttribute('aria-invalid', 'true');
    expect(campoSenha()).toHaveAccessibleDescription('Informe a senha');
    expect(campoEmail()).toHaveFocus();
    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(onEntrar).not.toHaveBeenCalled();
  });

  it('campos obrigatórios: e-mail só com espaços conta como vazio; falta só a senha, foca a senha', async () => {
    const { usuario } = renderizar();

    await usuario.type(campoEmail(), '   ');
    await usuario.keyboard('{Enter}');
    expect(campoEmail()).toHaveAccessibleDescription('Informe o e-mail');

    await usuario.clear(campoEmail());
    await usuario.type(campoEmail(), 'ana@exemplo.com');
    await usuario.keyboard('{Enter}');

    expect(campoEmail()).not.toHaveAttribute('aria-invalid');
    expect(campoSenha()).toHaveAccessibleDescription('Informe a senha');
    expect(campoSenha()).toHaveFocus();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('enquanto entra, o botão fica carregando e não envia de novo', async () => {
    let responder: (resposta: Response) => void = () => {};
    fetchSimulado.mockImplementation(() => new Promise<Response>((resolver) => (responder = resolver)));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    await waitFor(() => expect(botaoEntrar()).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(botaoEntrar());
    await usuario.keyboard('{Enter}');
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    responder(json(sessaoMatriz));
    await waitFor(() => expect(onEntrar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(botaoEntrar()).not.toHaveAttribute('aria-busy'));
  });

  it('credenciais_invalidas: mostra a mensagem genérica, não o texto do servidor', async () => {
    fetchSimulado.mockResolvedValue(problema(401, 'credenciais_invalidas'));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAGEM_CREDENCIAIS_INVALIDAS);
    expect(alerta).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.queryByText(/Texto do servidor/)).not.toBeInTheDocument();
    expect(onEntrar).not.toHaveBeenCalled();
    // A mensagem não acusa um campo só (não revela se o e-mail existe).
    expect(campoEmail()).not.toHaveAttribute('aria-invalid');
    expect(campoSenha()).not.toHaveAttribute('aria-invalid');
  });

  it('login_bloqueado: diz a hora em que dá para tentar de novo (HH:MM no fuso local)', async () => {
    const hoje = new Date();
    const desbloqueio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 14, 30);
    fetchSimulado.mockResolvedValue(problema(423, 'login_bloqueado', { desbloqueia_em: desbloqueio.toISOString() }));
    const { usuario } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('O login deste e-mail foi bloqueado depois de várias tentativas erradas. Tente de novo às 14:30.');
  });

  it('muitas_tentativas: pede para esperar um pouco', async () => {
    fetchSimulado.mockResolvedValue(problema(429, 'muitas_tentativas'));
    const { usuario } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_MUITAS_TENTATIVAS);
    expect(screen.getByRole('alert')).toHaveTextContent('Espere um pouco e tente de novo.');
  });

  it('dados_invalidos: põe o erro de cada campo no campo', async () => {
    fetchSimulado.mockResolvedValue(problema(422, 'dados_invalidos', { campos: { email: 'Informe um e-mail com até 254 caracteres.' } }));
    const { usuario } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
    expect(campoEmail()).toHaveAttribute('aria-invalid', 'true');
    expect(campoEmail()).toHaveAccessibleDescription('Informe um e-mail com até 254 caracteres.');
  });

  it('sem conexão: diz que não falou com o servidor', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    const { usuario } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.');
  });

  it('outro erro com codigo (tipo_conteudo_invalido): usa a mensagem em pt-BR do servidor', async () => {
    fetchSimulado.mockResolvedValue(problema(415, 'tipo_conteudo_invalido'));
    const { usuario } = renderizar();

    await preencher(usuario);
    await usuario.click(botaoEntrar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para tipo_conteudo_invalido.');
  });

  it('depois de um erro, uma nova tentativa que dá certo tira a mensagem', async () => {
    fetchSimulado.mockResolvedValueOnce(problema(401, 'credenciais_invalidas')).mockResolvedValueOnce(json(sessaoMatriz));
    const { usuario, onEntrar } = renderizar();

    await preencher(usuario, 'ana@exemplo.com', 'errada-errada');
    await usuario.click(botaoEntrar());
    await screen.findByRole('alert');

    await usuario.clear(campoSenha());
    await usuario.type(campoSenha(), 'senha-segura-123{Enter}');

    await waitFor(() => expect(onEntrar).toHaveBeenCalledWith(sessaoMatriz));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('mensagemBloqueio', () => {
  it('no mesmo dia, só a hora', () => {
    const agora = new Date(2026, 10, 15, 14, 15);
    expect(mensagemBloqueio(isoLocal(2026, 11, 15, 14, 30), agora)).toMatch(/Tente de novo às 14:30\.$/);
  });

  it('em outro dia (perto da meia-noite), a hora e a data', () => {
    const agora = new Date(2026, 10, 15, 23, 55);
    expect(mensagemBloqueio(isoLocal(2026, 11, 16, 0, 10), agora)).toMatch(/Tente de novo às 00:10 de 16\/11\.$/);
  });

  it('sem data válida, "mais tarde"', () => {
    expect(mensagemBloqueio(undefined)).toMatch(/Tente de novo mais tarde\.$/);
    expect(mensagemBloqueio('não é data')).toMatch(/Tente de novo mais tarde\.$/);
  });
});
