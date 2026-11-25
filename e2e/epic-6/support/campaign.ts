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

/** `campanha.itens_nf_defeitos` (B143): the campaign items less the two of P14, with a null key and a repeated key. */
export const DEFECTS: CatalogDataset = {
  ...ITEMS,
  id: 'c5a00000-0000-4000-8000-000000000008',
  name: 'Itens de nota fiscal com defeitos',
  object: 'itens_nf_defeitos',
  rows: [
    ...ITEMS.rows.filter((row) => row.cod_produto !== 'P14'),
    // The null key (`null_record_key`) and the repeated 1/1 (`duplicate_record_key`, the first one counts).
    { nota_id: null, item_seq: '1', cod_produto: 'P01', quantidade: '2', valor_item: '77.80', cancelado: false },
    { nota_id: '1', item_seq: '1', cod_produto: 'P01', quantidade: '10', valor_item: '389.00', cancelado: false },
  ] satisfies Record<string, CellValue>[],
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

/** The filter of the invoice date by the period. */
export const PERIOD_FILTER = { variable: 'emissao', operator: 'between', values: ['@periodo.inicio', '@periodo.fim'] } as const;

const BATCH = CAMPAIGN_DEFINITION.root.batch_source!;

/** The "Campanha de referência" of epic 6: the epic 5 one with `periodo` in the filter of the invoice date. */
export const CAMPAIGN_DEFINITION_6: Definition = {
  ...CAMPAIGN_DEFINITION,
  parameters: [PERIOD_PARAMETER],
  root: {
    ...CAMPAIGN_DEFINITION.root,
    batch_source: {
      ...BATCH,
      filters: [...BATCH.filters, { ...PERIOD_FILTER, values: [...PERIOD_FILTER.values] }],
      outputs: [...BATCH.outputs, { variable_id: ITEMS_DATE_VARIABLE.id, name: 'emissao' }],
    },
  },
};

/** The defects workflow: the campaign rules over the items with defects, without parameters. */
export const DEFECTS_DEFINITION: Definition = {
  ...CAMPAIGN_DEFINITION,
  parameters: [],
  root: {
    ...CAMPAIGN_DEFINITION.root,
    batch_source: {
      ...BATCH,
      dataset_id: DEFECTS.id,
      outputs: BATCH.outputs.map((output) => ({
        name: output.name,
        variable_id: DEFECTS_VARIABLES.find((variable) => variable.name === output.name)!.id,
      })),
    },
  },
};
