import { createContext, useContext } from 'react';

/**
 * Encerra a sessão no módulo: some com o layout, limpa o cache e avisa o `onSessaoExpirada` do hospedeiro.
 * Usado quando a API responde `401 sem_sessao` e depois do "Sair".
 */
export const ContextoEncerrarSessao = createContext<(() => void) | null>(null);

export function useEncerrarSessao(): () => void {
  const encerrar = useContext(ContextoEncerrarSessao);
  if (encerrar === null) throw new Error('useEncerrarSessao precisa estar dentro do <FluxoCalculo>.');
  return encerrar;
}
