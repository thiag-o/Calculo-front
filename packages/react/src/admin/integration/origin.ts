// Client-side validation of an authorized domain origin, in the contract format: `https?://host[:port]`, without
// path, query or fragment. The API validates again (`422 origem_invalida`) and normalizes (lower case, no trailing
// slash, no default port); here we only avoid the round trip on common errors.

export const EMPTY_ORIGIN_MESSAGE = 'Informe a origem';
export const ORIGIN_WITHOUT_SCHEME_MESSAGE = 'Comece com https:// ou http://, como https://app.exemplo.com.br';
export const ORIGIN_WITH_PATH_MESSAGE = 'Tire o caminho, a consulta e o fragmento: só https://host e, se precisar, :porta';
export const ORIGIN_INVALID_HOST_MESSAGE = 'Confira o host e a porta, como https://app.exemplo.com.br:8443';

// Scheme, authority (no space, "/", "?", "#" or "@") and, at most, one trailing slash.
const FORMAT = /^https?:\/\/[^\s/?#@]+\/?$/i;

/** Why the origin is invalid, or `undefined` if it follows `https?://host[:port]`. */
export function originProblem(value: string): string | undefined {
  const origin = value.trim();
  if (origin === '') return EMPTY_ORIGIN_MESSAGE;
  if (!/^https?:\/\//i.test(origin)) return ORIGIN_WITHOUT_SCHEME_MESSAGE;
  const authority = origin.replace(/^https?:\/\//i, '');
  if (/[/?#]/.test(authority.replace(/\/$/, ''))) return ORIGIN_WITH_PATH_MESSAGE;
  if (!FORMAT.test(origin)) return ORIGIN_INVALID_HOST_MESSAGE;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return ORIGIN_INVALID_HOST_MESSAGE;
  }
  // The port, if present, must be digits only (URL would accept an empty ":").
  if (url.hostname === '' || /:$/.test(authority.replace(/\/$/, ''))) return ORIGIN_INVALID_HOST_MESSAGE;
  return undefined;
}
