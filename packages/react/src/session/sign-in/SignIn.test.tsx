import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, json, problem, request, calledRoutes, headquartersSession, simulateFetch, type SimulatedFetch } from '../api.test-support';
import { SignIn } from '..';
import { INVALID_CREDENTIALS_MESSAGE, TOO_MANY_ATTEMPTS_MESSAGE, lockMessage } from './signInErrorMessage';

let simulatedFetch: SimulatedFetch;

beforeEach(() => {
  simulatedFetch = simulateFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderScreen() {
  const onSignIn = vi.fn();
  const user = userEvent.setup({ delay: null });
  const view = render(<SignIn apiUrl={API} theme="light" onSignIn={onSignIn} />);
  return { onSignIn, user, ...view };
}

const emailField = () => screen.getByRole('textbox', { name: 'E-mail' });
const passwordField = () => screen.getByLabelText('Senha');
const signInButton = () => screen.getByRole('button', { name: 'Entrar' });

async function fill(user: ReturnType<typeof userEvent.setup>, email = 'ana@exemplo.com', password = 'senha-segura-123') {
  await user.click(emailField());
  await user.paste(email);
  await user.click(passwordField());
  await user.paste(password);
}

/** Local date (in the time zone of whoever runs the test), as ISO/UTC like the API sends. */
function localIso(year: number, month: number, day: number, time: number, minute: number): string {
  return new Date(year, month - 1, day, time, minute).toISOString();
}

describe('<SignIn>', () => {
  it('mostra a tela dentro da raiz do módulo, com título, campos e o foco no e-mail', () => {
    const { container } = renderScreen();

    const root = container.querySelector('.fc-root');
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('region', { name: 'Fluxo de Cálculo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Fluxo de Cálculo' })).toBeInTheDocument();
    expect(emailField()).toHaveFocus();
    expect(emailField()).toHaveAttribute('type', 'email');
    expect(emailField()).toHaveAttribute('autocomplete', 'username');
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByText(/Esqueceu a senha\?/)).toBeInTheDocument();
    expect(simulatedFetch).not.toHaveBeenCalled();
  });

  it('com sucesso, envia e-mail e senha e entrega a sessão ao onSignIn', async () => {
    simulatedFetch.mockResolvedValue(json(headquartersSession));
    const { user, onSignIn } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith(headquartersSession));
    expect(calledRoutes(simulatedFetch)).toEqual(['POST /v1/session']);
    const req = request(simulatedFetch);
    expect(req.credentials).toBe('include');
    expect(await req.json()).toEqual({ email: 'ana@exemplo.com', password: 'senha-segura-123' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('envia pelo Enter no campo de senha', async () => {
    simulatedFetch.mockResolvedValue(json(headquartersSession));
    const { user, onSignIn } = renderScreen();

    await fill(user);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSignIn).toHaveBeenCalledTimes(1));
    expect(calledRoutes(simulatedFetch)).toEqual(['POST /v1/session']);
  });

  it('envia pelo Enter no campo de e-mail', async () => {
    simulatedFetch.mockResolvedValue(json(headquartersSession));
    const { user, onSignIn } = renderScreen();

    await fill(user);
    await user.click(emailField());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSignIn).toHaveBeenCalledTimes(1));
  });

  it('tira os espaços das pontas do e-mail, mas não da senha', async () => {
    simulatedFetch.mockResolvedValue(json(headquartersSession));
    const { user, onSignIn } = renderScreen();

    await fill(user, '  ana@exemplo.com ', ' senha com espaço ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSignIn).toHaveBeenCalled());
    expect(await request(simulatedFetch).json()).toEqual({ email: 'ana@exemplo.com', password: ' senha com espaço ' });
  });

  it('campos obrigatórios: sem e-mail nem senha, não envia, marca os dois e foca o e-mail', async () => {
    const { user, onSignIn } = renderScreen();

    await user.click(signInButton());

    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveAccessibleDescription('Informe o e-mail');
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAccessibleDescription('Informe a senha');
    expect(emailField()).toHaveFocus();
    expect(simulatedFetch).not.toHaveBeenCalled();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('campos obrigatórios: e-mail só com espaços conta como vazio; falta só a senha, foca a senha', async () => {
    const { user } = renderScreen();

    await user.click(emailField());
    await user.paste('   ');
    await user.keyboard('{Enter}');
    expect(emailField()).toHaveAccessibleDescription('Informe o e-mail');

    await user.clear(emailField());
    await user.click(emailField());
    await user.paste('ana@exemplo.com');
    await user.keyboard('{Enter}');

    expect(emailField()).not.toHaveAttribute('aria-invalid');
    expect(passwordField()).toHaveAccessibleDescription('Informe a senha');
    expect(passwordField()).toHaveFocus();
    expect(simulatedFetch).not.toHaveBeenCalled();
  });

  it('enquanto entra, o botão fica carregando e não envia de novo', async () => {
    let respond: (response: Response) => void = () => {};
    simulatedFetch.mockImplementation(() => new Promise<Response>((resolver) => (respond = resolver)));
    const { user, onSignIn } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    await waitFor(() => expect(signInButton()).toHaveAttribute('aria-busy', 'true'));
    await user.click(signInButton());
    await user.keyboard('{Enter}');
    expect(simulatedFetch).toHaveBeenCalledTimes(1);

    respond(json(headquartersSession));
    await waitFor(() => expect(onSignIn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(signInButton()).not.toHaveAttribute('aria-busy'));
  });

  it('invalid_credentials: mostra a mensagem genérica, não o texto do servidor', async () => {
    simulatedFetch.mockResolvedValue(problem(401, 'invalid_credentials'));
    const { user, onSignIn } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(INVALID_CREDENTIALS_MESSAGE);
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.queryByText(/Texto do servidor/)).not.toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();
    // The message does not blame a single field (it does not reveal whether the e-mail exists).
    expect(emailField()).not.toHaveAttribute('aria-invalid');
    expect(passwordField()).not.toHaveAttribute('aria-invalid');
  });

  it('login_locked: diz a hora em que dá para tentar de novo (HH:MM no fuso local)', async () => {
    const today = new Date();
    const unlock = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30);
    simulatedFetch.mockResolvedValue(problem(423, 'login_locked', { unlocks_at: unlock.toISOString() }));
    const { user } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('O login deste e-mail foi bloqueado depois de várias tentativas erradas. Tente de novo às 14:30.');
  });

  it('too_many_attempts: pede para esperar um pouco', async () => {
    simulatedFetch.mockResolvedValue(problem(429, 'too_many_attempts'));
    const { user } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(screen.getByRole('alert')).toHaveTextContent('Espere um pouco e tente de novo.');
  });

  it('invalid_data: põe o erro de cada campo no campo', async () => {
    simulatedFetch.mockResolvedValue(problem(422, 'invalid_data', { fields: { email: 'Informe um e-mail com até 254 caracteres.' } }));
    const { user } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveAccessibleDescription('Informe um e-mail com até 254 caracteres.');
  });

  it('sem conexão: diz que não falou com o servidor', async () => {
    simulatedFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const { user } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.');
  });

  it('outro erro com code (invalid_content_type): usa a mensagem em pt-BR do servidor', async () => {
    simulatedFetch.mockResolvedValue(problem(415, 'invalid_content_type'));
    const { user } = renderScreen();

    await fill(user);
    await user.click(signInButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para invalid_content_type.');
  });

  it('depois de um erro, uma nova tentativa que dá certo tira a mensagem', async () => {
    simulatedFetch.mockResolvedValueOnce(problem(401, 'invalid_credentials')).mockResolvedValueOnce(json(headquartersSession));
    const { user, onSignIn } = renderScreen();

    await fill(user, 'ana@exemplo.com', 'errada-errada');
    await user.click(signInButton());
    await screen.findByRole('alert');

    await user.clear(passwordField());
    await user.type(passwordField(), 'senha-segura-123{Enter}');

    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith(headquartersSession));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('lockMessage', () => {
  it('no mesmo dia, só a hora', () => {
    const now = new Date(2026, 10, 15, 14, 15);
    expect(lockMessage(localIso(2026, 11, 15, 14, 30), now)).toMatch(/Tente de novo às 14:30\.$/);
  });

  it('em outro dia (perto da meia-noite), a hora e a data', () => {
    const now = new Date(2026, 10, 15, 23, 55);
    expect(lockMessage(localIso(2026, 11, 16, 0, 10), now)).toMatch(/Tente de novo às 00:10 de 16\/11\.$/);
  });

  it('sem data válida, "mais tarde"', () => {
    expect(lockMessage(undefined)).toMatch(/Tente de novo mais tarde\.$/);
    expect(lockMessage('não é data')).toMatch(/Tente de novo mais tarde\.$/);
  });
});
