// The expected results of the epic 6 flows, counted by hand from the rules of ../backend/docs/campanha-de-referencia.md,
// the data of B98 and the epic 5 expected records (../../epic-5/support/expected.ts). The backend's acceptance (B144,
// `backend/tests/reference_campaign/test_batch.py`) counts them too; when it lands, these must be the same numbers.
import { dataMonthDays } from './campaign';

/** Totals of a batch as the panel shows them (Lidos, Ok, Com avisos, Com erro, Ignorados, Filtrados). */
export interface ExpectedTotals {
  read: number;
  ok: number;
  warnings: number;
  errors: number;
  ignored: number;
  filtered: number;
  /** The CSV data lines: the `ok` and `com avisos` records. */
  rows: number;
}

/**
 * The whole data month ("Mês anterior"): the 60 items less the 2 cancelled ones. Ignored: the 6 items of invoices 18 and
 * 19 (store 4, out of the campaign). Filtered: P15 (6/2 and 16/3). Errors: P14, without a product (5/3 and 14/1).
 * With warnings: P12 with two active records (8/1 and 15/2) and P11 without a factor (2/3 and 12/1). The errors are 2 of
 * the 50 eligible records (4 %), under the limit of 5 %: "Com erros", with the CSV.
 */
export const WHOLE_MONTH: ExpectedTotals = { read: 58, ok: 44, warnings: 4, errors: 2, ignored: 6, filtered: 2, rows: 48 };

/** A fixed period: days 1 to 5 of the data month, the invoices 1 to 4 (emitted on days 2 to 5). */
export const FIRST_DAYS = dataMonthDays(1, 5);

/** Invoices 1 to 4: 12 items less the cancelled 3/2; only 2/3 (P11, no factor) has a warning. "Entregue". */
export const FIRST_DAYS_TOTALS: ExpectedTotals = { read: 11, ok: 10, warnings: 1, errors: 0, ignored: 0, filtered: 0, rows: 11 };

/**
 * "Campanha de referência — defeitos" in the data month (rule 10 of the reference campaign): the 8 rows of
 * `campanha.itens_nf_defeitos`, 6 ok (the 5 own keys and the first 4/2) and 2 key errors (the repeated 4/2 and the null
 * `nota_id`). 2 of 8 is 25 %, over the default limit of 5 %: the execution ends "Abortada" (`error_limit_exceeded`), without CSV.
 */
export const DEFECTS_TOTALS: ExpectedTotals = { read: 8, ok: 6, warnings: 0, errors: 2, ignored: 0, filtered: 0, rows: 0 };

/** CSV lines of the campaign checked against the epic 5 expected records (the values with a point, as the API writes them). */
export const CSV_RECORDS: readonly { key: [string, string]; status: string; pontos: string; elegivel: string; warnings: string }[] = [
  // 1/1: P01, 389.00 × 0.05 = 19.45; rule 3 (10 units, 1.20): 23.34.
  { key: ['1', '1'], status: 'ok', pontos: '23.34', elegivel: 'true', warnings: '' },
  // 2/3: P11 without a factor: the base points use the default 0; points 0.00, with the warnings.
  { key: ['2', '3'], status: 'ok_with_warnings', pontos: '0.00', elegivel: 'true', warnings: 'no_match|null_result' },
  // 2/2: P10, 19.90 under 20.00: rule 1 (not eligible, 0.00).
  { key: ['2', '2'], status: 'ok', pontos: '0.00', elegivel: 'false', warnings: '' },
];

/** The records of the whole month in the CSV only (out of the first days). */
export const CSV_MONTH_RECORDS: readonly { key: [string, string]; status: string; pontos: string; elegivel: string; warnings: string }[] = [
  // 20/3: 3,468.00 of P03 (0.10), rule 2 (1.50): 520.20, the ceiling leaves 150.00.
  { key: ['20', '3'], status: 'ok', pontos: '150.00', elegivel: 'true', warnings: '' },
  // 8/1: P12 with two active records (the newest, TIN 0.10), store 2 (PE): 308.00 × 0.10 × 1.10 = 33.88.
  { key: ['8', '1'], status: 'ok_with_warnings', pontos: '33.88', elegivel: 'true', warnings: 'multiple_rows' },
];
