import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from '../generated/schema';
import { problemCode } from './apiError';
import { upload, type MultipartPath, type UploadOptions, type UploadResult } from './upload';

/** `cookie`: shell app, cookie session with CSRF. `token`: embedded, `Authorization: Bearer`. */
export type AuthMode = 'cookie' | 'token';

export interface ApiClientOptions {
  /** API address, without `/v1` (e.g. `https://api.exemplo.com`). */
  apiUrl: string;
  /** Embed token. With it the client uses `Authorization: Bearer`; without it, the session cookie. */
  token?: string;
}

export interface ApiClient extends Client<paths> {
  readonly mode: AuthMode;
  /**
   * Notifies when the API answers `401 no_session` (session missing, revoked or expired; token expired).
   * Returns the function that cancels the notification.
   */
  onSessionExpired(listener: () => void): () => void;
  /**
   * Sends a `multipart/form-data` POST (e.g. `/v1/excel-files`) reporting how much of the body went out, which fetch
   * cannot do. Same authentication, errors and session notice as the other calls: resolves with the `201` body or
   * rejects with `ApiError`; `signal` cancels it with an `AbortError`.
   */
  upload<P extends MultipartPath>(path: P, body: FormData, options?: UploadOptions): Promise<UploadResult<P>>;
}

/** Cookie with the CSRF token issued on sign-in (not HttpOnly, so the front can read it). */
const CSRF_COOKIE = 'fc_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const NO_SESSION_CODE = 'no_session';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const pair of document.cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      const value = pair.slice(separator + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

async function responseCode(response: Response): Promise<string | undefined> {
  try {
    return problemCode(await response.clone().json());
  } catch {
    return undefined;
  }
}

/**
 * Creates the API HTTP client (openapi-fetch, typed by the contract).
 * - **Cookie mode** (without `token`): `credentials: 'include'` and, on POST, PUT, PATCH and DELETE,
 *   the `X-CSRF-Token` header with the value of the `fc_csrf` cookie, read on every request.
 * - **Token mode** (with `token`): `Authorization: Bearer <token>`, no cookies and no CSRF.
 */
export function createApiClient({ apiUrl, token }: ApiClientOptions): ApiClient {
  const mode: AuthMode = token === undefined ? 'cookie' : 'token';
  const listeners = new Set<() => void>();
  const notifySessionExpired = () => {
    for (const listener of [...listeners]) listener();
  };

  const http = createClient<paths>({
    baseUrl: apiUrl,
    // Reads the global fetch on every call (not at creation), to respect whoever replaces it later.
    fetch: (request) => globalThis.fetch(request),
    credentials: mode === 'cookie' ? 'include' : 'omit',
    headers: mode === 'token' ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const auth: Middleware = {
    onRequest({ request }) {
      if (mode !== 'cookie' || !CSRF_METHODS.has(request.method.toUpperCase())) return undefined;
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf !== undefined) request.headers.set(CSRF_HEADER, csrf);
      return undefined;
    },
    async onResponse({ response }) {
      if (response.status === 401 && (await responseCode(response)) === NO_SESSION_CODE) notifySessionExpired();
      return undefined;
    },
  };
  http.use(auth);

  const uploadSettings = {
    apiUrl,
    token,
    csrfHeader: () => {
      const csrf = readCookie(CSRF_COOKIE);
      return csrf === undefined ? undefined : ([CSRF_HEADER, csrf] as const);
    },
    onNoSession: notifySessionExpired,
  };

  return Object.assign(http, {
    mode,
    onSessionExpired(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    upload<P extends MultipartPath>(path: P, body: FormData, options?: UploadOptions): Promise<UploadResult<P>> {
      return upload(uploadSettings, path, body, options);
    },
  });
}
