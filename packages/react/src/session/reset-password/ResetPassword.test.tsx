import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, json, problem, request, calledRoutes, simulateFetch, type SimulatedFetch } from '../api.test-support';
import { ResetPassword } from '..';
import { INVALID_LINK_MESSAGE, PASSWORD_SAVED_MESSAGE, expiryMessage } from './resetPasswordMessages';

const TOKEN = 'tok-redefinicao-123';
/** Minimum different from the default (12): the screen shows what the API says, not a fixed number. */
const validLink = { senha_minima: 10, expira_em: new Date(2026, 10, 17, 14, 30).toISOString() };

let simulatedFetch: SimulatedFetch;

beforeEach(() => {
  simulatedFetch = simulateFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Without options, opens with the link token; `{ token: undefined }` opens without a token. */
function renderScreen({ token }: { token?: string | null } = { token: TOKEN }) {
  const onSave = vi.fn();
  const user = userEvent.setup();
  const view = render(<ResetPassword apiUrl={API} theme="light" token={token} onSave={onSave} />);
  return { onSave, user, ...view };
}

const passwordField = () => screen.getByLabelText('Nova senha', { selector: 'input' });
const confirmationField = () => screen.getByLabelText('Repita a nova senha', { selector: 'input' });
const saveButton = () => screen.getByRole('button', { name: 'Salvar' });

/** Opens the screen with the valid link and waits for the form. */
async function openForm() {
  simulatedFetch.mockResolvedValueOnce(json(validLink));
  const result = renderScreen();
  await screen.findByLabelText('Nova senha', { selector: 'input' });
  return result;
}

async function fill(user: ReturnType<typeof userEvent.setup>, password: string, confirmation = password) {
  await user.type(passwordField(), password);
  await user.type(confirmationField(), confirmation);
}

describe('<ResetPassword> ao abrir', () => {
  it('verifica o link com o token no corpo e, enquanto isso, mostra o carregando sem formulário', async () => {
    let respond: (response: Response) => void = () => {};
    simulatedFetch.mockImplementation(() => new Promise<Response>((resolver) => (respond = resolver)));
    const { container } = renderScreen();

    expect(container.querySelector('.fc-root')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando o link');
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();

    await waitFor(() => expect(simulatedFetch).toHaveBeenCalledTimes(1));
    expect(calledRoutes(simulatedFetch)).toEqual(['POST /v1/redefinicao/verificacao']);
    const req = request(simulatedFetch);
    // The token does not go in the URL (it does not show in access logs).
    expect(req.url).not.toContain(TOKEN);
    expect(await req.json()).toEqual({ token: TOKEN });

    respond(json(validLink));
    expect(await screen.findByLabelText('Nova senha', { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByText('Verificando o link')).not.toBeInTheDocument();
  });

  it('mostra a senha mínima exata do link, a regra do e-mail e o prazo, com o foco na nova senha', async () => {
    await openForm();

    expect(screen.getByRole('region', { name: 'Nova senha' })).toBeInTheDocument();
    expect(passwordField()).toHaveAccessibleDescription('Pelo menos 10 caracteres. Não pode conter o seu e-mail.');
    expect(screen.getByText(/Este link vale até 17\/11 às 14:30\./)).toBeInTheDocument();
    expect(passwordField()).toHaveFocus();
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmationField()).toHaveAttribute('type', 'password');
    expect(confirmationField()).toHaveAttribute('autocomplete', 'new-password');
    expect(saveButton()).toBeEnabled();
  });

  it('link_invalido: diz que o link não vale mais e não mostra o formulário', async () => {
    simulatedFetch.mockResolvedValueOnce(problem(410, 'link_invalido'));
    renderScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_LINK_MESSAGE);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    // The message is the screen's, not the server text.
    expect(screen.queryByText(/Texto do servidor/)).not.toBeInTheDocument();
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sem token', undefined],
    ['token nulo', null],
    ['token vazio', ''],
  ])('%s: mostra o link inválido sem consultar a API', (_case, token) => {
    renderScreen({ token });

    expect(screen.getByRole('alert')).toHaveTextContent(INVALID_LINK_MESSAGE);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(simulatedFetch).not.toHaveBeenCalled();
  });

  it('outra falha da verificação: mostra o erro e "Tentar de novo" consulta de novo', async () => {
    simulatedFetch.mockResolvedValueOnce(problem(415, 'tipo_conteudo_invalido')).mockResolvedValueOnce(json(validLink));
    const { user } = renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível verificar o link');
    expect(alert).toHaveTextContent('Texto do servidor para tipo_conteudo_invalido.');
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByLabelText('Nova senha', { selector: 'input' })).toBeInTheDocument();
    expect(calledRoutes(simulatedFetch)).toEqual(['POST /v1/redefinicao/verificacao', 'POST /v1/redefinicao/verificacao']);
  });
});

describe('<ResetPassword> ao salvar', () => {
  it('com sucesso, envia o token e a nova senha (sem tirar espaços), mostra a confirmação e chama o onSalvar', async () => {
    const { user, onSave } = await openForm();
    simulatedFetch.mockResolvedValueOnce(noContent());

    await fill(user, ' senha nova 1 ');
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(calledRoutes(simulatedFetch)).toEqual(['POST /v1/redefinicao/verificacao', 'POST /v1/redefinicao']);
    expect(await request(simulatedFetch, 1).json()).toEqual({ token: TOKEN, nova_senha: ' senha nova 1 ' });

    const confirmation = screen.getByRole('status');
    expect(confirmation).toHaveTextContent(PASSWORD_SAVED_MESSAGE);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    // The button is gone: focus goes to the message.
    expect(confirmation.parentElement).toHaveFocus();
  });

  it('envia pelo Enter no campo de confirmação', async () => {
    const { user, onSave } = await openForm();
    simulatedFetch.mockResolvedValueOnce(noContent());

    await fill(user, 'senha-segura', 'senha-segura{Enter}');

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('campos vazios: não envia, marca os dois e foca a nova senha', async () => {
    const { user, onSave } = await openForm();

    await user.click(saveButton());

    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAccessibleDescription(/^Informe a nova senha/);
    expect(confirmationField()).toHaveAttribute('aria-invalid', 'true');
    expect(confirmationField()).toHaveAccessibleDescription('Repita a nova senha');
    expect(passwordField()).toHaveFocus();
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('senha menor que o mínimo do link: não envia e diz o mínimo, contando caracteres e não unidades UTF-16', async () => {
    const { user } = await openForm();

    // 9 characters outside the basic plane: 18 UTF-16 units, but 9 characters for the server.
    const short = '𝔸'.repeat(9);
    await fill(user, short);
    await user.click(saveButton());

    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAccessibleDescription(/^Use pelo menos 10 caracteres/);
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });

  it('confirmação diferente: não envia e marca a confirmação', async () => {
    const { user } = await openForm();

    await fill(user, 'senha-segura', 'senha-segurx');
    await user.click(saveButton());

    expect(passwordField()).not.toHaveAttribute('aria-invalid');
    expect(confirmationField()).toHaveAttribute('aria-invalid', 'true');
    expect(confirmationField()).toHaveAccessibleDescription('As senhas estão diferentes. Digite a mesma senha nos dois campos');
    expect(confirmationField()).toHaveFocus();
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });

  it('enquanto salva, o botão fica carregando e não envia de novo', async () => {
    const { user, onSave } = await openForm();
    let respond: (response: Response) => void = () => {};
    simulatedFetch.mockImplementationOnce(() => new Promise<Response>((resolver) => (respond = resolver)));

    await fill(user, 'senha-segura');
    await user.click(saveButton());

    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-busy', 'true'));
    await user.click(saveButton());
    await user.keyboard('{Enter}');
    expect(simulatedFetch).toHaveBeenCalledTimes(2);

    respond(noContent());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('senha_invalida: põe a regra que o servidor recusou (ex.: o e-mail) no campo da nova senha', async () => {
    const { user, onSave } = await openForm();
    simulatedFetch.mockResolvedValueOnce(
      problem(422, 'senha_invalida', { campos: { nova_senha: 'A senha não pode conter o seu e-mail.' } }),
    );

    await fill(user, 'ana@exemplo.com-1');
    await user.click(saveButton());

    await waitFor(() => expect(passwordField()).toHaveAttribute('aria-invalid', 'true'));
    expect(passwordField()).toHaveAccessibleDescription(/^A senha não pode conter o seu e-mail\./);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('senha_invalida sem o erro do campo: mostra a mensagem do servidor numa nota', async () => {
    const { user } = await openForm();
    simulatedFetch.mockResolvedValueOnce(problem(422, 'senha_invalida'));

    await fill(user, 'senha-segura');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para senha_invalida.');
    expect(passwordField()).toBeInTheDocument();
  });

  it('link_invalido no envio (venceu enquanto a pessoa digitava): troca o formulário pela mensagem e foca nela', async () => {
    const { user, onSave } = await openForm();
    simulatedFetch.mockResolvedValueOnce(problem(410, 'link_invalido'));

    await fill(user, 'senha-segura');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(INVALID_LINK_MESSAGE);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(alert.parentElement).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sem conexão: diz que não falou com o servidor e deixa tentar de novo', async () => {
    const { user, onSave } = await openForm();
    simulatedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(noContent());

    await fill(user, 'senha-segura');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.');

    await user.click(saveButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('expiryMessage', () => {
  it('dia e hora no fuso local', () => {
    expect(expiryMessage(new Date(2026, 0, 5, 9, 7).toISOString())).toBe('Este link vale até 05/01 às 09:07.');
  });

  it('sem data válida, nada', () => {
    expect(expiryMessage('não é data')).toBeUndefined();
  });
});
