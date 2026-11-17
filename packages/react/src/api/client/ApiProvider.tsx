import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from './createApiClient';

const ApiContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
  /** API address, without `/v1`. */
  apiUrl: string;
  /** Embed token; without it, the client uses the session cookie. Changing the token recreates the client. */
  token?: string;
  /** Called when the API answers `401 sem_sessao`. */
  onSessionExpired?: () => void;
  children: ReactNode;
}

/** Provides the API client to the tree, created from `apiUrl` and `token`. */
export function ApiProvider({ apiUrl, token, onSessionExpired, children }: ApiProviderProps) {
  const client = useMemo(() => createApiClient({ apiUrl, token }), [apiUrl, token]);

  // Keeps the latest function without recreating the client or the subscription on every render.
  const onExpire = useRef(onSessionExpired);
  useEffect(() => {
    onExpire.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => client.onSessionExpired(() => onExpire.current?.()), [client]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

/** The API client of the nearest `<ApiProvider>`. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (client === null) throw new Error('useApiClient precisa estar dentro de <ApiProvider>.');
  return client;
}
