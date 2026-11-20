// Epic 4 · new workflow: the Admin creates a workflow with "Novo workflow", lands on its Overview and opens the editor,
// with the empty draft (both modes).
import { suffix } from '../epic-2/support/screens';
import { signIn } from '../support/screens';
import { expect, test } from './support/fixtures';
import { editorOf, layers, openWorkflows, type Workflow } from './support/screens';

test('o Admin cria um workflow por Novo workflow, cai na Visão geral e abre o editor', async ({ page, epic4 }) => {
  const name = `Bônus e2e ${suffix()}`;
  await signIn(page, epic4.account('admin'));
  await openWorkflows(page);

  await page.getByRole('button', { name: 'Novo workflow', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Novo workflow' });
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(name);
  await dialog.getByRole('textbox', { name: 'Objetivo', exact: true }).fill('Bônus por meta atingida.');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1/workflows'),
    dialog.getByRole('button', { name: 'Salvar', exact: true }).click(),
  ]);
  expect(response.status(), 'criar o workflow').toBe(201);
  const workflow = (await response.json()) as Workflow;
  expect(workflow).toMatchObject({ name, objective: 'Bônus por meta atingida.', draft: { node_count: 0, problem_count: 0 } });

  // The Overview of the new workflow: its name, objective and the draft without blocks.
  await expect(page).toHaveURL(new RegExp(`/workflows/${workflow.id}$`));
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  await expect(page.getByText('Bônus por meta atingida.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Rascunho' })).toContainText('0 blocos');

  await page.getByRole('button', { name: 'Abrir editor', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/workflows/${workflow.id}/editor$`));
  const editor = editorOf(page, name);
  await expect(editor.getByRole('navigation', { name: 'Você está em' })).toContainText(name);
  // The empty draft: the inputs and the output without items, no block, nothing to fix.
  await expect(layers(page).getByRole('treeitem', { name: 'Entradas' })).toBeVisible();
  await expect(layers(page).getByRole('treeitem', { name: /Cálculo|Tabela de Decisão/ })).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Cálculo', exact: true })).toBeEnabled();
  await expect(page.getByRole('tabpanel', { name: 'Problemas' })).toContainText('Nenhum problema');
});
