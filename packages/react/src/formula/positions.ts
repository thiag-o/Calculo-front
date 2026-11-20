// Problem positions (Contracts, "Linguagem de fórmula e motor"): the API counts code points from 0, with `end` exclusive.
// Monaco and the DOM count UTF-16 code units. These functions convert between them; the rules themselves stay in the API.

/** UTF-16 offset of code point `codePoint` in `text`. Beyond the end, the end of the text. */
export function codePointToUtf16(text: string, codePoint: number): number {
  if (codePoint <= 0) return 0;
  let points = 0;
  let units = 0;
  while (units < text.length && points < codePoint) {
    const code = text.codePointAt(units)!;
    units += code > 0xffff ? 2 : 1;
    points++;
  }
  return units;
}

/** The `[start, end)` range of a problem in UTF-16 units, or `null` when the problem has no position. */
export function utf16Range(text: string, start: number | null, end: number | null): { start: number; end: number } | null {
  if (start === null) return null;
  const from = codePointToUtf16(text, start);
  const to = codePointToUtf16(text, end ?? start);
  return { start: from, end: Math.max(from, to) };
}

/** `text` with the code points `[start, end)` replaced by `replacement` (the quick fix outside Monaco). */
export function replaceCodePoints(text: string, start: number, end: number, replacement: string): string {
  const range = utf16Range(text, start, end)!;
  return text.slice(0, range.start) + replacement + text.slice(range.end);
}
