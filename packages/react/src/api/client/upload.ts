import type { paths } from '../generated/schema';
import { noConnectionError, problemCode, responseError } from './apiError';

/** How much of the body went to the server: bytes sent so far and the total. */
export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface UploadOptions {
  /** Called as the body goes out (only when the browser knows the total). */
  onProgress?: (progress: UploadProgress) => void;
  /** Cancels the upload; the promise rejects with an `AbortError`, like a cancelled fetch. */
  signal?: AbortSignal;
}

/** The contract paths whose POST takes a `multipart/form-data` body (e.g. `/v1/excel-files`). */
export type MultipartPath = {
  [P in keyof paths]: paths[P] extends { post: { requestBody: { content: { 'multipart/form-data': unknown } } } } ? P : never;
}[keyof paths];

/** The body of the `201` of a multipart POST, as the contract declares it. */
export type UploadResult<P extends MultipartPath> = paths[P] extends {
  post: { responses: { 201: { content: { 'application/json': infer Body } } } };
}
  ? Body
  : never;

/** What the upload needs from the client: where the API is and how to authenticate. */
export interface UploadSettings {
  apiUrl: string;
  /** Bearer token (embedded mode); without it, the session cookie goes along. */
  token?: string;
  /** The CSRF header of cookie mode, read at call time (`undefined` without the cookie). */
  csrfHeader: () => readonly [name: string, value: string] | undefined;
  /** Called on `401 no_session`. */
  onNoSession: () => void;
}

const NO_SESSION_CODE = 'no_session';

function parseBody(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function abortError(): Error {
  return new DOMException('O envio foi cancelado.', 'AbortError');
}

/**
 * Sends a `multipart/form-data` POST with upload progress. fetch does not report how much of the body went out, so this
 * call uses XMLHttpRequest (read from `globalThis` at call time, to respect whoever replaces it, like the fetch of the
 * other calls), with the same authentication: cookie with `X-CSRF-Token`, or `Authorization: Bearer` without cookies.
 * Resolves with the body of the success response or rejects with `ApiError` (`no_connection` when there is no response),
 * exactly like `dataOrError`; `401 no_session` also notifies the session listeners.
 */
export function upload<P extends MultipartPath>(
  settings: UploadSettings,
  path: P,
  body: FormData,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadResult<P>> {
  return new Promise<UploadResult<P>>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const request = new globalThis.XMLHttpRequest();
    request.open('POST', `${settings.apiUrl.replace(/\/+$/, '')}${path}`);
    request.responseType = 'text';
    request.setRequestHeader('Accept', 'application/json, application/problem+json');
    if (settings.token !== undefined) {
      request.withCredentials = false;
      request.setRequestHeader('Authorization', `Bearer ${settings.token}`);
    } else {
      request.withCredentials = true;
      const csrf = settings.csrfHeader();
      if (csrf !== undefined) request.setRequestHeader(csrf[0], csrf[1]);
    }

    const stopListening = () => signal?.removeEventListener('abort', cancel);
    function cancel() {
      request.abort();
    }
    signal?.addEventListener('abort', cancel, { once: true });

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total });
    });
    request.addEventListener('load', () => {
      stopListening();
      const parsed = parseBody(request.responseText);
      if (request.status >= 200 && request.status < 300) {
        resolve(parsed as UploadResult<P>);
        return;
      }
      if (request.status === 401 && problemCode(parsed) === NO_SESSION_CODE) settings.onNoSession();
      reject(responseError({ status: request.status }, parsed));
    });
    request.addEventListener('error', () => {
      stopListening();
      // Like fetch: no response at all (network, CORS, server down).
      reject(noConnectionError(new TypeError('O envio não recebeu resposta.')));
    });
    request.addEventListener('abort', () => {
      stopListening();
      reject(abortError());
    });

    request.send(body);
  });
}
