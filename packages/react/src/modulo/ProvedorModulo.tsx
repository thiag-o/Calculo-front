import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { criarQueryClient, ProvedorApi } from '../api';
import { RaizFluxo, type TemaFluxo } from '../design-system';
import { ContextoEncerrarSessao } from './encerramento';
import { SessaoEncerrada } from './EstadosModulo';
import './modulo.css';

export interface ProvedorModuloProps {
  /** Endereço da API, sem o `/v1`. */
  apiUrl: string;
  /** Token de incorporação: com ele, `Authorization: Bearer`; sem ele, o cookie de sessão. */
  token?: string;
  /** Padrão: `sistema`. */
  tema?: TemaFluxo;
  /** Chamado uma vez por token quando não há mais sessão (`401 sem_sessao` ou "Sair"). */
  onSessaoExpirada?: () => void;
  children: ReactNode;
}

/** Encerramento da sessão para um token: vale até o hospedeiro passar outro token. */
interface Encerramento {
  token: string | undefined;
}

/**
 * Tudo o que uma tela do módulo precisa para funcionar, montado uma vez por instância: a raiz (tokens, tema e
 * portais), o cliente da API (cookie ou token), um QueryClient próprio e o encerramento da sessão. Usado pelo
 * `<FluxoCalculo>` e pelas telas avulsas (`<Inicio>`, `<Administracao>`, `<Auditoria>`). É interno ao pacote.
 * Sem sessão, mostra o aviso de sessão encerrada no lugar do conteúdo e limpa o cache (ADR 0008, 0015 e 0019).
 */
export function ProvedorModulo({ apiUrl, token, tema, onSessaoExpirada, children }: ProvedorModuloProps) {
  const [queryClient] = useState(criarQueryClient);

  const [encerramento, setEncerramento] = useState<Encerramento | null>(null);
  const encerrada = encerramento !== null && encerramento.token === token;

  // Valores mais recentes, sem recriar o `encerrar` (e a inscrição no cliente) a cada renderização.
  const tokenAtual = useRef(token);
  const avisarHospedeiro = useRef(onSessaoExpirada);
  const ultimoEncerramento = useRef<Encerramento | null>(null);
  useLayoutEffect(() => {
    tokenAtual.current = token;
    avisarHospedeiro.current = onSessaoExpirada;
  }, [token, onSessaoExpirada]);

  const encerrar = useCallback(() => {
    const atual = tokenAtual.current;
    // Várias consultas podem receber o 401 juntas: o hospedeiro é avisado uma vez por token.
    if (ultimoEncerramento.current !== null && ultimoEncerramento.current.token === atual) return;
    ultimoEncerramento.current = { token: atual };
    setEncerramento({ token: atual });
    avisarHospedeiro.current?.();
  }, []);

  // Sem sessão, nada do usuário anterior fica no cache (ADR 0008 e 0015). Roda depois que o conteúdo saiu da tela,
  // para nenhuma consulta montada buscar de novo.
  useEffect(() => {
    if (!encerrada) return;
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [encerrada, queryClient]);

  return (
    <RaizFluxo tema={tema} className="fc-modulo-raiz">
      <ProvedorApi apiUrl={apiUrl} token={token} onSessaoExpirada={encerrar}>
        <QueryClientProvider client={queryClient}>
          <ContextoEncerrarSessao.Provider value={encerrar}>
            {encerrada ? <SessaoEncerrada /> : children}
          </ContextoEncerrarSessao.Provider>
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>
  );
}
