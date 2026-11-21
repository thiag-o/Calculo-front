// Numbers of the "Calcular" tab (E4-24): typed in the Brazilian pattern, sent to the API as text with a dot, shown back in
// the Brazilian pattern. Only text is handled: a calculation value never becomes a floating-point `number` (E4-4).

/** The typed number, as the API text (`"1500.00"`), or why it was refused. */
export type NumberReading = { ok: true; value: string } | { ok: false; message: string };

// Optional sign, the whole part with or without thousands dots (groups of 3) and the decimals after the comma. With
// thousands dots the first group starts at 1-9: "0.500", "0.001" and "00.123" are a dot used as the decimal separator,
// not 500, 1 and 123 (reading them as thousands would send a value a thousand times bigger).
const BRAZILIAN_NUMBER = /^([+-]?)([1-9]\d{0,2}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;
// "1500.5", "0.500": a dot used as the decimal separator.
const DOT_DECIMAL = /^[+-]?\d+\.\d+$/;

function decimalsMessage(scale: number): string {
  if (scale === 0) return 'Use um número inteiro, sem casas decimais.';
  return scale === 1 ? 'Use no máximo 1 casa decimal.' : `Use no máximo ${scale} casas decimais.`;
}

/**
 * Reads a number typed in the Brazilian pattern (`1500,00`, `1.500,00`, `-3`) as the API text (`"1500.00"`, `"-3"`).
 * `scale` is the number of decimal places of the input (0 for `integer`; `null` when the input has none declared): a value
 * with more places is refused, never rounded (E4-14). The decimals go as typed (`1500,5` → `"1500.5"`). Empty text is
 * not a number: the caller sends it as null.
 */
export function readBrazilianNumber(text: string, scale: number | null): NumberReading {
  const typed = text.trim();
  const match = BRAZILIAN_NUMBER.exec(typed);
  if (!match) {
    if (DOT_DECIMAL.test(typed)) return { ok: false, message: 'Use vírgula para separar os decimais, como 1.500,50.' };
    return { ok: false, message: scale === 0 ? 'Digite um número inteiro, como 1.500.' : 'Digite um número, como 1.500,50.' };
  }
  const [, sign = '', whole = '', decimals] = match;
  if (decimals !== undefined && scale !== null && decimals.length > scale) return { ok: false, message: decimalsMessage(scale) };
  const digits = whole.replaceAll('.', '').replace(/^0+(?=\d)/, '');
  const zero = /^0*$/.test(digits + (decimals ?? ''));
  const value = `${sign === '-' && !zero ? '-' : ''}${digits}${decimals === undefined ? '' : `.${decimals}`}`;
  return { ok: true, value };
}

/** Shows a number of the API (`"1500.00"`, `"-3"`) in the Brazilian pattern (`1.500,00`, `-3`), keeping every decimal. */
export function formatApiNumber(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign = '', whole = '', decimals] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}${decimals === undefined ? '' : `,${decimals}`}`;
}
