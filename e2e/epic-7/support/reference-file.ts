// The reference file of the campaign (E7-10, E7-18) and the two changed copies of the flows (roteiro 4 and 5), as text.
// - real mode: the backend's `tests/fixtures/reference_campaign/expected.csv` (B184), read from FLUXO_BACKEND_DIR (or
//   ../backend), generated there from the hand-counted `expected.py` of B100;
// - simulated mode: the same columns (the key, `pontos`, `elegivel` and `status`), one line per item of the February 2026
//   batch, from the simulated batch over the data month. The simulation's engine is the epic 5 one, whose values were
//   checked against the hand-counted records of epic 5 (../../epic-5/support/expected.ts).
// The values of the campaign have no comma nor quote, so a line is split at the commas.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { E2EMode } from '../../support/fixtures';
import type { Schemas } from '../../support/contract';
import { runBatch } from '../../epic-6/support/engine';
import { CAMPAIGN_DEFINITION_6, DATA_MONTH } from '../../epic-6/support/campaign';

/** The name of the file the flows upload (the backend's file name). */
export const REFERENCE_FILE_NAME = 'expected.csv';

/** A reference file as a table: the header and the data lines. */
export interface ReferenceTable {
  header: string[];
  rows: string[][];
}

/** One data line of the table, by column. */
export type ReferenceRow = Record<string, string>;

/** The statuses of a calculated record (empty means "calculated", contract). */
const CALCULATED = new Set(['ok', 'ok_with_warnings', '']);

export function parseCsv(text: string): ReferenceTable {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line !== '');
  const [header = '', ...rows] = lines;
  return { header: header.split(',').map((name) => name.trim()), rows: rows.map((line) => line.split(',')) };
}

export function writeCsv(table: ReferenceTable): string {
  return [table.header, ...table.rows].map((line) => line.join(',')).join('\r\n') + '\r\n';
}

export function rowOf(table: ReferenceTable, row: readonly string[]): ReferenceRow {
  return Object.fromEntries(table.header.map((name, index) => [name, row[index] ?? '']));
}

/** The CSV of the simulated mode: every record of the data month, with the outputs of the calculated ones. */
function simulatedCsv(): string {
  const records = runBatch(CAMPAIGN_DEFINITION_6, { periodo: { start: DATA_MONTH.start, end: DATA_MONTH.end } }, 'tenant', 'workflow');
  const value = (output: Schemas['Value'] | undefined) =>
    output === null || output === undefined ? '' : typeof output === 'boolean' ? String(output) : typeof output === 'string' ? output : JSON.stringify(output);
  const rows = records.map((record) => {
    const calculated = record.status === 'ok' || record.status === 'ok_with_warnings';
    const outputs = record.trace?.outputs ?? {};
    return [
      record.recordKey.nota_id ?? '',
      record.recordKey.item_seq ?? '',
      calculated ? value(outputs.pontos) : '',
      calculated ? value(outputs.elegivel) : '',
      record.status,
    ];
  });
  return writeCsv({ header: ['nota_id', 'item_seq', 'pontos', 'elegivel', 'status'], rows });
}

/** The backend's folder: FLUXO_BACKEND_DIR (worktree mode) or ../backend, as `pnpm generate:api`. */
function backendDir(): string {
  const configured = process.env.FLUXO_BACKEND_DIR?.trim();
  return configured ? resolve(configured) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'backend');
}

/** The reference file of the campaign in the mode of the test. */
export function campaignReferenceFile(mode: E2EMode): string {
  if (mode === 'simulated') return simulatedCsv();
  const path = resolve(backendDir(), 'tests', 'fixtures', 'reference_campaign', REFERENCE_FILE_NAME);
  if (!existsSync(path)) {
    throw new Error(`Modo real: o arquivo de referência da campanha não existe em ${path}. Defina FLUXO_BACKEND_DIR com a pasta do back (B184).`);
  }
  return readFileSync(path, 'utf8');
}

/** The key of a line as the panel writes it: "nota_id 1 · item_seq 1". */
export function keyOf(table: ReferenceTable, row: readonly string[]): Record<string, string> {
  const named = rowOf(table, row);
  return { nota_id: named.nota_id ?? '', item_seq: named.item_seq ?? '' };
}

function calculatedRows(table: ReferenceTable): string[][] {
  return table.rows.filter((row) => {
    const named = rowOf(table, row);
    return CALCULATED.has(named.status ?? '') && (named.pontos ?? '') !== '';
  });
}

/** The changed copy of roteiro 4: one `pontos` changed (+1,00) and another calculated line removed. */
export interface ChangedFile {
  text: string;
  /** The key of the record with the changed `pontos`: "different", with expected × obtained. */
  changedKey: Record<string, string>;
  expected: string;
  obtained: string;
  /** The key of the removed line: "missing_from_file". */
  removedKey: Record<string, string>;
  /** The data lines of the copy. */
  records: number;
}

export function changedFile(source: string): ChangedFile {
  const table = parseCsv(source);
  const [changed, removed] = calculatedRows(table);
  if (!changed || !removed) throw new Error('O arquivo de referência não tem dois registros calculados para mudar.');
  const column = table.header.indexOf('pontos');
  const obtained = changed[column] ?? '';
  const expected = (Number(obtained) + 1).toFixed(2);
  const rows = table.rows.filter((row) => row !== removed).map((row) => (row === changed ? row.map((cell, index) => (index === column ? expected : cell)) : row));
  return { text: writeCsv({ header: table.header, rows }), changedKey: keyOf(table, changed), expected, obtained, removedKey: keyOf(table, removed), records: rows.length };
}

/** The file with errors of roteiro 5: an unknown column (`observacao`) and a number with a comma in `pontos`. */
export interface BrokenFile {
  text: string;
  /** "linha 3, coluna pontos": the line of the comma (the header is line 1). */
  where: string;
}

export function brokenFile(source: string): BrokenFile {
  const table = parseCsv(source);
  const column = table.header.indexOf('pontos');
  const target = calculatedRows(table)[0];
  if (!target) throw new Error('O arquivo de referência não tem registro calculado.');
  const line = table.rows.indexOf(target) + 2;
  const rows = table.rows.map((row) => [...(row === target ? row.map((cell, index) => (index === column ? cell.replace('.', ',') : cell)) : row), 'conferido']);
  // The comma would split the cell: the value goes between quotes (RFC 4180), as a spreadsheet saves it.
  const quoted = rows.map((row) => row.map((cell) => (cell.includes(',') ? `"${cell}"` : cell)));
  return { text: writeCsv({ header: [...table.header, 'observacao'], rows: quoted }), where: `linha ${line}, coluna pontos` };
}

/** The data lines of a file. */
export function recordCount(text: string): number {
  return parseCsv(text).rows.length;
}
