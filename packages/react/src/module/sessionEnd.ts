import { createContext, useContext } from 'react';

/**
 * Ends the session in the module: hides the layout, clears the cache and notifies the host app's `onSessionExpired`.
 * Used when the API answers `401 no_session` and after "Sair".
 */
export const EndSessionContext = createContext<(() => void) | null>(null);

export function useEndSession(): () => void {
  const end = useContext(EndSessionContext);
  if (end === null) throw new Error('useEncerrarSessao precisa estar dentro do <FluxoCalculo>.');
  return end;
}
