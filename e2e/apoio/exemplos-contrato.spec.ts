// Confere a cópia dos exemplos do contrato (contrato.ts) com o openapi.yaml do backend, quando ele está ao lado
// (../backend/contratos/openapi.yaml, como no `pnpm gerar:api`). No CI do front o backend não existe: o teste é pulado.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { EXEMPLOS } from './contrato';

const CONTRATO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend', 'contratos', 'openapi.yaml');

/**
 * O leitor de YAML do próprio gerador de tipos (openapi-typescript → @redocly/openapi-core), para não acrescentar
 * dependência ao repositório só por esta conferência.
 */
function lerYaml(texto: string): unknown {
  const doGerador = createRequire(createRequire(import.meta.url).resolve('openapi-typescript'));
  const redocly = doGerador('@redocly/openapi-core') as { parseYaml: (texto: string) => unknown };
  return redocly.parseYaml(texto);
}

test('os exemplos da API simulada são os do contrato do backend', () => {
  test.skip(!existsSync(CONTRATO), `contrato não encontrado em ${CONTRATO} (sem o backend ao lado)`);

  const contrato = lerYaml(readFileSync(CONTRATO, 'utf-8')) as {
    components?: { examples?: Record<string, { value: unknown }> };
  };
  const exemplos = Object.fromEntries(
    Object.entries(contrato.components?.examples ?? {}).map(([nome, exemplo]) => [nome, exemplo.value]),
  );

  expect(EXEMPLOS, 'atualize e2e/apoio/contrato.ts com components.examples do contrato').toEqual(exemplos);
});
