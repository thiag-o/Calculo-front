// The reference campaign of the epic 7 flows: the epic 6 catalog and workflows (../../epic-6/support/campaign.ts) plus what
// the backend's `prepare-local` adds in this epic (backend plan, B184): the dataset `campanha.itens_nf_vazios` and the
// workflow "Campanha de referência — vazios" over it, for the alert of the pre-validation. Test support only.
//
// What the simulation decides where the backend data of B184 is not fixed yet (only the simulated mode depends on it):
// - the 10 rows of `itens_nf_vazios` are items of invoices that exist (1 to 4), all dated in the data month: one row is
//   entirely empty, two have `quantidade` null and the other seven have no defect. So the pre-validation reads 9 records,
//   1 empty row and `quantidade` with 2 of 9 empty (22,22 %), over the alert of 1 %;
// - the workflow is the campaign's definition over that dataset, without the filters of the batch source (B184), and with
//   the same `periodo`, which then filters nothing.
import type { Schemas } from '../../support/contract';
import { ITEMS, STORES, variableId, type CatalogDataset, type CellValue } from '../../epic-5/support/campaign';
import { CAMPAIGN_DEFINITION_6, DATA_MONTH, DEFECTS, epic6VariablesOf, type Period } from '../../epic-6/support/campaign';

type Definition = Schemas['WorkflowDefinition'];
type Parameter = Schemas['WorkflowParameter'];

export { CAMPAIGN_WORKFLOW, DATA_MONTH, DEFECTS_WORKFLOW, periodText, previousMonth, type Period } from '../../epic-6/support/campaign';

/** The workflow `prepare-local` creates over the items with empty values (B184). */
export const EMPTIES_WORKFLOW = 'Campanha de referência — vazios';

/** The variable of the alert and its percent over the 9 records (2 empty), as the API writes it (truncated, 2 places). */
export const EMPTIES_ALERT = { variable: 'quantidade', empty: 2, percent: '22.22', records: 9, emptyRows: 1, alertPercent: '1' } as const;

const EMPTIES_COLUMNS = [
  { name: 'id', type: 'integer', scale: null, sourceType: 'integer' },
  ...ITEMS.columns,
  { name: 'emissao', type: 'date', scale: null, sourceType: 'date' },
] as const;

/** id, nota_id, item_seq, cod_produto, quantidade, valor_item; `null` in every column but the id is the empty row. */
const EMPTIES_ROWS: ([string, string, string, string, string | null, string] | [string, null])[] = [
  ['1', '1', '1', 'P01', '10', '389.00'],
  ['2', '1', '2', 'P03', null, '578.00'],
  ['3', '1', '3', 'P07', '1', '219.00'],
  ['4', null],
  ['5', '2', '1', 'P02', '4', '110.00'],
  ['6', '2', '2', 'P10', '1', '19.90'],
  ['7', '2', '3', 'P11', null, '958.80'],
  ['8', '3', '1', 'P05', '3', '1049.70'],
  ['9', '3', '3', 'P09', '2', '193.60'],
  ['10', '4', '1', 'P13', '1', '412.00'],
];

/** `campanha.itens_nf_vazios` (B184, rule 13 of the reference campaign). */
export const EMPTIES: CatalogDataset = {
  ...ITEMS,
  id: 'c5a00000-0000-4000-8000-000000000009',
  name: 'Itens de nota fiscal com vazios',
  object: 'itens_nf_vazios',
  columns: EMPTIES_COLUMNS,
  rows: EMPTIES_ROWS.map((row) => {
    if (row[1] === null) {
      return { id: row[0], nota_id: null, item_seq: null, cod_produto: null, quantidade: null, valor_item: null, cancelado: null, emissao: null };
    }
    const [id, noteId, itemSeq, product, quantity, value] = row;
    return { id, nota_id: noteId, item_seq: itemSeq, cod_produto: product, quantidade: quantity, valor_item: value, cancelado: false, emissao: '2026-02-10' };
  }) satisfies Record<string, CellValue>[],
};

/** The catalog variables of the empties dataset, one per column, like the items' (dataset 9 of the epic 5 scheme). */
export const EMPTIES_VARIABLES: Schemas['Variable'][] = EMPTIES.columns.map((column, position) => ({
  id: `c5b00000-0000-4000-8000-000000009${String(position + 1).padStart(3, '0')}`,
  dataset_id: EMPTIES.id,
  column: column.name,
  name: column.name,
  type: column.type,
  scale: column.scale,
}));

/** The catalog of the epic 7 simulation: the epic 6 one (items with their date, and the defects) and the empties. */
export function epic7VariablesOf(dataset: CatalogDataset): Schemas['Variable'][] {
  if (dataset.id === EMPTIES.id) return EMPTIES_VARIABLES;
  return epic6VariablesOf(dataset);
}

const BATCH = CAMPAIGN_DEFINITION_6.root.batch_source!;

/** "Campanha de referência — vazios": the campaign over the empties dataset, without the filters of the batch source. */
export const EMPTIES_DEFINITION: Definition = {
  ...CAMPAIGN_DEFINITION_6,
  root: {
    ...CAMPAIGN_DEFINITION_6.root,
    batch_source: {
      ...BATCH,
      dataset_id: EMPTIES.id,
      filters: [],
      outputs: BATCH.outputs.map((output) => ({
        name: output.name,
        variable_id: EMPTIES_VARIABLES.find((variable) => variable.name === output.name)!.id,
      })),
    },
  },
};

/** The same definition read from the items (the epic 5 engine only knows them): what the simulation calculates. */
export const EMPTIES_AS_ITEMS: Definition = {
  ...CAMPAIGN_DEFINITION_6,
  root: { ...CAMPAIGN_DEFINITION_6.root, batch_source: { ...BATCH, filters: [] } },
};

/** The datasets of the empties and of the defects, read by the simulation as the items they copy. */
export const COPIED_ITEMS: readonly string[] = [EMPTIES.id, DEFECTS.id];

// --- The parameter with a query (flow 10, roteiro 11) ----------------------------------------------------------------------

/** The text parameter whose allowed values are the states of the stores (`Lojas.uf`). */
export const STATE_PARAMETER = 'uf_loja';

/** The dataset and the variable of the query, as the editor shows them. */
export const STATE_QUERY = { dataset: STORES.name, variable: 'uf' } as const;

/** The name of the stores dataset in the real backend's catalog (the simulated one calls it `STORES.name`). */
export const REAL_STORES_DATASET_NAME = 'Campanha: lojas';

/** The distinct states of the stores, in ascending order: what the form offers. */
export const STORE_STATES: readonly string[] = [...new Set(STORES.rows.map((row) => String(row.uf)))].sort();

/** The declaration the editor writes for `uf_loja` (Texto, optional, the query without filters). */
export const STATE_PARAMETER_DECLARATION: Parameter = {
  name: STATE_PARAMETER,
  type: 'text',
  required: false,
  list: false,
  scale: null,
  default: null,
  allowed_values: { dataset_id: STORES.id, variable_id: variableId(STORES, 'uf'), filters: [] },
  description: null,
};

// --- The schedules -----------------------------------------------------------------------------------------------------------

/**
 * The business time zone (`FLUXO_BUSINESS_TIMEZONE` of the backend, `E2E_BUSINESS_TIMEZONE` here): the schedules' hours are
 * local to it. Default `America/Sao_Paulo`, as the backend's.
 */
export function businessTimeZone(): string {
  return process.env.E2E_BUSINESS_TIMEZONE?.trim() || 'America/Sao_Paulo';
}

/** The parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((each) => each.type === type)?.value ?? '0');
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}

/**
 * The hour (`HH:MM`, local to the business time zone) of the next minute that leaves at least `margin` seconds to save the
 * schedule: the scheduler fires at it (in real mode, within `FLUXO_SCHEDULER_INTERVAL_SECONDS`).
 */
export function nextMinute(now: Date = new Date(), margin = 25): string {
  const at = new Date(now.getTime() + (margin + 60) * 1000);
  const local = zonedParts(at, businessTimeZone());
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}

/** The period the relative "Mês anterior" gives for a scheduled run: the month before the one of `scheduledFor`. */
export function previousMonthOf(scheduledFor: Date): Period {
  const local = zonedParts(scheduledFor, businessTimeZone());
  const year = local.month === 1 ? local.year - 1 : local.year;
  const month = local.month === 1 ? 12 : local.month - 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
}

/** The data month as a schedule sends it (a fixed period). */
export const DATA_MONTH_FIXED = { kind: 'fixed', value: { start: DATA_MONTH.start, end: DATA_MONTH.end } } as const;

/** An hour (`HH:MM`, local) 12 hours away: a schedule that exists in a test but does not fire during it. */
export function farTime(now: Date = new Date()): string {
  const local = zonedParts(new Date(now.getTime() + 12 * 60 * 60 * 1000), businessTimeZone());
  return `${String(local.hour).padStart(2, '0')}:00`;
}
