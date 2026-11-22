// Checks the checker of the simulated answers (contract-schema.ts): the contract's examples pass, and a trace or a preview
// out of the contract is refused, as the fixture does for every answer of `unit-runs` and `previews` (F112).
// Without the backend next to it (the front CI), it is skipped, as contract-examples.spec.ts.
import { expect, test } from '@playwright/test';
import { EXAMPLES } from './contract';
import { contractResponses } from './contract-schema';

const UNIT_RUNS = '/v1/workflows/7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c99/draft/unit-runs';
const PREVIEWS = '/v1/workflows/7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c99/draft/previews';
const DRAFT = '/v1/workflows/7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c99/draft';
const JSON_TYPE = 'application/json';

const contract = contractResponses();
const clone = <T>(value: T): T => structuredClone(value);

test.describe('respostas da API simulada conferidas contra o esquema do contrato', () => {
  test.skip(!contract.checked, 'contrato do backend não encontrado (defina FLUXO_BACKEND_DIR)');

  test('os exemplos do trace e da prévia do contrato passam', () => {
    for (const trace of [EXAMPLES.UnitRunOk, EXAMPLES.UnitRunTrace, EXAMPLES.UnitRunFiltered, EXAMPLES.UnitRunIgnored, EXAMPLES.UnitRunSchemaDrift]) {
      expect(contract.violations('POST', UNIT_RUNS, 200, JSON_TYPE, trace)).toEqual([]);
    }
    expect(contract.violations('POST', PREVIEWS, 200, `${JSON_TYPE}; charset=utf-8`, EXAMPLES.Preview)).toEqual([]);
    expect(contract.violations('POST', UNIT_RUNS, 404, 'application/problem+json', EXAMPLES.NotFound)).toEqual([]);
  });

  test('a chave da linha vazia ({}) no lugar de null é recusada', () => {
    const trace = clone(EXAMPLES.UnitRunTrace) as { inputs: { origin: { row_key: unknown } | null }[] };
    trace.inputs[0]!.origin!.row_key = {};
    expect(contract.violations('POST', UNIT_RUNS, 200, JSON_TYPE, trace)).not.toEqual([]);
    trace.inputs[0]!.origin!.row_key = null;
    expect(contract.violations('POST', UNIT_RUNS, 200, JSON_TYPE, trace)).toEqual([]);
  });

  test('um grupo sem inputs, outputs ou nodes é recusado', () => {
    const trace = clone(EXAMPLES.UnitRunTrace) as { nodes: Record<string, unknown>[] };
    const group = trace.nodes.find((node) => node.type === 'group')!;
    delete group.outputs;
    expect(contract.violations('POST', UNIT_RUNS, 200, JSON_TYPE, trace)).not.toEqual([]);
  });

  test('uma prévia fora do esquema, um status e um tipo não declarados são recusados', () => {
    const preview = clone(EXAMPLES.Preview) as Record<string, unknown>;
    delete preview.groups;
    expect(contract.violations('POST', PREVIEWS, 200, JSON_TYPE, preview)).not.toEqual([]);
    expect(contract.violations('POST', PREVIEWS, 418, JSON_TYPE, {})).toHaveLength(1);
    expect(contract.violations('POST', UNIT_RUNS, 200, 'text/plain', 'ok')).toHaveLength(1);
  });

  test('o rascunho do GET e do PUT em versão 3 passa; uma definição fora da versão 3 é recusada', () => {
    for (const method of ['GET', 'PUT']) {
      for (const draft of [EXAMPLES.DraftEmpty, EXAMPLES.Draft, EXAMPLES.DraftWithSources]) {
        expect(contract.violations(method, DRAFT, 200, JSON_TYPE, draft), `${method} ${draft.revision}`).toEqual([]);
      }
      const old = clone(EXAMPLES.DraftEmpty) as { definition: { schema_version: number; parameters?: unknown; settings: Record<string, unknown> } };
      old.definition.schema_version = 2;
      expect(contract.violations(method, DRAFT, 200, JSON_TYPE, old)).not.toEqual([]);
      old.definition.schema_version = 3;
      delete old.definition.parameters;
      expect(contract.violations(method, DRAFT, 200, JSON_TYPE, old)).not.toEqual([]);
      old.definition.parameters = [];
      delete old.definition.settings.trace_level;
      expect(contract.violations(method, DRAFT, 200, JSON_TYPE, old)).not.toEqual([]);
    }
  });

  test('outras rotas não são conferidas', () => {
    expect(contract.covers('GET', '/v1/workflows')).toBe(false);
    expect(contract.violations('GET', '/v1/workflows', 200, JSON_TYPE, {})).toBeNull();
  });
});
