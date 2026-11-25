// The reference campaign of the epic 6 flows (E6-14): the epic 5 catalog and workflow (../../epic-5/support/campaign.ts)
// plus what the backend's `prepare-local` adds in this epic (backend plan, B143 and B144): the run parameter `periodo`
// (Período, default "Mês anterior") in the filter of the invoice date of the batch source, and the workflow
// "Campanha de referência — defeitos" over the items with a null key and a repeated key. Test support only.
//
// What the simulation decides where the backend data of B143 is not fixed yet (only the simulated mode depends on it):
// - the batch source (the invoice items) brings `emissao`, the date of its invoice;
// - the invoices are dated in February 2026, on the same day as in B98 (2 to 26), as `prepare-local` seeds them; the data
//   does not move with the clock, so every flow that checks totals, errors, trace or CSV fires with the fixed
//   `DATA_MONTH` (the whole campaign) or a fixed period of it (days 1 to 5 read only invoices 1 to 4). The default
//   "Mês anterior" has its own test, which checks only the period the API resolves.
import type { Schemas } from '../../support/contract';
import {
  CAMPAIGN_DEFINITION,
  INVOICES,
  ITEMS,
  variablesOf,
  type CatalogDataset,
  type CellValue,
} from '../../epic-5/support/campaign';

type Definition = Schemas['WorkflowDefinition'];
type Parameter = Schemas['WorkflowParameter'];

export { CAMPAIGN_WORKFLOW } from '../../epic-5/support/campaign';

/** The workflow `prepare-local` creates over the items with defects (B144). */
export const DEFECTS_WORKFLOW = 'Campanha de referência — defeitos';

/** The business time zone (`FLUXO_BUSINESS_TIMEZONE`, default `America/Sao_Paulo`): the relative defaults count in it. */
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

/** A day as `YYYY-MM-DD`. */
export type IsoDate = string;

export interface Period {
  start: IsoDate;
  end: IsoDate;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today in the business time zone. */
export function businessToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => Number(parts.find((each) => each.type === type)?.value ?? '0');
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** The last day of a month (1 to 12). */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The whole month before the one of `now` (the relative default `previous_month`). */
export function previousMonth(now: Date = new Date()): Period {
  const today = businessToday(now);
  const year = today.month === 1 ? today.year - 1 : today.year;
  const month = today.month === 1 ? 12 : today.month - 1;
  return { start: isoDate(year, month, 1), end: isoDate(year, month, lastDay(year, month)) };
}

/** The month the campaign invoices are dated in (B98 and B100): fixed, the one constant of the data month. */
export const DATA_MONTH: Period = { start: '2026-02-01', end: '2026-02-28' };

/** A fixed period of the data month: from day `from` to day `to`. */
export function dataMonthDays(from: number, to: number): Period {
  const prefix = DATA_MONTH.start.slice(0, 8);
  return { start: `${prefix}${pad(from)}`, end: `${prefix}${pad(to)}` };
}

/** "01/10/2026 a 31/10/2026": how the screen writes a period. */
export function periodText(period: Period): string {
  const brazilian = (date: IsoDate) => date.split('-').reverse().join('/');
  return `${brazilian(period.start)} a ${brazilian(period.end)}`;
}

/** The date of each invoice (by id) in the data month: the day of B98, in the month of `DATA_MONTH`. */
export const INVOICE_DATES: ReadonlyMap<string, IsoDate> = new Map(
  INVOICES.rows.map((row) => [String(row.id), `${DATA_MONTH.start.slice(0, 8)}${String(row.emissao).slice(8, 10)}`]),
);

// --- Catalog -----------------------------------------------------------------------------------------------------------

/** The catalog variable of `emissao` in the items (the next id of the epic 5 scheme: dataset 1, column 7). */
export const ITEMS_DATE_VARIABLE: Schemas['Variable'] = {
  id: 'c5b00000-0000-4000-8000-000000001007',
  dataset_id: ITEMS.id,
  column: 'emissao',
  name: 'emissao',
  type: 'date',
  scale: null,
};

/** The items with their invoice date: the batch source of the epic 6 campaign. */
export const ITEMS_WITH_DATE: CatalogDataset = {
  ...ITEMS,
  columns: [...ITEMS.columns, { name: 'emissao', type: 'date', scale: null, sourceType: 'date' }],
  rows: ITEMS.rows.map((row) => ({ ...row, emissao: INVOICE_DATES.get(String(row.nota_id)) ?? null })),
};

/**
 * `campanha.itens_nf_defeitos` (B143, rule 10 of the reference campaign): 8 rows without a primary key, all dated in the
 * data month. The ids 1, 2, 3, 7 and 8 have their own key (1/1, 1/2, 2/1, 7/1, 8/3); 4 and 5 repeat the key 4/2 (the first
 * one counts, `duplicate_record_key`); 6 has a null `nota_id` (`null_record_key`). The simulation reads the items of the
 * campaign that have the same key (see `bindDefinition`), so the values of the repeated rows do not matter.
 */
const DEFECTS_COLUMNS = [
  { name: 'id', type: 'integer', scale: null, sourceType: 'integer' },
  ...ITEMS.columns,
  { name: 'emissao', type: 'date', scale: null, sourceType: 'date' },
] as const;

export const DEFECTS: CatalogDataset = {
  ...ITEMS,
  id: 'c5a00000-0000-4000-8000-000000000008',
  name: 'Itens de nota fiscal com defeitos',
  object: 'itens_nf_defeitos',
  columns: DEFECTS_COLUMNS,
  rows: [
    ['1', '1', '1', 'P01', '10', '389.00'],
    ['2', '1', '2', 'P03', '2', '578.00'],
    ['3', '2', '1', 'P02', '4', '110.00'],
    ['4', '4', '2', 'P04', '6', '388.50'],
    ['5', '4', '2', 'P04', '1', '64.75'],
    ['6', null, '1', 'P01', '2', '77.80'],
    ['7', '7', '1', 'P01', '8', '311.20'],
    ['8', '8', '3', 'P06', '1', '89.90'],
  ].map(([id, noteId, itemSeq, product, quantity, value]) => ({
    id,
    nota_id: noteId,
    item_seq: itemSeq,
    cod_produto: product,
    quantidade: quantity,
    valor_item: value,
    cancelado: false,
    emissao: '2026-02-10',
  })) satisfies Record<string, CellValue>[],
};

/** The catalog variables of the defects dataset, one per column, like the items' (dataset 8 of the epic 5 scheme). */
export const DEFECTS_VARIABLES: Schemas['Variable'][] = DEFECTS.columns.map((column, position) => ({
  id: `c5b00000-0000-4000-8000-000000008${String(position + 1).padStart(3, '0')}`,
  dataset_id: DEFECTS.id,
  column: column.name,
  name: column.name,
  type: column.type,
  scale: column.scale,
}));

/** The id of the `emissao` variable of the defects dataset. */
export const DEFECTS_DATE_VARIABLE_ID = DEFECTS_VARIABLES.find((variable) => variable.name === 'emissao')!.id;

/** The variables of a dataset of the epic 6 catalog. */
export function epic6VariablesOf(dataset: CatalogDataset): Schemas['Variable'][] {
  if (dataset.id === DEFECTS.id) return DEFECTS_VARIABLES;
  if (dataset.id === ITEMS.id) return [...variablesOf(ITEMS), ITEMS_DATE_VARIABLE];
  return variablesOf(dataset);
}

// --- Workflows ---------------------------------------------------------------------------------------------------------

/** `periodo` (Período, default "Mês anterior"), as `prepare-local` declares it (B144). */
export const PERIOD_PARAMETER: Parameter = {
  name: 'periodo',
  type: 'period',
  required: true,
  list: false,
  scale: null,
  default: { kind: 'relative', value: 'previous_month' },
  allowed_values: null,
  description: 'Mês de emissão das notas',
};

/** The filters of the invoice date by the period, as the editor shows them: two filters, `>=` the start and `<=` the end. */
export const PERIOD_FILTERS = [
  { variable: 'emissao', operator: '>=', values: ['@periodo.inicio'] },
  { variable: 'emissao', operator: '<=', values: ['@periodo.fim'] },
] as const;

const BATCH = CAMPAIGN_DEFINITION.root.batch_source!;

/** The "Campanha de referência" of epic 6: the epic 5 one with `periodo` in the filter of the invoice date. */
export const CAMPAIGN_DEFINITION_6: Definition = {
  ...CAMPAIGN_DEFINITION,
  parameters: [PERIOD_PARAMETER],
  root: {
    ...CAMPAIGN_DEFINITION.root,
    batch_source: {
      ...BATCH,
      filters: [...BATCH.filters, ...PERIOD_FILTERS.map((filter) => ({ ...filter, values: [...filter.values] }))],
      outputs: [...BATCH.outputs, { variable_id: ITEMS_DATE_VARIABLE.id, name: 'emissao' }],
    },
  },
};

/** The defects workflow: the campaign rules over the items with defects, with the same `periodo`. */
export const DEFECTS_DEFINITION: Definition = {
  ...CAMPAIGN_DEFINITION,
  parameters: [PERIOD_PARAMETER],
  root: {
    ...CAMPAIGN_DEFINITION.root,
    batch_source: {
      ...BATCH,
      dataset_id: DEFECTS.id,
      filters: [...BATCH.filters, ...PERIOD_FILTERS.map((filter) => ({ ...filter, values: [...filter.values] }))],
      outputs: [...BATCH.outputs, { variable_id: ITEMS_DATE_VARIABLE.id, name: 'emissao' }].map((output) => ({
        name: output.name,
        variable_id: DEFECTS_VARIABLES.find((variable) => variable.name === output.name)!.id,
      })),
    },
  },
};
