import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { criarClienteApi, type ClienteApi } from './criarClienteApi';

const ContextoApi = createContext<ClienteApi | null>(null);

export interface PropsProvedorApi {
  /** Endereço da API, sem o `/v1`. */
  apiUrl: string;
  /** Token de incorporação; sem ele, o cliente usa o cookie de sessão. Trocar o token recria o cliente. */
  token?: string;
  /** Chamado quando a API responde `401 sem_sessao`. */
  onSessaoExpirada?: () => void;
  children: ReactNode;
}

/** Disponibiliza o cliente da API para a árvore, criado a partir de `apiUrl` e `token`. */
export function ProvedorApi({ apiUrl, token, onSessaoExpirada, children }: PropsProvedorApi) {
  const cliente = useMemo(() => criarClienteApi({ apiUrl, token }), [apiUrl, token]);

  // Guarda a função mais recente sem recriar o cliente nem a inscrição a cada renderização.
  const aoExpirar = useRef(onSessaoExpirada);
  useEffect(() => {
    aoExpirar.current = onSessaoExpirada;
  }, [onSessaoExpirada]);

  useEffect(() => cliente.aoExpirarSessao(() => aoExpirar.current?.()), [cliente]);

  return <ContextoApi.Provider value={cliente}>{children}</ContextoApi.Provider>;
}

/** O cliente da API do `<ProvedorApi>` mais próximo. */
export function useClienteApi(): ClienteApi {
  const cliente = useContext(ContextoApi);
  if (cliente === null) throw new Error('useClienteApi precisa estar dentro de <ProvedorApi>.');
  return cliente;
}
