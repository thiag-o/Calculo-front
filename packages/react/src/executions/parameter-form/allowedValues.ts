// The values of a parameter whose `allowed_values` is a query (E7-23): read from the API, 300 ms after the last key.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { EXECUTIONS_KEY } from '../api';
import type { ScalarType } from './literals';

export type AllowedValues = Schemas['AllowedValues'];

/** The wait after the last key before the values are asked again (plan, E7-23). */
export const SEARCH_DELAY_MS = 300;

/**
 * The cache key of the values of a parameter, under `['executions', 'allowed-values', workflowId, name, search]`. The values
 * come from the **saved** draft, so the key is not the editor's.
 */
export function allowedValuesKey(workflowId: string, name: string, search: string) {
  return [...EXECUTIONS_KEY, 'allowed-values', workflowId, name, search] as const;
}

/** The value, held back until it stops changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

const BRAZILIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * What is typed, as the `search` of the route. The back compares the text form of the values ("contains" in text,
 * "starts with" in integer and date), so an integer loses the thousands dots ("1.500" → "1500") and a whole date in
 * the Brazilian pattern goes as `aaaa-mm-dd`.
 */
export function searchText(typed: string, type: ScalarType): string {
  const text = typed.trim();
  if (type === 'integer') return text.replaceAll('.', '');
  if (type === 'date') {
    const match = BRAZILIAN_DATE.exec(text);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  }
  return text;
}

/**
 * `GET /v1/workflows/{id}/parameters/{name}/allowed-values`: the values (up to 1.000, `truncated` with more), filtered by
 * `search`. Only asked while `enabled` (the list is open). The list on screen stays while the next search is in flight.
 */
export function useAllowedValues(workflowId: string, name: string, search: string, enabled: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: allowedValuesKey(workflowId, name, search),
    queryFn: ({ signal }) =>
      dataOrError(
        client.GET('/v1/workflows/{id}/parameters/{name}/allowed-values', {
          params: { path: { id: workflowId, name }, query: search === '' ? {} : { search } },
          signal,
        }),
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}
