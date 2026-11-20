import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connections } from '.';
import { CONNECTIONS, ERP, INTEGRATOR, json, problem, renderConnections, simulateApi } from './connections.test-support';

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

    expect(await screen.findByText(`${LIMIT} 2 s.`)).toBeInTheDocument();
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
