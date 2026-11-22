// Epic 4 · the draft is always read in version 3: a definition saved in version 2 (with no `parameters` and no new
// `settings` fields) comes back from the PUT and from the next GET in 3, with the parameters empty and the settings at
// their defaults (both modes; the simulated answers are also checked against the contract by the fixture).
import { callApi, suffix } from '../epic-2/support/screens';
import { expect, test } from './support/fixtures';
import { signInForApi, type Workflow } from './support/screens';
import type { Schemas } from '../support/contract';

test('um rascunho gravado em versão 2 volta em versão 3, no PUT e no GET seguinte', async ({ page, epic4 }) => {
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name: `Versão 3 e2e ${suffix()}` });
  expect(created.status, 'criar o workflow pela API').toBe(201);
  const workflow = created.body as Workflow;

  const version2: Schemas['WorkflowDefinition'] = {
    schema_version: 2,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
    root: { inputs: [], nodes: [], output: { fields: [] } },
  };
  const body: Schemas['DraftUpdate'] = { revision: workflow.draft.revision, definition: version2 };
  const saved = await callApi(page, apiOrigin, 'PUT', `/v1/workflows/${workflow.id}/draft`, body);
  expect(saved.status, `gravar o rascunho em versão 2 (${String(saved.code)})`).toBe(200);
  const expected = {
    schema_version: 3,
    parameters: [],
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
  };
  expect((saved.body as Schemas['Draft']).definition, 'a resposta do PUT').toMatchObject(expected);

  const read = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${workflow.id}/draft`);
  expect(read.status).toBe(200);
  expect((read.body as Schemas['Draft']).definition, 'o GET depois do PUT').toMatchObject(expected);
});
