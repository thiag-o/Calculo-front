// The expected results of the reference campaign used by the epic 5 flows, calculated by hand from the rules of
// ../backend/docs/campanha-de-referencia.md and the data of B98 (the same for both modes). The backend's acceptance
// (B100, `backend/tests/reference_campaign/`) calculates them too; when it lands, these must be the same numbers.
//
// The preview counts depend on how a record that ended earlier (ignored, filtered, error) is counted by the blocks after
// it, which the contract does not fix. `real` marks the counts that do not depend on it (checked in both modes); the
// others are the simulation's (a record stops at the block that ended it) and are checked only in the simulated mode.
import { BLOCKS } from './campaign';

/** The records read by the preview: the 60 items less the 2 cancelled ones (3/2 and 20/2). */
export const COUNTED_RECORDS = 58;

export const EXPECTED_COUNTS: readonly { block: string; text: string; real: boolean }[] = [
  // Every item has its invoice.
  { block: BLOCKS.invoice, text: '58 encontrados', real: true },
  { block: BLOCKS.invoice, text: '0 sem correspondência', real: true },
  { block: BLOCKS.invoice, text: '0 com mais de uma linha', real: true },
  // Invoices 18 and 19 (store 4, out of the campaign): 6 items without a store, discarded.
  { block: BLOCKS.store, text: '52 encontrados', real: true },
  { block: BLOCKS.store, text: '6 sem correspondência', real: true },
  // P15 (6/2 and 16/3) is not a product of the campaign.
  { block: BLOCKS.inCampaign, text: '50 passaram no filtro', real: false },
  { block: BLOCKS.inCampaign, text: '2 filtrados', real: true },
  // P14 (5/3 and 14/1) has no record; P12 (8/1 and 15/2) has two active ones.
  { block: BLOCKS.product, text: '46 encontrados', real: false },
  { block: BLOCKS.product, text: '2 sem correspondência', real: true },
  { block: BLOCKS.product, text: '2 com mais de uma linha (máx. 2)', real: true },
  { block: BLOCKS.parameters, text: '48 encontrados', real: false },
  // P11 (category ACA, 2/3 and 12/1) has no factor.
  { block: BLOCKS.factor, text: '46 encontrados', real: false },
  { block: BLOCKS.factor, text: '2 sem correspondência', real: false },
];

export interface ExpectedRecord {
  key: { nota_id: string; item_seq: string };
  /** The record status, as the screen says it. */
  status: 'ok' | 'com avisos' | 'erro' | 'ignorado' | 'filtrado';
  /** The output fields, in the Brazilian pattern (only when the record has them). */
  outputs?: { pontos: string; elegivel: 'verdadeiro' | 'falso' };
  /** The rule of "Multiplicador" that matched. */
  rule?: number;
  /** Values of the blocks, by block and variable, in the Brazilian pattern. */
  values?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** The code of the record's error or of the warning that ended it. */
  code?: string;
}

/**
 * 1/1: P01 (CIM, factor 0.05), 10 units of 389.00 at store 1 (SP): rule 3 (10 units or more, 1.20); base points
 * 389.00 × 0.05 = 19.45; points 19.45 × 1.20 = 23.34, under the ceiling of 150.00. It is the first record of the sample.
 */
export const FIRST_RECORD: ExpectedRecord = {
  key: { nota_id: '1', item_seq: '1' },
  status: 'ok',
  outputs: { pontos: '23,34', elegivel: 'verdadeiro' },
  rule: 3,
  values: {
    [BLOCKS.factor]: { fator: '0,05' },
    [BLOCKS.basePoints]: { pontos_base: '19,45' },
    [BLOCKS.points]: { pontos: '23,34' },
  },
};

/** The records typed by the key, one per case of the campaign (docs/campanha-de-referencia.md, "Casos de borda"). */
export const TYPED_RECORDS: readonly ExpectedRecord[] = [
  // P12 with two active records: the newest one (TIN, 0.10) counts, with the warning; store 2 (PE): rule 4 (1.10).
  // 308.00 × 0.10 = 30.80; 30.80 × 1.10 = 33.88.
  { key: { nota_id: '8', item_seq: '1' }, status: 'com avisos', outputs: { pontos: '33,88', elegivel: 'verdadeiro' }, rule: 4, code: 'multiple_rows' },
  // 3,468.00 of P03 (TIN, 0.10), 12 units: rule 2 (1,000.00 or more, 1.50); 346.80 × 1.50 = 520.20, the ceiling leaves 150.00.
  { key: { nota_id: '20', item_seq: '3' }, status: 'ok', outputs: { pontos: '150,00', elegivel: 'verdadeiro' }, rule: 2 },
  // P01 with one unit (38.90 × 0.05 = 1.945 → 1.95, the half away from zero); store 2 (PE): rule 4; 1.95 × 1.10 = 2.145 → 2.15.
  { key: { nota_id: '11', item_seq: '2' }, status: 'ok', outputs: { pontos: '2,15', elegivel: 'verdadeiro' }, rule: 4 },
  // P11 (ACA, no factor): the factor stays null with the warning, the base points use the default 0; rule 3; points 0.00.
  { key: { nota_id: '2', item_seq: '3' }, status: 'com avisos', outputs: { pontos: '0,00', elegivel: 'verdadeiro' }, rule: 3, code: 'no_match' },
  // P10 (HID, 0.07) with one unit of 19.90: rule 1 (under 20.00, not eligible, 0.00); 19.90 × 0.07 = 1.393 → 1.39;
  // 1.39 × 0.00 = 0.00.
  { key: { nota_id: '2', item_seq: '2' }, status: 'ok', outputs: { pontos: '0,00', elegivel: 'falso' }, rule: 1 },
  // Invoice 18 is of store 4 (out of the campaign): the store's filter leaves no line, "Descartar" ignores the record.
  { key: { nota_id: '18', item_seq: '1' }, status: 'ignorado', code: 'no_match' },
  // P15 is not a product of the campaign: filtered by "Produto na campanha".
  { key: { nota_id: '6', item_seq: '2' }, status: 'filtrado' },
  // P14 has no product record: "Gerar erro".
  { key: { nota_id: '5', item_seq: '3' }, status: 'erro', code: 'no_match' },
  // A cancelled item is outside the batch source's filter.
  { key: { nota_id: '3', item_seq: '2' }, status: 'filtrado' },
];
