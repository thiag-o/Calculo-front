// Vertical "api" (ADR 0003).
// HTTP client, types generated from the backend OpenAPI and TanStack Query setup. Shared vertical: depends on no other.
// This file is the vertical's public interface; the rest of the folder is private.

// Types generated from the contract (ADR 0005). Never written by hand.
export type { components, operations, paths } from './generated/schema';
import type { components } from './generated/schema';
/** The contract schemas (e.g. `Schemas['Session']`). */
export type Schemas = components['schemas'];

// Cliente HTTP.
export { createApiClient } from './client/createApiClient';
export type { ApiClient, AuthMode, ApiClientOptions } from './client/createApiClient';
export { UNEXPECTED_RESPONSE_CODE, NO_CONNECTION_CODE, ApiError, dataOrError } from './client/apiError';
export type { ProblemBody } from './client/apiError';
export { ApiProvider, useApiClient } from './client/ApiProvider';
export type { ApiProviderProps } from './client/ApiProvider';

// TanStack Query.
export { createQueryClient } from './queries/createQueryClient';
