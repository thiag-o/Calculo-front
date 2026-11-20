// Checks the copy of the contract examples (contract.ts) against the backend openapi.yaml: from FLUXO_BACKEND_DIR when set
// (worktree mode; the contract missing there FAILS the test), otherwise from ../backend as in `pnpm generate:api`.
// Without the variable and without the backend (the front CI) the test is skipped, with the reason shown.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { EXAMPLES } from './contract';

const BACKEND_DIR = process.env.FLUXO_BACKEND_DIR;
const CONTRACT = resolve(
  BACKEND_DIR ? resolve(BACKEND_DIR) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend'),
  'contracts',
  'openapi.yaml',
);

/**
 * The YAML reader of the type generator itself (openapi-typescript → @redocly/openapi-core), so as not to add a
 * dependency to the repository just for this check.
 */
function readYaml(text: string): unknown {
  const fromGenerator = createRequire(createRequire(import.meta.url).resolve('openapi-typescript'));
  const redocly = fromGenerator('@redocly/openapi-core') as { parseYaml: (text: string) => unknown };
  return redocly.parseYaml(text);
}

test('os exemplos da API simulada são os do contrato do backend', () => {
  if (BACKEND_DIR) {
    expect(existsSync(CONTRACT), `FLUXO_BACKEND_DIR está definida, mas o contrato não foi encontrado em ${CONTRACT}`).toBe(true);
  } else {
    test.skip(!existsSync(CONTRACT), `contrato não encontrado em ${CONTRACT} (sem o backend ao lado; defina FLUXO_BACKEND_DIR)`);
  }

  const contract = readYaml(readFileSync(CONTRACT, 'utf-8')) as {
    components?: { examples?: Record<string, { value: unknown }> };
  };
  const examples = Object.fromEntries(
    Object.entries(contract.components?.examples ?? {}).map(([name, example]) => [name, example.value]),
  );

  expect(EXAMPLES, 'atualize e2e/support/contract.ts com components.examples do contrato').toEqual(examples);
});
