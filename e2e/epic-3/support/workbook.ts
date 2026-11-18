// Excel workbooks (.xlsx) for the epic 3 tests, written here, without a library: an .xlsx is a zip of XML files. The test
// declares the sheets (header, values and the type the backend should infer for each column) and sends the bytes as a
// person would. In real mode the backend reads the file (openpyxl) and infers the types; in simulated mode the simulation
// answers with the types the test declared (see `simulation.ts`).
import { createHash } from 'node:crypto';
import { crc32, deflateRawSync } from 'node:zlib';
import type { Schemas } from '../../support/contract';

type DataType = Schemas['DataType'];

/** A cell: text, number, boolean, a date (`{ date: 'YYYY-MM-DD' }`), a date with time (`{ dateTime: 'YYYY-MM-DDTHH:mm:ss' }`) or empty. */
export type CellValue = string | number | boolean | { date: string } | { dateTime: string } | null;

/** A column of a sheet: the header, the values under it and what the backend should infer. */
export interface ColumnSpec {
  header: string;
  values: readonly CellValue[];
  /** The `DataType` the inference should give. */
  type: DataType;
  /** Decimal places, only for `decimal`. */
  scale?: number;
  /** The Python type name the backend reports as `source_type` (`int`, `float`, `str`, `bool`, `datetime`, `mixed`, `empty`). */
  sourceType: string;
}

export interface SheetSpec {
  name: string;
  columns: readonly ColumnSpec[];
}

/** A generated workbook: the bytes to send and what it should contain. */
export interface Workbook {
  fileName: string;
  bytes: Buffer;
  sha256: string;
  sheets: readonly SheetSpec[];
}

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_MIME = MIME;

/** Builds the .xlsx of the sheets (inline text, numbers, booleans and dates with the built-in date formats). */
export function createWorkbook(fileName: string, sheets: readonly SheetSpec[]): Workbook {
  const files: [string, string][] = [
    ['[Content_Types].xml', contentTypes(sheets.length)],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbookXml(sheets)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sheets.length)],
    ['xl/styles.xml', STYLES],
    ...sheets.map((sheet, index): [string, string] => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)]),
  ];
  const bytes = zip(files.map(([name, text]) => ({ name, data: Buffer.from(text, 'utf8') })));
  return { fileName, bytes, sha256: createHash('sha256').update(bytes).digest('hex'), sheets };
}

// --- XML -------------------------------------------------------------------------------------------------------------

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Style index of each kind of cell, in `STYLES` (`cellXfs`): 0 general, 1 date (format 14), 2 date and time (format 22). */
const DATE_STYLE = 1;
const DATE_TIME_STYLE = 2;

function contentTypes(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return (
    XML_HEADER +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets +
    '</Types>'
  );
}

const ROOT_RELS =
  XML_HEADER +
  `<Relationships xmlns="${PACKAGE_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>';

function workbookXml(sheets: readonly SheetSpec[]): string {
  const items = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`);
  return XML_HEADER + `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${items.join('')}</sheets></workbook>`;
}

function workbookRels(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) => `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  );
  const styles = `<Relationship Id="rId${sheetCount + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>`;
  return XML_HEADER + `<Relationships xmlns="${PACKAGE_REL_NS}">${sheets.join('')}${styles}</Relationships>`;
}

const STYLES =
  XML_HEADER +
  `<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function sheetXml(sheet: SheetSpec): string {
  const rowCount = Math.max(0, ...sheet.columns.map((column) => column.values.length));
  const rows: string[] = [];
  const header = sheet.columns.map((column, index) => cellXml(`${columnLetters(index)}1`, column.header));
  rows.push(`<row r="1">${header.join('')}</row>`);
  for (let row = 0; row < rowCount; row += 1) {
    const cells = sheet.columns.map((column, index) => cellXml(`${columnLetters(index)}${row + 2}`, column.values[row] ?? null));
    rows.push(`<row r="${row + 2}">${cells.join('')}</row>`);
  }
  return XML_HEADER + `<worksheet xmlns="${MAIN_NS}"><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function cellXml(reference: string, value: CellValue): string {
  if (value === null) return '';
  if (typeof value === 'string') return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (typeof value === 'number') return `<c r="${reference}"><v>${String(value)}</v></c>`;
  if ('date' in value) return `<c r="${reference}" s="${DATE_STYLE}"><v>${excelSerial(`${value.date}T00:00:00`)}</v></c>`;
  return `<c r="${reference}" s="${DATE_TIME_STYLE}"><v>${excelSerial(value.dateTime)}</v></c>`;
}

/** Days since 1899-12-30 (the Excel epoch, 1900 system), with the time as the fraction of the day. */
function excelSerial(localDateTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) throw new Error(`Data fora do formato YYYY-MM-DDTHH:mm:ss: ${localDateTime}`);
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number];
  const days = (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
  const fraction = (hour * 3600 + minute * 60 + second) / 86_400;
  return fraction === 0 ? String(days) : String(days + fraction);
}

/** The Excel letters of the 0-based column: 0 → A, 25 → Z, 26 → AA. */
function columnLetters(index: number): string {
  let letters = '';
  let number = index + 1;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Zip -------------------------------------------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** A zip with the entries compressed by deflate (method 8), with a fixed date (01/01/2026 00:00). */
function zip(entries: readonly ZipEntry[]): Buffer {
  const DOS_TIME = 0;
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
