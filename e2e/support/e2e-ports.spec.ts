// Ports of the isolated simulated e2e (scripts/e2e-ports.mjs). Needs no browser or API.
import { expect, test } from '@playwright/test';
import { e2ePorts } from '../../scripts/e2e-ports.mjs';

test.describe('portas do e2e isolado', () => {
  test('sem o id, mantém as portas de sempre', () => {
    expect(e2ePorts({})).toEqual({ shellPort: 5173, hostAppPort: 5274 });
    expect(e2ePorts({ FLUXO_TEST_ISOLATION_ID: '  ' })).toEqual({ shellPort: 5173, hostAppPort: 5274 });
  });

  test('com o id, é determinística e distinta entre ids', () => {
    const env = { FLUXO_TEST_ISOLATION_ID: 'F61' };
    expect(e2ePorts(env)).toEqual(e2ePorts(env));
    expect(e2ePorts(env).shellPort).not.toBe(e2ePorts(env).hostAppPort);
    expect(e2ePorts({ FLUXO_TEST_ISOLATION_ID: 'F62' })).not.toEqual(e2ePorts(env));
  });

  test('fica na faixa 6100 a 6999 e nunca usa 5000 nem 5001', () => {
    for (let i = 0; i < 2000; i += 1) {
      const { shellPort, hostAppPort } = e2ePorts({ FLUXO_TEST_ISOLATION_ID: `task-${i}` });
      for (const port of [shellPort, hostAppPort]) {
        expect(port).toBeGreaterThanOrEqual(6100);
        expect(port).toBeLessThanOrEqual(6999);
        expect([5000, 5001]).not.toContain(port);
      }
    }
  });
});
