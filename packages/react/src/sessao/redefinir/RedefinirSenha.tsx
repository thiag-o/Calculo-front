import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { criarQueryClient, ProvedorApi } from '../../api';
import { RaizFluxo, type TemaFluxo } from '../../design-system';
import { TelaRedefinirSenha, type TelaRedefinirSenhaProps } from './TelaRedefinirSenha';

export interface RedefinirSenhaProps extends TelaRedefinirSenhaProps {
  /** Endereço da API, sem o `/v1`. As rotas de redefinição são públicas (sem sessão e sem CSRF). */
  apiUrl: string;
  /** Padrão: `sistema`. */
  tema?: TemaFluxo;
}

/**
 * Tela pública de nova senha pelo link de redefinição, completa: raiz do módulo (tokens e tema), cliente da API e
 * QueryClient próprios. O `token` é o do link, não o de incorporação. Depois de salvar, `onSalvar` é chamado; o
 * casca então leva a pessoa ao login.
 */
export function RedefinirSenha({ apiUrl, tema, token, onSalvar }: RedefinirSenhaProps) {
  const [queryClient] = useState(criarQueryClient);
  return (
    <RaizFluxo tema={tema} className="fc-redefinir-raiz">
      <ProvedorApi apiUrl={apiUrl}>
        <QueryClientProvider client={queryClient}>
          <TelaRedefinirSenha token={token} onSalvar={onSalvar} />
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>
  );
}
