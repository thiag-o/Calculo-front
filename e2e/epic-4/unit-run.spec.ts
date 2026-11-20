// Epic 4 · "Calcular" with typed values: on the "Pontuação de exemplo" of `prepare-local`, 1.500,00, "A", verdadeiro and
// no item give `ok`, `pontos` 225,00 and "Regra 2"; with the policy "Única", rules 2 and 3 match and the result shows
// the error (both modes; in real mode, the backend's engine).
import { suffix } from '../epic-2/support/screens';
import { signIn } from '../support/screens';
import { SAMPLE_WORKFLOW } from './support/simulation';
import { expect, test } from './support/fixtures';
import {
  blockLayer,
  blockResult,
  calculate,
  choose,
  createExampleWorkflow,
  draftSaved,
  fillExampleValues,
  nodeNamed,
  openUnitRun,
  openWorkflowEditor,
  properties,
  shownValue,
  signInForApi,
  type Workflow,
} from './support/screens';

const EXAMPLE_VALUES = { valorItem: '1.500,00', categoria: 'A', metaAtingida: 'Verdadeiro' } as const;

test('Calcular com os valores do exemplo dá ok, pontos 225,00 e a Regra 2', async ({ page, epic4 }) => {
  await signIn(page, epic4.account('admin'));
  // The workflow `prepare-local` creates (only read here: "Calcular" saves nothing).
  await openWorkflowEditor(page, SAMPLE_WORKFLOW);

  const form = await openUnitRun(page);
  await fillExampleValues(page, form, EXAMPLE_VALUES);
  const response = await calculate(page, form);
  expect(response.status(), 'calcular').toBe(200);
  // What went to the API: numbers as text with a point, the empty list as an empty list.
  expect(response.request().postDataJSON()).toMatchObject({
    inputs: { valor_item: '1500.00', categoria: 'A', meta_atingida: true, pontuacoes: [] },
  });

  await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: ok');
  const outputs = form.getByRole('region', { name: 'Saídas' });
  await expect(shownValue(outputs, 'pontos')).toHaveText('225,00');
  await expect(shownValue(outputs, 'elegivel')).toHaveText('verdadeiro');
  // Each block, in the order it ran: the Table says the rule that matched.
  const table = blockResult(form, 'Elegibilidade');
  await expect(table).toContainText('Regra 2');
  await expect(shownValue(table, 'fator')).toHaveText('0,1500');
  await expect(shownValue(blockResult(form, 'Pontos já ganhos'), 'pontos_historico')).toHaveText('0,00');
  await expect(shownValue(blockResult(form, 'Pontos'), 'pontos')).toHaveText('225,00');
});

test('com a política Única, as regras 2 e 3 casam e o resultado mostra o erro', async ({ page, epic4 }) => {
  const name = `Pontuação única e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  // A copy of the example, so the shared "Pontuação de exemplo" keeps the policy "Primeira".
  const workflow: Workflow = await createExampleWorkflow(page, apiOrigin, name);
  await openWorkflowEditor(page, workflow.name);

  await blockLayer(page, 'Elegibilidade', 'Tabela de Decisão').click();
  const saved = draftSaved(page, (definition) => {
    const node = nodeNamed(definition, 'Elegibilidade');
    return node?.type === 'decision_table' && node.hit_policy === 'unique';
  });
  const policy = properties(page).getByRole('combobox', { name: 'Política de acerto' });
  await choose(page, policy, 'Única');
  await expect(properties(page).getByRole('group', { name: 'Propriedades de Elegibilidade' })).toContainText('Única');
  await saved;

  const form = await openUnitRun(page);
  await fillExampleValues(page, form, EXAMPLE_VALUES);
  expect((await calculate(page, form)).status(), 'calcular').toBe(200);

  await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: erro');
  await expect(form.getByRole('region', { name: 'Saídas' })).toContainText('Sem saídas: o registro deu erro.');
  const table = blockResult(form, 'Elegibilidade');
  await expect(table).toContainText('multiple_rules_matched');
  await expect(table).toContainText('As regras 2 e 3 casaram.');
  // The blocks after the failure do not run.
  await expect(blockResult(form, 'Pontos já ganhos')).toContainText('não rodado');
  await expect(blockResult(form, 'Pontos')).toContainText('não rodado');
});
