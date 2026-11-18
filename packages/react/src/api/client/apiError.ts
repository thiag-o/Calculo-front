import type { components } from '../generated/schema';

/** The contract's problem+json body, with each error's extension members (e.g. `unlocks_at`). */
export type ProblemBody = components['schemas']['Problem'] & Readonly<Record<string, unknown>>;

/**
 * Codes born in the client itself, when there is no problem+json to read.
 * The other codes come from the backend (OpenAPI contract).
 */
export const NO_CONNECTION_CODE = 'no_connection';
export const UNEXPECTED_RESPONSE_CODE = 'unexpected_response';

const NO_CONNECTION_MESSAGE = 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.';
const UNEXPECTED_RESPONSE_MESSAGE = 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.';

/**
 * Error of an API call. The screen decides by `code`, never by the text (ADR 0005).
 * - `status`: HTTP status of the response (0 when there was no response);
 * - `message` (inherited from `Error`): pt-BR text for the end user;
 * - `fields`: error of each body field (empty when the error is not a field error);
 * - `body`: the whole problem+json, for the extension members (absent when there was no problem+json).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly body: ProblemBody | undefined;

  constructor(data: {
    status: number;
    code: string;
    message: string;
    fields?: Readonly<Record<string, string>>;
    body?: ProblemBody;
    cause?: unknown;
  }) {
    super(data.message, data.cause === undefined ? undefined : { cause: data.cause });
    this.name = 'ApiError';
    this.status = data.status;
    this.code = data.code;
    this.fields = data.fields ?? {};
    this.body = data.body;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the `code` of a problem+json body; `undefined` if the body is not one. */
export function problemCode(body: unknown): string | undefined {
  return isObject(body) && typeof body.code === 'string' && body.code !== '' ? body.code : undefined;
}

function problemFields(fields: unknown): Record<string, string> {
  if (!isObject(fields)) return {};
  const result: Record<string, string> = {};
  for (const [field, error] of Object.entries(fields)) {
    if (typeof error === 'string') result[field] = error;
  }
  return result;
}

/** Converts the error response (and the already read body) into `ApiError`. Only the status of the response is read. */
export function responseError(response: Pick<Response, 'status'>, body: unknown): ApiError {
  const code = problemCode(body);
  if (code === undefined || !isObject(body)) {
    return new ApiError({ status: response.status, code: UNEXPECTED_RESPONSE_CODE, message: UNEXPECTED_RESPONSE_MESSAGE });
  }
  const message =
    typeof body.detail === 'string' && body.detail !== ''
      ? body.detail
      : typeof body.title === 'string' && body.title !== ''
        ? body.title
        : UNEXPECTED_RESPONSE_MESSAGE;
  return new ApiError({
    status: response.status,
    code,
    message,
    fields: problemFields(body.fields),
    body: body as ProblemBody,
  });
}

/** Network error: the request never got a response. */
export function noConnectionError(cause: unknown): ApiError {
  return new ApiError({ status: 0, code: NO_CONNECTION_CODE, message: NO_CONNECTION_MESSAGE, cause: cause });
}

/** Whether the error is a cancelled request (`AbortError`), which is not a failure to show. */
export function isCancellation(error: unknown): boolean {
  return isObject(error) && error.name === 'AbortError';
}

/** The result of an openapi-fetch call. */
interface CallResult<D> {
  data?: D;
  error?: unknown;
  response: Response;
}

/**
 * Awaits the call and returns the data of the success response, or throws `ApiError`.
 * Typical use in a query: `queryFn: () => dataOrError(client.GET('/v1/session'))`.
 * Cancellation (`AbortError`, e.g. a query cancelled by TanStack Query) passes through without conversion.
 */
export async function dataOrError<D>(call: Promise<CallResult<D>>): Promise<D> {
  let result: CallResult<D>;
  try {
    result = await call;
  } catch (error) {
    if (error instanceof ApiError || isCancellation(error)) throw error;
    // fetch rejects with TypeError when there is no response (network, CORS, server down).
    if (error instanceof TypeError) throw noConnectionError(error);
    throw error;
  }
  if (!result.response.ok) throw responseError(result.response, result.error);
  return result.data as D;
}
