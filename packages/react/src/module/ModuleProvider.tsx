import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createQueryClient, ApiProvider } from '../api';
import { FluxoRoot, type FluxoTheme } from '../design-system';
import { EndSessionContext } from './sessionEnd';
import { EndedSession } from './ModuleStates';
import './module.css';

export interface ModuleProviderProps {
  /** API address, without `/v1`. */
  apiUrl: string;
  /** Embed token: with it, `Authorization: Bearer`; without it, the session cookie. */
  token?: string;
  /** Default: `system`. */
  theme?: FluxoTheme;
  /** Called once per token when there is no session anymore (`401 sem_sessao` or "Sair"). */
  onSessionExpired?: () => void;
  children: ReactNode;
}

/** Session end for a token: holds until the host app passes another token. */
interface SessionEnd {
  token: string | undefined;
}

/**
 * Everything a module screen needs to work, mounted once per instance: the root (tokens, theme and
 * portals), the API client (cookie or token), its own QueryClient and the session end. Used by
 * `<FluxoCalculo>` and by the standalone screens (`<Home>`, `<Admin>`, `<Audit>`). Internal to the package.
 * Without a session, shows the session-ended notice in place of the content and clears the cache (ADR 0008, 0015 and 0019).
 */
export function ModuleProvider({ apiUrl, token, theme, onSessionExpired, children }: ModuleProviderProps) {
  const [queryClient] = useState(createQueryClient);

  const [sessionEnd, setSessionEnd] = useState<SessionEnd | null>(null);
  const ended = sessionEnd !== null && sessionEnd.token === token;

  // Latest values, without recreating `end` (and the client subscription) on every render.
  const currentToken = useRef(token);
  const notifyHostApp = useRef(onSessionExpired);
  const lastSessionEnd = useRef<SessionEnd | null>(null);
  useLayoutEffect(() => {
    currentToken.current = token;
    notifyHostApp.current = onSessionExpired;
  }, [token, onSessionExpired]);

  const end = useCallback(() => {
    const current = currentToken.current;
    // Several queries may get the 401 together: the host app is notified once per token.
    if (lastSessionEnd.current !== null && lastSessionEnd.current.token === current) return;
    lastSessionEnd.current = { token: current };
    setSessionEnd({ token: current });
    notifyHostApp.current?.();
  }, []);

  // Without a session, nothing of the previous user stays in the cache (ADR 0008 and 0015). Runs after the content left the screen,
  // so no mounted query fetches again.
  useEffect(() => {
    if (!ended) return;
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [ended, queryClient]);

  return (
    <FluxoRoot theme={theme} className="fc-module-root">
      <ApiProvider apiUrl={apiUrl} token={token} onSessionExpired={end}>
        <QueryClientProvider client={queryClient}>
          <EndSessionContext.Provider value={end}>
            {ended ? <EndedSession /> : children}
          </EndSessionContext.Provider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
}
