import { createContext, useContext } from 'react';

/** undefined = fora de uma RaizFluxo; null = raiz montando (o contêiner ainda não existe). */
export const ContextoPortal = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Contêiner de portais da raiz do módulo, para o `container` dos portais Radix.
 * Enquanto for `null` (primeira renderização), não renderize o portal: o Radix sem contêiner usa o `body`.
 */
export function usePortalFluxo(): HTMLElement | null {
  const conteiner = useContext(ContextoPortal);
  if (conteiner === undefined) {
    throw new Error('usePortalFluxo precisa estar dentro de <RaizFluxo>.');
  }
  return conteiner;
}
