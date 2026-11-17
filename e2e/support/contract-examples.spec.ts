// Checks the copy of the contract examples (contract.ts) against the backend openapi.yaml, when it is next to this repository
// (../backend/contratos/openapi.yaml, as in `pnpm generate:api`). In the front CI the backend does not exist: the test is skipped.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { EXAMPLES } from './contract';

const CONTRACT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend', 'contratos', 'openapi.yaml');

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
  test.skip(!existsSync(CONTRACT), `contrato não encontrado em ${CONTRACT} (sem o backend ao lado)`);

  const contract = readYaml(readFileSync(CONTRACT, 'utf-8')) as {
    components?: { examples?: Record<string, { value: unknown }> };
  };
  const examples = Object.fromEntries(
    Object.entries(contract.components?.examples ?? {}).map(([name, example]) => [name, example.value]),
  );

  expect(EXAMPLES, 'atualize e2e/apoio/contrato.ts com components.examples do contrato').toEqual(examples);
});
