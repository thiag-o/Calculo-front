// Epic 5 · the reference campaign (G1, E5-15) on the workflow "Campanha de referência" of `prepare-local`: "Rodar prévia"
// counts each Fonte block over the first records of the batch source; a record of the sample of that preview is chosen in
// "Calcular" ("Escolher registro") and gives the trace and the expected value, also drawn on the canvas; and the keys
// typed by hand give the result of each edge case of the campaign (both modes; in real mode, the backend's engine over
// the campaign data of B98).
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW, BLOCKS } from './support/campaign';
import { COUNTED_RECORDS, EXPECTED_COUNTS, FIRST_RECORD, TYPED_RECORDS, type ExpectedRecord } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  calculate,
  canvasNode,
  canvasValues,
  openBottomTab,
  openWorkflowEditor,
  previewCounts,
  previewPanel,
  runBanner,
  runPreview,
  sampleRecord,
  shownValue,
  traceBlock,
  traceInput,
  typeRecordKey,
  unitRunForm,
} from './support/screens';
import type { Locator } from '@playwright/test';

const keyText = (key: ExpectedRecord['key']) => `nota_id ${key.nota_id} · item_seq ${key.item_seq}`;

/** The result of "Calcular" for a record: the status, the outputs, the rule of "Multiplicador" and the code. */
async function expectResult(form: Locator, expected: ExpectedRecord): Promise<void> {
  await expect(form.getByRole('status')).toHaveText(`Resultado do cálculo: ${expected.status}`);
  const outputs = form.getByRole('region', { name: 'Saídas', exact: true });
  if (expected.outputs) {
    await expect(shownValue(outputs, 'pontos')).toHaveText(expected.outputs.pontos);
    await expect(shownValue(outputs, 'elegivel')).toHaveText(expected.outputs.elegivel);
  } else {
    await expect(outputs).toContainText('Sem saídas');
  }
  if (expected.rule !== undefined) await expect(traceBlock(form, BLOCKS.multiplier)).toContainText(`Regra ${expected.rule}`);
  if (expected.code) await expect(form.getByRole('region', { name: 'Blocos', exact: true })).toContainText(expected.code);
  for (const [block, values] of Object.entries(expected.values ?? {})) {
    for (const [name, value] of Object.entries(values)) await expect(shownValue(traceBlock(form, block), name)).toHaveText(value);
  }
}

test('a prévia conta cada bloco Fonte da campanha sobre os registros da fonte do lote', async ({ page, epic5 }) => {
  await signIn(page, epic5.account('admin'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);

  await openBottomTab(page, 'Prévia');
  const response = await runPreview(page);
  expect(response.status(), 'rodar a prévia').toBe(200);
  // Nothing was pending: the preview is of the saved draft, with the sample of 20 records.
  expect(response.request().postDataJSON()).toMatchObject({ sample_size: 20 });

  const panel = previewPanel(page);
  await expect(panel.getByRole('status')).toHaveText(`Prévia pronta: ${COUNTED_RECORDS} registros contados`);
  await expect(panel).toContainText('Contagens sobre os primeiros 500 registros.');
  for (const { block, text, real } of EXPECTED_COUNTS) {
    if (epic5.mode === 'real' && !real) continue;
    await expect(previewCounts(page, block), `${block}: ${text}`).toContainText(text);
  }
  // The keys of the items whose store is out of the campaign, and the first record of the sample with its result.
  await expect(panel.getByRole('list', { name: `Sem correspondência em ${BLOCKS.store}: chaves de exemplo` })).toContainText('nota_id 18 · item_seq 1');
  const first = panel.getByRole('region', { name: 'Registros de exemplo de Workflow' }).getByRole('row', { name: new RegExp(`^${keyText(FIRST_RECORD.key)} `) });
  await expect(first).toContainText(FIRST_RECORD.status);
  await expect(first).toContainText(FIRST_RECORD.outputs!.pontos);
});

test('da amostra da prévia, Escolher registro calcula o registro e mostra o trace e os valores no canvas', async ({ page, epic5 }) => {
  await signIn(page, epic5.account('admin'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);
  await openBottomTab(page, 'Prévia');
  expect((await runPreview(page)).status(), 'rodar a prévia').toBe(200);

  // "Calcular" with the batch source: "Escolher registro", the sample of the preview just run.
  await openBottomTab(page, 'Calcular');
  const form = unitRunForm(page);
  await expect(form.getByRole('heading', { name: 'Escolher registro' })).toBeVisible();
  const record = sampleRecord(form, FIRST_RECORD.key);
  await expect(record).toHaveAccessibleName(`Escolher ${keyText(FIRST_RECORD.key)} (ok na prévia)`);
  await record.click();
  await expect(record).toHaveAttribute('aria-pressed', 'true');
  const key = form.getByRole('group', { name: 'Chave do registro', exact: true });
  await expect(key.getByRole('textbox', { name: 'nota_id', exact: true })).toHaveValue('1');
  await expect(key.getByRole('textbox', { name: 'item_seq', exact: true })).toHaveValue('1');

  const response = await calculate(page, form);
  expect(response.status(), 'calcular').toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ record_key: FIRST_RECORD.key });

  // The trace: the status, the outputs, the rule, the values of the blocks inside the group and the inputs with origin.
  await expectResult(form, FIRST_RECORD);
  await expect(form).toContainText(keyText(FIRST_RECORD.key));
  const value = traceInput(form, 'valor_item');
  await expect(value).toContainText('389,00');
  if (epic5.mode === 'simulated') await expect(value).toContainText('Postgres da campanha › Itens de nota fiscal › valor_item');
  await expect(traceInput(form, 'categoria')).toContainText('CIM');

  // The canvas shows the values of that run, until "Limpar".
  await expect(runBanner(page)).toContainText('Registro ok');
  await expect(page.getByRole('region', { name: 'Canvas', exact: true }).getByRole('group', { name: `${BLOCKS.points}, Cálculo, ok no último cálculo` })).toBeVisible();
  await expect(canvasValues(page, BLOCKS.points)).toContainText('23,34');
  await expect(canvasValues(page, BLOCKS.basePoints)).toContainText('19,45');
  await expect(canvasNode(page, BLOCKS.multiplier, 'Tabela de Decisão')).toContainText('Regra 3');
  await runBanner(page).getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(runBanner(page)).toHaveCount(0);
  await expect(canvasValues(page, BLOCKS.points)).toHaveCount(0);
});

test('a chave digitada dá o resultado de cada caso de borda da campanha', async ({ page, epic5 }) => {
  test.slow();
  await signIn(page, epic5.account('admin'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);
  await openBottomTab(page, 'Calcular');
  const form = unitRunForm(page);

  for (const expected of TYPED_RECORDS) {
    await test.step(`${keyText(expected.key)}: ${expected.status}`, async () => {
      await typeRecordKey(form, expected.key);
      const response = await calculate(page, form);
      expect(response.status(), 'calcular').toBe(200);
      await expect(form).toContainText(keyText(expected.key));
      await expectResult(form, expected);
    });
  }

  // A key no record has: the message at the key field.
  await typeRecordKey(form, { nota_id: '99', item_seq: '1' });
  expect((await calculate(page, form)).status(), 'calcular uma chave que não existe').toBe(404);
  await expect(form.getByRole('group', { name: 'Chave do registro', exact: true })).toContainText('Nenhum registro com essa chave.');
});
