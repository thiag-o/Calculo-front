import type { ReactNode } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  UNSAFE_DataRouterContext,
  UNSAFE_DataRouterDataContext,
  UNSAFE_DataRouterNavigationContext,
  UNSAFE_DataRouterStateContext,
  UNSAFE_FetchersContext,
  UNSAFE_FrameworkContext,
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
  UNSAFE_RouteContext,
  UNSAFE_ViewTransitionContext,
} from 'react-router';

/**
 * - `url` (app casca): rotas internas ligadas à URL do navegador, com links diretos e o botão voltar;
 * - `memoria` (padrão quando incorporado): rotas em memória; a URL e o histórico do hospedeiro não mudam.
 */
export type NavegacaoFluxo = 'url' | 'memoria';

const ROTA_VAZIA = { outlet: null, matches: [], isDataRoute: false };
const SEM_TRANSICAO = { isTransitioning: false } as const;

/**
 * Separa o roteador do módulo do roteador do hospedeiro (ADR 0002 e 0006).
 *
 * O `react-router` é dependência externa do pacote: se o hospedeiro usa a mesma cópia, os contextos dele chegam
 * ao módulo. Sem isto, o `<Router>` do módulo recusa montar dentro de outro, as rotas do módulo se resolveriam
 * abaixo da rota do hospedeiro e `useNavigate` poderia navegar o roteador de dados do hospedeiro. Aqui os
 * contextos voltam aos valores padrão, como se não houvesse roteador acima.
 */
function IsolamentoDoHospedeiro({ children }: { children: ReactNode }) {
  return (
    <UNSAFE_FrameworkContext.Provider value={undefined}>
      <UNSAFE_DataRouterContext.Provider value={null}>
        <UNSAFE_DataRouterStateContext.Provider value={null}>
          <UNSAFE_DataRouterDataContext.Provider value={null}>
            <UNSAFE_DataRouterNavigationContext.Provider value={null}>
              <UNSAFE_FetchersContext.Provider value={null}>
                <UNSAFE_ViewTransitionContext.Provider value={SEM_TRANSICAO}>
                  {/* Os tipos não aceitam null, mas null é o valor padrão destes dois contextos ("fora de um roteador"). */}
                  <UNSAFE_NavigationContext.Provider value={null as never}>
                    <UNSAFE_LocationContext.Provider value={null as never}>
                      <UNSAFE_RouteContext.Provider value={ROTA_VAZIA}>{children}</UNSAFE_RouteContext.Provider>
                    </UNSAFE_LocationContext.Provider>
                  </UNSAFE_NavigationContext.Provider>
                </UNSAFE_ViewTransitionContext.Provider>
              </UNSAFE_FetchersContext.Provider>
            </UNSAFE_DataRouterNavigationContext.Provider>
          </UNSAFE_DataRouterDataContext.Provider>
        </UNSAFE_DataRouterStateContext.Provider>
      </UNSAFE_DataRouterContext.Provider>
    </UNSAFE_FrameworkContext.Provider>
  );
}

export interface RoteadorProps {
  navegacao: NavegacaoFluxo;
  /** Caminho em que o modo `memoria` começa (a tela inicial). No modo `url`, vale a URL atual. */
  caminhoInicial: string;
  children: ReactNode;
}

/** O roteador do módulo, por URL ou em memória, isolado do roteador do hospedeiro. */
export function Roteador({ navegacao, caminhoInicial, children }: RoteadorProps) {
  return (
    <IsolamentoDoHospedeiro>
      {navegacao === 'memoria' ? (
        <MemoryRouter initialEntries={[caminhoInicial]}>{children}</MemoryRouter>
      ) : (
        <BrowserRouter>{children}</BrowserRouter>
      )}
    </IsolamentoDoHospedeiro>
  );
}
