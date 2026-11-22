// How a record reads in the panel (estilos.md §7.5): the status as dot + word, the key and where the error happened.
import type { Schemas } from '../../api';
import type { StatusTone } from '../../design-system';
import type { RecordFailureCode, RecordStatus } from '../api';

type ExecutionRecordKey = Schemas['ExecutionRecordKey'];

/** The record status (estilos.md §7.5): dot + word. */
export const RECORD_STATUS: Readonly<Record<RecordStatus, { tone: StatusTone; word: string }>> = {
  ok: { tone: 'green', word: 'ok' },
  ok_with_warnings: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  ignored: { tone: 'gray', word: 'ignorado' },
  filtered: { tone: 'multi', word: 'filtrado' },
};

/** The status filter of the records, in the order of estilos.md §7.5. */
export const RECORD_STATUS_CHOICES: readonly { value: RecordStatus; label: string }[] = [
  { value: 'ok', label: 'ok' },
  { value: 'ok_with_warnings', label: 'com avisos' },
  { value: 'error', label: 'erro' },
  { value: 'ignored', label: 'ignorado' },
  { value: 'filtered', label: 'filtrado' },
];

/** The two key errors of the batch (D75): the record was not calculated and has no trace of its own. */
const KEY_ERRORS: ReadonlySet<string> = new Set(['null_record_key', 'duplicate_record_key']);

export const BATCH_SOURCE_NAME = 'Fonte do lote';
export const BATCH_KEY_NAME = 'Chave do lote';

/** Where an error without a node happened: the batch key (the key errors) or the batch source (the others). */
export function nodelessName(code: RecordFailureCode | null): string {
  return code !== null && KEY_ERRORS.has(code) ? BATCH_KEY_NAME : BATCH_SOURCE_NAME;
}

/** `nf_id 10 · item_seq 1`; a null part (the `null_record_key` error) is "—". */
export function recordKeyText(key: ExecutionRecordKey): string {
  const parts = Object.entries(key).map(([name, value]) => `${name} ${value === null || value === '' ? '—' : value}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
