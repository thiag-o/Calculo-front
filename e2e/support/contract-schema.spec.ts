// Checks the checker of the simulated answers (contract-schema.ts): the contract's examples pass, and a trace or a preview
// out of the contract is refused, as the fixture does for every answer of `unit-runs` and `previews` (F112) and of the
// execution routes (F105).
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
      // A setting that is not text is refused; an absent one is the legacy form the real API still serves (D44).
      old.definition.settings.trace_level = 3;
      expect(contract.violations(method, DRAFT, 200, JSON_TYPE, old)).not.toEqual([]);
      delete old.definition.settings.trace_level;
      expect(contract.violations(method, DRAFT, 200, JSON_TYPE, old)).toEqual([]);
    }
  });

  test('os exemplos das execuções passam; uma execução ou um registro fora do esquema são recusados', () => {
    const execution = '/v1/executions/6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
    const executions = [
      EXAMPLES.ExecutionPending,
      EXAMPLES.ExecutionCalculating,
      EXAMPLES.ExecutionAwaitingSource,
      EXAMPLES.ExecutionCompleted,
      EXAMPLES.ExecutionCompletedWithErrors,
      EXAMPLES.ExecutionAborted,
      EXAMPLES.ExecutionCancelled,
    ];
    for (const example of executions) expect(contract.violations('GET', execution, 200, JSON_TYPE, example), example.status).toEqual([]);
    expect(contract.violations('POST', '/v1/workflows/4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70/executions', 202, JSON_TYPE, EXAMPLES.ExecutionPending)).toEqual([]);
    expect(contract.violations('POST', `${execution}/cancel`, 202, JSON_TYPE, EXAMPLES.ExecutionCancelRequested)).toEqual([]);
    expect(contract.violations('GET', '/v1/executions', 200, JSON_TYPE, EXAMPLES.ExecutionList)).toEqual([]);
    expect(contract.violations('GET', `${execution}/definition`, 200, JSON_TYPE, EXAMPLES.ExecutionDefinition)).toEqual([]);
    expect(contract.violations('GET', `${execution}/records`, 200, JSON_TYPE, EXAMPLES.ExecutionRecordList)).toEqual([]);
    expect(contract.violations('GET', `${execution}/records/${'a'.repeat(64)}`, 200, JSON_TYPE, EXAMPLES.ExecutionRecordStandard)).toEqual([]);
    expect(contract.violations('GET', `${execution}/output`, 200, 'text/csv', EXAMPLES.ExecutionOutputCsv)).toEqual([]);
    expect(contract.violations('GET', `${execution}/output`, 404, 'application/problem+json', EXAMPLES.OutputNotAvailable)).toEqual([]);

    const partial = clone(EXAMPLES.ExecutionCompleted) as Record<string, unknown>;
    delete partial.error_groups;
    expect(contract.violations('GET', execution, 200, JSON_TYPE, partial)).not.toEqual([]);
    const record = clone(EXAMPLES.ExecutionRecordList) as { items: Record<string, unknown>[] };
    record.items[0]!.result_key = 'não é um hash';
    expect(contract.violations('GET', `${execution}/records`, 200, JSON_TYPE, record)).not.toEqual([]);
  });

  test('outras rotas não são conferidas', () => {
    expect(contract.covers('GET', '/v1/workflows')).toBe(false);
    expect(contract.violations('GET', '/v1/workflows', 200, JSON_TYPE, {})).toBeNull();
  });
});
