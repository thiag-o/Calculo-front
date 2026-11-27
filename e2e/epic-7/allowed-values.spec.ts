// Epic 7 · a parameter with the allowed values from a query (fluxo 10, roteiro 11): on a copy of the "Campanha de
// referência", the Admin declares `uf_loja` (Texto) with "Valores permitidos" = Consulta over the states of the stores
// (dataset Lojas, in real mode "Campanha: lojas", variable `uf`). In "Executar lote", the field becomes a search with only those values (the text typed
// filters them); the batch goes with the value chosen, and a value outside them is refused (`422 invalid_parameter`).
import type { Locator, Page } from '@playwright/test';
import { callApi, suffix } from '../epic-2/support/screens';
import { draftSaved, editorOf } from '../epic-4/support/screens';
import { openWorkflowEditor } from '../epic-5/support/screens';
import { chooseOption, declaredParameter, parametersSection, triggerDialog, workflowId } from '../epic-6/support/screens';
import { dataMonthDays } from '../epic-6/support/campaign';
import type { Schemas } from '../support/contract';
import { CAMPAIGN_WORKFLOW, DATA_MONTH, STATE_PARAMETER, REAL_STORES_DATASET_NAME, STATE_PARAMETER_DECLARATION, STATE_QUERY, STORE_STATES } from './support/campaign';
import { expect, test } from './support/fixtures';
import { copyAsAdmin, openTriggerFor, submitTrigger } from './support/screens';

/** "Adicionar parâmetro" and the name of the new one (it comes as `parametro_N`, Texto, without default). */
async function addParameter(page: Page, name: string): Promise<Locator> {
  const section = parametersSection(page);
  await section.getByRole('button', { name: 'Adicionar parâmetro', exact: true }).click();
  const created = section.getByRole('group', { name: /^Parâmetro parametro_\d+$/ }).last();
  await created.getByRole('textbox', { name: /^Nome \(parametro_\d+\)$/ }).fill(name);
  const item = declaredParameter(page, name);
  await expect(item).toBeVisible();
  return item;
}

/** The options the search of a parameter offers, in order. */
async function offered(page: Page, name: string): Promise<string[]> {
  const list = page.getByRole('listbox', { name: `Valores de ${name}`, exact: true });
  await expect(list).toBeVisible();
  return list.getByRole('option').allTextContents();
}

test('um parâmetro com os valores permitidos pela consulta às UFs das lojas: o formulário oferece só esses valores e recusa outro', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 240_000 : 90_000);
  const name = `Campanha UF da loja e2e ${suffix()}`;
  const apiOrigin = await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  await openWorkflowEditor(page, name);

  await test.step('no editor: Texto, com Valores permitidos = Consulta no dataset Lojas, variável uf', async () => {
    const parameter = await addParameter(page, STATE_PARAMETER);
    const kinds = parameter.getByRole('radiogroup', { name: `Valores permitidos (${STATE_PARAMETER})`, exact: true });
    await expect(kinds.getByRole('radio', { name: 'Nenhum', exact: true })).toHaveAttribute('aria-checked', 'true');
    await kinds.getByRole('radio', { name: 'Consulta', exact: true }).click();
    const datasetName = epic7.mode === 'real' ? REAL_STORES_DATASET_NAME : STATE_QUERY.dataset;
    await parameter.getByRole('button', { name: new RegExp(`^${datasetName} Tabela ou view`) }).click();
    await expect(parameter.getByText('A consulta vai para o rascunho quando você escolher a variável.')).toBeVisible();
    const saved = draftSaved(page, (definition) => definition.parameters.some((each) => each.name === STATE_PARAMETER && each.allowed_values !== null));
    await chooseOption(page, parameter.getByRole('combobox', { name: `Variável (${STATE_PARAMETER})`, exact: true }), STATE_QUERY.variable);
    const definition = ((await saved).request().postDataJSON() as Schemas['DraftUpdate']).definition;
    if (epic7.mode === 'simulated') {
      expect(definition.parameters.find((each) => each.name === STATE_PARAMETER)).toEqual(STATE_PARAMETER_DECLARATION);
    } else {
      // The ids of the catalog are the backend's: only the shape is checked.
      expect(definition.parameters.find((each) => each.name === STATE_PARAMETER)).toMatchObject({ type: 'text', allowed_values: { filters: [] } });
    }
    await expect(parameter.getByRole('group', { name: 'Filtros' })).toBeVisible();
  });

  await test.step('no formulário de Executar lote: a busca oferece só as UFs, e o texto digitado filtra', async () => {
    const dialog = await openTriggerFor(page, DATA_MONTH, editorOf(page, name));
    const field = dialog.getByRole('combobox', { name: STATE_PARAMETER, exact: true });
    await field.click();
    expect(await offered(page, STATE_PARAMETER)).toEqual([...STORE_STATES]);
    await field.fill('p');
    await expect.poll(() => offered(page, STATE_PARAMETER)).toEqual(STORE_STATES.filter((state) => state.toLowerCase().includes('p')));
    await page.getByRole('listbox', { name: `Valores de ${STATE_PARAMETER}`, exact: true }).getByRole('option', { name: 'SP', exact: true }).click();
    await expect(field).toHaveValue('SP');
    const response = await submitTrigger(page);
    expect(response.status(), 'disparar o lote com a UF escolhida').toBe(202);
    expect((response.request().postDataJSON() as Schemas['NewExecution']).parameters).toMatchObject({ [STATE_PARAMETER]: 'SP' });
    await expect(triggerDialog(page)).toHaveCount(0);
  });

  await test.step('um valor fora das UFs é recusado: 422 invalid_parameter, sem ecoar o valor', async () => {
    const id = await workflowId(page, apiOrigin, name);
    const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
    const revision = (draft.body as Schemas['Draft']).revision;
    const refused = await callApi(page, apiOrigin, 'POST', `/v1/workflows/${id}/executions`, {
      revision,
      parameters: { periodo: dataMonthDays(1, 5), [STATE_PARAMETER]: 'MG' },
      confirm_overlap: false,
    } satisfies Schemas['NewExecution']);
    expect(refused.status).toBe(422);
    expect(refused.code).toBe('invalid_parameter');
    const fields = (refused.body as { fields?: Record<string, string> }).fields ?? {};
    expect(fields[STATE_PARAMETER]).toContain('não está entre os valores permitidos');
    expect(fields[STATE_PARAMETER]).not.toContain('MG');
  });
});
