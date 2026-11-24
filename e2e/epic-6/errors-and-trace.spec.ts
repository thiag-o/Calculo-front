// Epic 6 · an execution with errors under the limit (fluxo 4 and roteiro 6): the "Campanha de referência" with the default
// period ends "Com erros" (P14 has no product: 2 of the 50 eligible records). A click on the error group filters the
// records by the block and the code, the key of a record opens its stored trace in the drawer, with the names of the
// blocks of the frozen definition (D40, F118), even after the draft changed, and the values in the Brazilian pattern. The
// status filter, "Carregar mais registros" and "Limpar filtros" go through the records of the whole batch.
import { suffix } from '../epic-2/support/screens';
import { openOverview, signInForApi } from '../epic-4/support/screens';
import { BLOCKS } from '../epic-5/support/campaign';
import type { Schemas } from '../support/contract';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { WHOLE_MONTH } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  changeDraft,
  copyWorkflow,
  errorGroups,
  executionPanel,
  expectStatus,
  finishRun,
  keyText,
  openTrigger,
  recordsSection,
  recordsTable,
  submitTrigger,
  traceDrawer,
} from './support/screens';

type Definition = Schemas['WorkflowDefinition'];

/** The draft with the block "Produto" renamed: the stored trace keeps the name the execution ran with. */
function renameProduct(definition: Definition): Definition {
  return {
    ...definition,
    root: { ...definition.root, nodes: definition.root.nodes.map((node) => (node.name === BLOCKS.product ? { ...node, name: 'Produto renomeado' } : node)) },
  };
}

test('com erros dentro do limite, o grupo de erro filtra os registros e o trace mostra a definição congelada', async ({ page, epic6 }) => {
  test.setTimeout(90_000);
  const name = `Campanha erros e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  const id = await copyWorkflow(page, apiOrigin, CAMPAIGN_WORKFLOW, name);
  await openOverview(page, name);
  await openTrigger(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, name);
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Com erros');
  // Someone edits the draft after the execution ran: the panel still reads what the execution froze.
  await changeDraft(page, apiOrigin, id, renameProduct);

  await test.step('o grupo de erro filtra os registros pelo bloco e pelo código', async () => {
    const group = errorGroups(page).getByRole('button', { name: `${BLOCKS.product}, no_match: 2 registros. Filtrar os registros`, exact: true });
    await expect(group).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse((r) => /\/v1\/executions\/[^/]+\/records$/.test(new URL(r.url()).pathname) && new URL(r.url()).searchParams.get('node_id') === 'produto'),
      group.click(),
    ]);
    expect(new URL(response.url()).searchParams.get('code')).toBe('no_match');
    await expect(group).toHaveAttribute('aria-pressed', 'true');
    await expect(recordsSection(page).getByRole('status').filter({ hasText: 'Limpar filtro do erro' })).toContainText(`Erro${BLOCKS.product}no_match`);
    const rows = recordsTable(page).getByRole('row').filter({ hasText: 'no_match' });
    await expect(rows).toHaveCount(2);
    await expect(recordsTable(page)).toContainText(keyText({ nota_id: '5', item_seq: '3' }));
    await expect(recordsTable(page)).toContainText(keyText({ nota_id: '14', item_seq: '1' }));
  });

  await test.step('a chave abre o trace guardado, com o nome do bloco da execução', async () => {
    const key = recordsTable(page).getByRole('button', { name: `Abrir o trace de ${keyText({ nota_id: '5', item_seq: '3' })}`, exact: true });
    await key.click();
    const drawer = traceDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(keyText({ nota_id: '5', item_seq: '3' }));
    await expect(drawer).toContainText('erro');
    await expect(drawer).toContainText('no_match');
    await expect(drawer).toContainText(BLOCKS.product);
    await expect(drawer).not.toContainText('Produto renomeado');
    await drawer.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(key).toBeFocused();
  });

  await test.step('sem o filtro do erro, os registros do lote inteiro, em páginas', async () => {
    await recordsSection(page).getByRole('button', { name: 'Limpar filtro do erro', exact: true }).click();
    const more = recordsSection(page).getByRole('button', { name: 'Carregar mais registros', exact: true });
    await expect(more).toBeVisible();
    await expect(recordsTable(page).getByRole('row')).toHaveCount(50 + 1);
    await more.click();
    await expect(recordsTable(page).getByRole('row')).toHaveCount(WHOLE_MONTH.read + 1);
    await expect(more).toHaveCount(0);

    // An ok record: its trace shows the values of the blocks in the Brazilian pattern.
    await recordsTable(page).getByRole('button', { name: `Abrir o trace de ${keyText({ nota_id: '1', item_seq: '1' })}`, exact: true }).click();
    await expect(traceDrawer(page)).toContainText('23,34');
    await expect(traceDrawer(page)).toContainText('19,45');
    await traceDrawer(page).press('Escape');
    await expect(traceDrawer(page)).toHaveCount(0);
  });

  await test.step('o filtro de status mostra só os registros com avisos', async () => {
    const status = recordsSection(page).getByRole('combobox', { name: 'Status', exact: true });
    await status.click();
    await page.getByRole('option', { name: 'com avisos', exact: true }).click();
    await expect(recordsTable(page).getByRole('row')).toHaveCount(WHOLE_MONTH.warnings + 1);
    await expect(recordsTable(page)).toContainText(keyText({ nota_id: '8', item_seq: '1' }));
  });
});
