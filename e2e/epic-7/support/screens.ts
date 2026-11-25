// Actions and locators of the epic 7 screens (the pre-validation and the comparison in the execution panel, the overlap in
// "Executar lote", the Agendamentos tab and its dialog, the Testes screen with the reference file and "Simular", and the
// bell), by what the user sees. The ones of the editor and of the epic 6 panel are in e2e/epic-4 to e2e/epic-6.
import type { Locator, Page, Response } from '@playwright/test';
import { mainNavigation } from '../../epic-2/support/screens';
import { openOverview, signInForApi } from '../../epic-4/support/screens';
import { escape } from '../../epic-5/support/screens';
import { copyWorkflow, fixPeriod, openTrigger, triggerDialog } from '../../epic-6/support/screens';
import type { Schemas } from '../../support/contract';
import { accountMenu, signIn, waitForSignIn } from '../../support/screens';
import { DATA_MONTH, type Period } from './campaign';
import { expect, type Epic7, type Epic7Account } from './fixtures';

type Definition = Schemas['WorkflowDefinition'];

/** The panel status as the screen says it (dot + word, estilos.md §7.3 and E7-21). */
export type StatusLabel = 'Na fila' | 'Calculando' | 'Aguardando decisão' | 'Aguardando fonte' | 'Entregue' | 'Com erros' | 'Abortada' | 'Cancelada' | 'Sem entrega';

const STATUS_WORDS = /^(Na fila|Calculando|Aguardando decisão|Aguardando fonte|Entregue|Com erros|Abortada|Cancelada|Sem entrega)$/;

/** How long the real worker and scheduler may take (the scheduler fires within a minute of the marked one, E7-9). */
export const REAL_RUN_TIMEOUT = 120_000;
/** How long a real schedule may take to fire: the next minute plus the scheduler's interval (global plan, epic 7). */
export const REAL_SCHEDULE_TIMEOUT = 180_000;

// --- Preparation -------------------------------------------------------------------------------------------------------

/** Signs in as the Admin and copies a workflow of `prepare-local` (see `copyWorkflow`); returns the API origin. */
export async function copyAsAdmin(page: Page, epic7: Epic7, from: string, name: string, change?: (definition: Definition) => Definition): Promise<string> {
  const apiOrigin = await signInForApi(page, epic7.account('admin'));
  await copyWorkflow(page, apiOrigin, from, name, change);
  return apiOrigin;
}

/** Signs out the person on the page and signs in another one. */
export async function switchAccount(page: Page, epic7: Epic7, from: Epic7Account, to: Epic7Account): Promise<void> {
  await accountMenu(page, epic7.accountName(from)).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await waitForSignIn(page);
  await signIn(page, epic7.account(to));
}

// --- Navigation --------------------------------------------------------------------------------------------------------

/**
 * Opens the Overview of a workflow from anywhere: inside a workflow the sidebar is the workflow's menu (no Workflows item),
 * so the list is opened by its route first.
 */
export async function openWorkflow(page: Page, name: string): Promise<void> {
  await page.goto('/workflows');
  await openOverview(page, name);
}

/** Opens an item of the workflow menu (Execuções, Testes) from anywhere. */
export async function openWorkflowItem(page: Page, name: string, item: 'Execuções' | 'Testes'): Promise<void> {
  await openWorkflow(page, name);
  await mainNavigation(page).getByRole('link', { name: item, exact: true }).click();
}

/** The tabs Execuções | Agendamentos of the workflow (E7-24). */
export const workflowTabs = (page: Page) => page.getByRole('tablist', { name: 'Abas de Execuções do workflow', exact: true });

/** Opens the Agendamentos tab of a workflow and waits for the list. */
export async function openSchedules(page: Page, name: string): Promise<void> {
  await openWorkflowItem(page, name, 'Execuções');
  await workflowTabs(page).getByRole('tab', { name: 'Agendamentos', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Agendamentos', exact: true })).toBeVisible();
}

/** Opens the Execuções tab of a workflow (from anywhere in its screens) and waits for the list. */
export async function openWorkflowExecutionsTab(page: Page): Promise<void> {
  await workflowTabs(page).getByRole('tab', { name: 'Execuções', exact: true }).click();
  await expect(executionsTable(page)).toBeVisible();
}

/** The executions table of a workflow or of the tenant. */
export const executionsTable = (page: Page) => page.getByRole('table', { name: /^Execuções do (tenant|workflow)$/ });

/** The row of an execution in a list by what it shows (the workflow, who triggered). */
export const executionRow = (page: Page, text: string | RegExp) => executionsTable(page).getByRole('row').filter({ hasText: text });

/**
 * Reloads the page until `check` passes: the lists of the schedules, of the reference files and the bell are read once
 * (or every 30 s), and what the worker and the scheduler did shows at the next read.
 */
export async function untilShown(page: Page, epic7: Epic7, check: () => Promise<void>, timeout = REAL_RUN_TIMEOUT): Promise<void> {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: epic7.mode === 'real' ? timeout : 20_000, intervals: [1_000, 2_000, 5_000] });
}

// --- The execution panel -----------------------------------------------------------------------------------------------

/** The panel of an execution of the workflow `name` (its title is the workflow name). */
export const executionPanel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The status beside the title. */
export const panelStatus = (panel: Locator) => panel.locator('.fc-execution-subtitle').getByText(STATUS_WORDS);

/**
 * Waits for the panel to show `status`. In simulated mode the test moved the worker already, and the panel sees it at its
 * next refresh (2 s); in real mode the backend's worker gets there by itself.
 */
export async function expectStatus(page: Page, epic7: Epic7, panel: Locator, status: StatusLabel): Promise<void> {
  void page;
  await expect(panelStatus(panel)).toHaveText(status, epic7.mode === 'real' ? { timeout: REAL_RUN_TIMEOUT } : { timeout: 10_000 });
}

/** Moves the simulated worker to a final state, or to the stop of `awaiting_decision` (real mode: the worker runs alone). */
export function finishRun(epic7: Epic7, id?: string): void {
  epic7.worker?.finish(id);
}

/** The phases Carga → Pré-validação → Cálculo → Entrega (or Comparação). */
export const phase = (page: Page, label: 'Carga' | 'Pré-validação' | 'Cálculo' | 'Entrega' | 'Comparação') =>
  page.getByRole('region', { name: 'Fases', exact: true }).getByRole('listitem').filter({ hasText: label });

/** The value beside a term (`dt`/`dd`) inside a part of the panel. */
export function pairValue(scope: Locator, term: string): Locator {
  return scope.getByRole('term').filter({ hasText: new RegExp(`^${escape(term)}$`) }).locator('xpath=following-sibling::*[1]');
}

/** The value of a resolved parameter, and "Disparado por", in "Resumo". */
export const summaryValue = (page: Page, term: string) => pairValue(page.getByRole('region', { name: 'Resumo', exact: true }), term);

/** The "Pré-validação" box of the panel. */
export const preValidationBox = (page: Page) => page.getByRole('region', { name: 'Pré-validação', exact: true });

/** The decision note of `awaiting_decision` (estilos.md §7.7). */
export const decisionNote = (page: Page) => page.locator('.fc-execution-decision');

/** The "Fontes" section with the counts of each Fonte block. */
export const sourcesSection = (page: Page) => page.getByRole('region', { name: 'Fontes', exact: true });

/** A total ("Lidos", "Ok", "Com avisos", "Com erro", "Ignorados", "Filtrados"). */
export const total = (page: Page, label: string) => pairValue(page.getByRole('region', { name: 'Totais', exact: true }), label);

/** The comparison with the reference file, at the top of a simulation (E7-26). */
export const comparisonSection = (page: Page) => page.getByRole('region', { name: 'Comparação com o arquivo de referência', exact: true });

/** One count of the comparison ("Iguais", "Diferentes", "Fora do arquivo"…). */
export const comparisonCount = (page: Page, label: string) => pairValue(comparisonSection(page), label);

/** The table of the diff. */
export const comparisonTable = (page: Page) => page.getByRole('table', { name: 'Registros comparados com o arquivo', exact: true });

/** The trace drawer of a record. */
export const traceDrawer = (page: Page) => page.getByRole('dialog', { name: 'Trace do registro', exact: true });

/** "nota_id 1 · item_seq 1", as the panel writes a key. */
export const keyText = (key: Readonly<Record<string, string | null>>) =>
  Object.entries(key).map(([name, value]) => `${name} ${value ?? '—'}`).join(' · ');

// --- "Executar lote" with the overlap (E7-22) --------------------------------------------------------------------------

/** Opens "Executar lote" (Overview, list or editor bar) and fixes `periodo`. */
export async function openTriggerFor(page: Page, period: Period = DATA_MONTH, from?: Locator): Promise<Locator> {
  const dialog = await openTrigger(page, from);
  await fixPeriod(dialog, 'periodo', period);
  return dialog;
}

/** Clicks "Executar lote" in the dialog and returns the `POST …/executions` response. */
export async function submitTrigger(page: Page): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/executions$/.test(new URL(r.url()).pathname)),
    triggerDialog(page).getByRole('button', { name: 'Executar lote', exact: true }).click(),
  ]);
  return response;
}

/** The note of a scope already delivered, inside the dialog. */
export const overlapNote = (page: Page) => triggerDialog(page).getByRole('list', { name: 'Execuções do mesmo escopo', exact: true });

/**
 * Sends "Executar lote" and, when the scope was already delivered (`409 scope_already_delivered`), confirms it: the second
 * click sends `confirm_overlap`. Returns the execution created. In real mode a copy may meet an earlier run of the same
 * scope (the database keeps them), so the confirmation is accepted in both answers.
 */
export async function triggerConfirmingOverlap(page: Page): Promise<Schemas['Execution']> {
  const first = await submitTrigger(page);
  if (first.status() === 202) return (await first.json()) as Schemas['Execution'];
  expect(first.status(), 'o disparo só pode pedir a confirmação da sobreposição').toBe(409);
  await expect(overlapNote(page)).toBeVisible();
  const second = await submitTrigger(page);
  expect(second.status(), 'disparar o lote confirmando a sobreposição').toBe(202);
  expect((second.request().postDataJSON() as Schemas['NewExecution']).confirm_overlap).toBe(true);
  return (await second.json()) as Schemas['Execution'];
}

// --- Schedules (E7-24) -------------------------------------------------------------------------------------------------

/** The schedules table of a workflow or of the tenant. */
export const schedulesTable = (page: Page) => page.getByRole('table', { name: /^Agendamentos do (workflow|tenant)$/ });

/** The row of a schedule by its name. */
export const scheduleRow = (page: Page, name: string) => schedulesTable(page).getByRole('row').filter({ hasText: name });

/** The dialog of a new schedule. */
export const scheduleDialog = (page: Page) => page.getByRole('dialog', { name: 'Novo agendamento', exact: true });

export interface NewSchedule {
  name: string;
  /** `HH:MM` in the business time zone. */
  time: string;
  /** The `periodo`: the relative "Mês anterior" or a fixed period. */
  period: 'previous_month' | Period;
}

/**
 * "Novo agendamento" in the Agendamentos tab of the workflow: the name, Diária at `time`, the `periodo` Fixo or Relativo,
 * and "Salvar". Returns the schedule as the API saved it, remembered for the end of the test (real mode).
 */
export async function createSchedule(page: Page, epic7: Epic7, schedule: NewSchedule): Promise<Schemas['Schedule']> {
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).first().click();
  const dialog = scheduleDialog(page);
  await expect(dialog.getByText(/^Roda a revisão \d+ do rascunho salvo\.$/)).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(schedule.name);
  await expect(dialog.getByRole('radiogroup', { name: 'Recorrência' }).getByRole('radio', { name: 'Diária' })).toBeChecked();
  await dialog.getByRole('textbox', { name: 'Horário', exact: true }).fill(schedule.time);
  const kind = dialog.getByRole('radiogroup', { name: 'Valor de periodo', exact: true });
  if (schedule.period === 'previous_month') {
    await kind.getByRole('radio', { name: 'Relativo', exact: true }).check();
    await expect(dialog.getByRole('combobox', { name: 'periodo', exact: true })).toContainText('Mês anterior');
  } else {
    await kind.getByRole('radio', { name: 'Fixo', exact: true }).check();
    const field = dialog.getByRole('group', { name: 'periodo', exact: true });
    await field.getByLabel('Início', { exact: true }).fill(schedule.period.start);
    await field.getByLabel('Fim', { exact: true }).fill(schedule.period.end);
  }
  await expect(dialog.getByRole('switch', { name: 'Ativo' })).toHaveAttribute('aria-checked', 'true');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/schedules$/.test(new URL(r.url()).pathname)),
    dialog.getByRole('button', { name: 'Salvar', exact: true }).click(),
  ]);
  expect(response.status(), 'criar o agendamento').toBe(201);
  const saved = (await response.json()) as Schemas['Schedule'];
  epic7.trackSchedule(page, new URL(response.url()).origin, saved.id);
  await expect(dialog).toHaveCount(0);
  await expect(scheduleRow(page, schedule.name)).toBeVisible();
  return saved;
}

/**
 * Waits for the scheduler to fire the schedule `name` and the list to show its last trigger (`Disparou`, `Não executou` or
 * `Não disparou`). In simulated mode the simulated scheduler fires it at its marked hour; in real mode `fluxo scheduler`
 * fires it within the next minute.
 */
export async function waitForTrigger(page: Page, epic7: Epic7, name: string, outcome: 'Disparou' | 'Não executou' | 'Não disparou'): Promise<void> {
  epic7.scheduler?.fire(name);
  await untilShown(page, epic7, async () => {
    await expect(scheduleRow(page, name)).toContainText(outcome, { timeout: 5_000 });
  }, REAL_SCHEDULE_TIMEOUT);
}

// --- Testes › Arquivo de referência (E7-25) ----------------------------------------------------------------------------

/** The reference files table. */
export const referenceFilesTable = (page: Page) => page.getByRole('table', { name: 'Arquivos de referência do workflow', exact: true });

/** The row of a reference file by its name. */
export const referenceFileRow = (page: Page, name: string) => referenceFilesTable(page).getByRole('row').filter({ hasText: name });

/** Chooses a file in "Enviar arquivo" and returns the `POST …/reference-files` response. */
export async function uploadReferenceFile(page: Page, name: string, text: string): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/reference-files$/.test(new URL(r.url()).pathname)),
    page.getByLabel('Arquivo de referência (.csv)', { exact: true }).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') }),
  ]);
  return response;
}

/** The "Simular" dialog. */
export const simulateDialog = (page: Page) => page.getByRole('dialog', { name: 'Simular', exact: true });

/** "Simular" of a file, with `periodo` fixed; returns the simulation created (its panel opens). */
export async function simulate(page: Page, file: string, period: Period = DATA_MONTH): Promise<Schemas['Execution']> {
  await page.getByRole('button', { name: `Simular com ${file}`, exact: true }).first().click();
  const dialog = simulateDialog(page);
  await expect(dialog.getByText(/^Simula o rascunho salvo \(revisão \d+\) e compara com o arquivo\. Nada é entregue\.$/)).toBeVisible();
  await fixPeriod(dialog, 'periodo', period);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /\/reference-files\/[^/]+\/simulations$/.test(new URL(r.url()).pathname)),
    dialog.getByRole('button', { name: 'Simular', exact: true }).click(),
  ]);
  expect(response.status(), 'disparar a simulação').toBe(202);
  return (await response.json()) as Schemas['Execution'];
}

// --- The bell (E7-27) --------------------------------------------------------------------------------------------------

/** The bell button ("Alertas, 3 não lidos"). */
export const bellButton = (page: Page) => page.getByRole('button', { name: /^Alertas/ });

/** The open list of alerts. */
export const alertsPopover = (page: Page) => page.getByRole('dialog', { name: 'Alertas', exact: true });

/** One alert by its detail (it carries the names of the workflow and of the schedule). */
export const alertItem = (page: Page, detail: string | RegExp) => alertsPopover(page).getByRole('listitem').filter({ hasText: detail });
