import { createContext, useContext } from 'react';

/** undefined = outside a FluxoRoot; null = root mounting (the container does not exist yet). */
export const PortalContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Portal container of the module root, for the `container` of the Radix portals.
 * While it is `null` (first render), do not render the portal: Radix without a container uses `body`.
 */
export function useFluxoPortal(): HTMLElement | null {
  const container = useContext(PortalContext);
  if (container === undefined) {
    throw new Error('useFluxoPortal precisa estar dentro de <FluxoRoot>.');
  }
  return container;
}
