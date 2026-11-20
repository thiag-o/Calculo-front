// Ports of the simulated e2e run (Playwright, Vite shell and embed test page), shared by playwright.config.ts and the
// Vite configs of apps/shell.
// Without FLUXO_TEST_ISOLATION_ID: the usual ports (5173 and 5274).
// With it: a pair of ports derived from the id, deterministic, inside the fixed range 6100-6999, so that several
// worktrees can run `pnpm e2e` at the same time. Ports 5000 and 5001 are forbidden by the product owner and are never
// reached: the range starts at 6100.
import { createHash } from 'node:crypto';

export const DEFAULT_SHELL_PORT = 5173;
export const DEFAULT_HOST_APP_PORT = 5274;
export const ISOLATED_PORT_MIN = 6100;
export const ISOLATED_PORT_MAX = 6999;

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ shellPort: number, hostAppPort: number }}
 */
export function e2ePorts(env = process.env) {
  const id = env.FLUXO_TEST_ISOLATION_ID?.trim();
  if (!id) return { shellPort: DEFAULT_SHELL_PORT, hostAppPort: DEFAULT_HOST_APP_PORT };
  // Pairs (shell, embed page) side by side: (MAX - MIN + 1) / 2 = 450 slots.
  const slots = Math.floor((ISOLATED_PORT_MAX - ISOLATED_PORT_MIN + 1) / 2);
  const slot = createHash('sha256').update(id).digest().readUInt32BE(0) % slots;
  const shellPort = ISOLATED_PORT_MIN + slot * 2;
  return { shellPort, hostAppPort: shellPort + 1 };
}
