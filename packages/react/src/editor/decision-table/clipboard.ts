import { cutCell } from './tableModel';

/**
 * The longest text a paste reads (2 MB of text, counted in UTF-16 units). The clipboard is data from outside: a longer
 * text is refused with a message, before being parsed, so the page does not freeze.
 */
export const MAX_PASTE_LENGTH = 2 * 1024 * 1024;

const LINE_BREAKS = /\r\n|\r|\n/g;
// Control characters, the Unicode line and paragraph separators and the byte order mark: they do not belong in a formula
// and are invisible in the cell. The tab stays (it is a space in the formula). The escapes are on purpose.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029\uFEFF]/g;

/**
 * A pasted (or typed) cell made fit for the formula: line breaks inside it become a space (a cell is one line), control
 * characters are removed and the text is cut at the cell limit (10,000), without splitting a surrogate pair.
 */
export function cleanCell(value: string): string {
  return cutCell(value.replace(LINE_BREAKS, ' ').replace(CONTROL_CHARACTERS, ''));
}

/** A block read from the clipboard: the cells kept (within the limits) and the size of the whole block. */
export interface ClipboardBlock {
  /** The cells inside the limits, cleaned (see `cleanCell`). */
  cells: string[][];
  /** How many rows the whole block has, kept or not. */
  rows: number;
  /** How many cells the widest row of the whole block has, kept or not. */
  width: number;
}

export interface ClipboardLimits {
  /** Rows kept (the rest are only counted). */
  rows?: number;
  /** Cells kept in each row (the rest are only counted). */
  columns?: number;
}

/**
 * A block copied from Excel (or another spreadsheet) as text: rows split by line breaks, cells by tabs (E4-22).
 *
 * Excel puts a cell between double quotes when it has a line break or a quote inside, doubling the quotes within. A cell
 * that only starts and ends with a quote is kept as it is: in the formula language `"A"` is a text literal, and Excel
 * copies it bare. So a quoted cell is unquoted only when there is a line break or a doubled quote inside and the closing
 * quote comes right before a tab, a line break or the end. The line break at the very end (Excel always adds one) is not
 * a row.
 *
 * Only the cells within `limits` are kept, so a huge block does not fill the memory; the others are only counted.
 */
export function parseClipboard(text: string, limits: ClipboardLimits = {}): ClipboardBlock {
  const maxRows = limits.rows ?? Number.POSITIVE_INFINITY;
  const maxColumns = limits.columns ?? Number.POSITIVE_INFINITY;
  const cells: string[][] = [];
  let row: string[] = [];
  let rows = 0;
  let width = 0;
  let rowWidth = 0;
  let firstCell = '';
  let index = 0;
  const length = text.length;

  const finishRow = () => {
    if (rows < maxRows) cells.push(row);
    rows++;
    if (rowWidth > width) width = rowWidth;
    row = [];
    rowWidth = 0;
  };

  for (;;) {
    const kept = rows < maxRows && rowWidth < maxColumns;
    const first = rows === 0 && rowWidth === 0;
    let cell = '';
    const quoted = text[index] === '"' ? readQuoted(text, index) : null;
    if (quoted) {
      cell = quoted.value;
      index = quoted.end;
    } else {
      let end = index;
      while (end < length && text[end] !== '\t' && text[end] !== '\n' && text[end] !== '\r') end++;
      if (kept || first) cell = text.slice(index, end);
      index = end;
    }
    if (kept) row.push(cleanCell(cell));
    if (first) firstCell = cell;
    rowWidth++;

    if (index >= length) {
      finishRow();
      break;
    }
    if (text[index] === '\t') {
      index++;
      continue;
    }
    // A line break: "\r\n", "\n" or "\r".
    index += text[index] === '\r' && text[index + 1] === '\n' ? 2 : 1;
    finishRow();
    if (index >= length) break;
  }

  // Nothing, or only the line break of the end: no block at all.
  if (rows === 1 && width === 1 && firstCell === '') return { cells: [], rows: 0, width: 0 };
  return { cells, rows, width };
}

/**
 * A cell between quotes from `start` (the opening quote), or `null` when it is not one: there must be a line break or a
 * doubled quote inside, every other quote inside doubled, and the closing quote right before a tab, a line break or the
 * end.
 */
function readQuoted(text: string, start: number): { value: string; end: number } | null {
  let value = '';
  let index = start + 1;
  let escaped = false;
  while (index < text.length) {
    const character = text[index]!;
    if (character === '"') {
      if (text[index + 1] === '"') {
        value += '"';
        escaped = true;
        index += 2;
        continue;
      }
      const after = text[index + 1];
      const closes = after === undefined || after === '\t' || after === '\n' || after === '\r';
      return closes && escaped ? { value, end: index + 1 } : null;
    }
    if (character === '\n' || character === '\r') escaped = true;
    value += character;
    index++;
  }
  return null;
}

/** Whether pasted text is a block of cells (more than one cell) rather than text for one cell. */
export function isBlock(text: string): boolean {
  return /[\t\n\r]/.test(text.replace(/(\r\n|\n|\r)$/, ''));
}
