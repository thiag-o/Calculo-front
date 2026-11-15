import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { criarQueryClient, ProvedorApi } from '../../api';
import { RaizFluxo, type TemaFluxo } from '../../design-system';
import { TelaEntrar, type TelaEntrarProps } from './TelaEntrar';

export interface EntrarProps extends TelaEntrarProps {
  /** Endereço da API, sem o `/v1`. O login usa sempre o cookie de sessão (app casca). */
  apiUrl: string;
  /** Padrão: `sistema`. */
  tema?: TemaFluxo;
}

/**
 * Tela de login do app casca, completa: raiz do módulo (tokens e tema), cliente da API em modo cookie e
 * QueryClient próprios. Depois do login, `onEntrar` recebe a sessão; o casca então monta o `<FluxoCalculo>`.
 */
export function Entrar({ apiUrl, tema, onEntrar }: EntrarProps) {
  const [queryClient] = useState(criarQueryClient);
  return (
    <RaizFluxo tema={tema} className="fc-entrar-raiz">
      <ProvedorApi apiUrl={apiUrl}>
        <QueryClientProvider client={queryClient}>
          <TelaEntrar onEntrar={onEntrar} />
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>
  );
}
