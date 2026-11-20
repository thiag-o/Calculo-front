import { cleanup, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connections, ConnectionList } from '.';
import { ApiError } from '../../api';
import { COOLDOWN_RELEASED_MESSAGE, useTestCooldown } from './useTestCooldown';
import { CONNECTIONS, ERP, INTEGRATOR, SECRET, json, problem, renderConnections, simulateApi, write } from './connections.test-support';

const DETAIL_ROUTE = `GET /v1/connections/${ERP.id}`;
const TEST_ROUTE = `POST /v1/connections/${ERP.id}/test`;
const LIMIT = 'Muitos testes de conexão seguidos. Tente de novo em';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Conexões: limite de testes (too_many_connection_tests)', () => {
  it('mostra o tempo de espera e desabilita Testar com esse motivo até o tempo passar', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond('GET /v1/connections', json({ items: CONNECTIONS }));
    api.respond(DETAIL_ROUTE, json(ERP));
    api.respond(TEST_ROUTE, problem(429, 'too_many_connection_tests', { retry_after_seconds: 2 }));
    const { user } = renderConnections(<Connections connectionId={ERP.id} />);
    await screen.findByRole('heading', { level: 2, name: ERP.name });
    await user.click(await screen.findByRole('button', { name: 'Testar' }));

    // Beside the button, and once more in the hidden live region that announces it.
    expect(await screen.findAllByText(`${LIMIT} 2 s.`)).toHaveLength(2);
    // The button is rendered again with the reason beside it.
    const button = screen.getByRole('button', { name: 'Testar' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(`${LIMIT} 2 s.`);

    // Pressing it again sends nothing while the wait lasts.
    await user.click(button);
    expect(api.callsTo(TEST_ROUTE)).toHaveLength(1);

    // Time passes: the button works again, and the reason is gone.
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Testar' })).not.toHaveAttribute('aria-disabled', 'true'), {
      timeout: 4000,
    });
    expect(screen.queryByText(new RegExp(LIMIT))).not.toBeInTheDocument();
    expect(within(document.body).queryByRole('alert')).not.toBeInTheDocument();
  });
});

function tooMany(seconds: number): ApiError {
  return new ApiError({ status: 429, code: 'too_many_connection_tests', message: 'Muitos testes', body: { retry_after_seconds: seconds } as unknown as ApiError['body'] });
}

describe('useTestCooldown', () => {
  it('nunca deixa o Testar habilitado entre o 429 e a contagem, nem por uma renderização', () => {
    const seen: (string | undefined)[] = [];
    const { rerender } = renderHook(
      ({ error }: { error: unknown }) => {
        const cooldown = useTestCooldown(error);
        seen.push(cooldown.reason);
        return cooldown;
      },
      { initialProps: { error: undefined as unknown } },
    );
    expect(seen.at(-1)).toBeUndefined();

    seen.length = 0;
    rerender({ error: tooMany(30) });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((reason) => reason !== undefined)).toBe(true);

    // The wait is the server's: it holds even after the form clears the error.
    seen.length = 0;
    rerender({ error: undefined });
    expect(seen.every((reason) => reason !== undefined)).toBe(true);
  });

  it('anuncia só o começo e o fim da espera, não cada segundo', async () => {
    const heard: string[] = [];
    const { result, rerender } = renderHook(({ error }: { error: unknown }) => useTestCooldown(error), {
      initialProps: { error: undefined as unknown },
    });
    rerender({ error: tooMany(2) });
    heard.push(result.current.announcement);
    const reasons = new Set<string | undefined>();
    await waitFor(
      () => {
        reasons.add(result.current.reason);
        if (heard.at(-1) !== result.current.announcement) heard.push(result.current.announcement);
        expect(result.current.reason).toBeUndefined();
      },
      { timeout: 4000, interval: 50 },
    );
    heard.push(result.current.announcement);
    // The visible count changed (2 s, then 1 s), but the announcement only twice.
    expect(reasons.size).toBeGreaterThan(2);
    expect([...new Set(heard)]).toEqual([`${LIMIT} 2 s.`, COOLDOWN_RELEASED_MESSAGE]);
  });
});

describe('Conexões: 429 ao salvar', () => {
  it('mostra a contagem regressiva ao salvar a nova conexão e a tira quando a espera acaba', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond('GET /v1/connections', json({ items: CONNECTIONS }));
    api.respond('POST /v1/connections', problem(429, 'too_many_connection_tests', { retry_after_seconds: 2 }));
    const { user } = renderConnections(<ConnectionList onOpen={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Nova conexão' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova conexão' });
    const form = within(dialog);
    await write(user, form.getByLabelText('Nome'), 'Estoque');
    await write(user, form.getByLabelText('Host'), 'estoque.interno');
    await write(user, form.getByLabelText('Banco'), 'estoque');
    await write(user, form.getByLabelText('Usuário'), 'leitura');
    await write(user, form.getByLabelText('Senha'), SECRET);
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    // The count shows in the note (as beside "Testar") and "Testar" waits too.
    const notes = await form.findAllByText(`${LIMIT} 2 s.`);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(form.getByRole('button', { name: 'Testar' })).toHaveAttribute('aria-disabled', 'true');

    await waitFor(() => expect(form.queryByText(new RegExp(LIMIT))).not.toBeInTheDocument(), { timeout: 4000 });
    expect(form.getByRole('button', { name: 'Testar' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
